/**
 * @file repository-mapper.ts
 * @description Async depth-first repository scanner.
 *
 * Returns a RepositoryMap containing:
 *   - Directory tree (configurable max depth)
 *   - Language statistics by file extension
 *   - Detected frameworks (from dependency manifests)
 *   - Entry points (main, server, CLI, workers)
 *   - Config files (parsed where possible)
 *   - Dependency graph
 *   - Repository type classification
 *
 * Performance target: <1 minute for 100K-file repositories.
 * Enforced via configurable timeout (default 5 minutes).
 */

import { readdir, stat, readFile } from "fs/promises";
import { join, extname, basename, relative } from "path";
import type {
  RepositoryMap,
  RepositoryMapperConfig,
  DirectoryNode,
  LanguageStats,
  LanguageId,
  DetectedFramework,
  EntryPoint,
  EntryPointType,
  ConfigFile,
  ConfigFileType,
  DependencyGraph,
  RepoType,
  FrameworkSource,
} from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RepositoryMapperConfig = {
  maxDepth: 4,
  ignoreDirs: [
    "node_modules", ".git", "dist", "build", ".next", ".nuxt",
    "coverage", "__pycache__", ".venv", "venv", "vendor",
    ".turbo", ".cache", ".parcel-cache", "target", "out",
    ".gradle", ".idea", ".vscode", "__mocks__", ".nyc_output",
    "storybook-static", ".docusaurus",
  ],
  ignoreExtensions: [
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp4", ".mp3", ".wav", ".avi", ".mov",
    ".zip", ".tar", ".gz", ".7z", ".rar",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".lock",          // package-lock.json handled separately; yarn.lock skipped
    ".map",           // source maps
  ],
  timeoutMs: 300_000, // 5 minutes
};

/** Extension → language mapping */
const EXTENSION_TO_LANGUAGE: Record<string, LanguageId> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyw": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".swift": "swift",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c": "c",
  ".h": "c",
  ".rb": "ruby",
  ".php": "php",
  ".scala": "scala",
  ".ex": "elixir",
  ".exs": "elixir",
  ".hs": "haskell",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".json": "json",
  ".md": "markdown",
  ".mdx": "markdown",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "scss",
  ".sql": "sql",
  ".tf": "terraform",
  ".tfvars": "terraform",
};

/** Framework detection rules: keyword → (name, source, confidence) */
const FRAMEWORK_SIGNALS: Array<{
  keyword: string;
  name: string;
  source: FrameworkSource;
  confidence: number;
}> = [
  // Frontend
  { keyword: "react", name: "React", source: "dependency", confidence: 0.95 },
  { keyword: "next", name: "Next.js", source: "dependency", confidence: 0.95 },
  { keyword: "vue", name: "Vue.js", source: "dependency", confidence: 0.95 },
  { keyword: "nuxt", name: "Nuxt.js", source: "dependency", confidence: 0.95 },
  { keyword: "svelte", name: "Svelte", source: "dependency", confidence: 0.95 },
  { keyword: "@angular/core", name: "Angular", source: "dependency", confidence: 0.98 },
  { keyword: "remix", name: "Remix", source: "dependency", confidence: 0.9 },
  { keyword: "gatsby", name: "Gatsby", source: "dependency", confidence: 0.9 },

  // Backend / Node
  { keyword: "express", name: "Express", source: "dependency", confidence: 0.9 },
  { keyword: "fastify", name: "Fastify", source: "dependency", confidence: 0.9 },
  { keyword: "koa", name: "Koa", source: "dependency", confidence: 0.9 },
  { keyword: "@nestjs/core", name: "NestJS", source: "dependency", confidence: 0.98 },
  { keyword: "hapi", name: "Hapi", source: "dependency", confidence: 0.85 },

  // Build tools
  { keyword: "vite", name: "Vite", source: "devDependency", confidence: 0.9 },
  { keyword: "webpack", name: "Webpack", source: "devDependency", confidence: 0.85 },
  { keyword: "esbuild", name: "esbuild", source: "devDependency", confidence: 0.8 },
  { keyword: "rollup", name: "Rollup", source: "devDependency", confidence: 0.8 },
  { keyword: "turbo", name: "Turborepo", source: "devDependency", confidence: 0.9 },

  // Testing
  { keyword: "vitest", name: "Vitest", source: "devDependency", confidence: 0.9 },
  { keyword: "jest", name: "Jest", source: "devDependency", confidence: 0.9 },
  { keyword: "playwright", name: "Playwright", source: "devDependency", confidence: 0.9 },
  { keyword: "cypress", name: "Cypress", source: "devDependency", confidence: 0.9 },

  // ORM / DB
  { keyword: "prisma", name: "Prisma", source: "dependency", confidence: 0.95 },
  { keyword: "typeorm", name: "TypeORM", source: "dependency", confidence: 0.9 },
  { keyword: "drizzle-orm", name: "Drizzle ORM", source: "dependency", confidence: 0.9 },
  { keyword: "sequelize", name: "Sequelize", source: "dependency", confidence: 0.85 },
  { keyword: "mongoose", name: "Mongoose", source: "dependency", confidence: 0.9 },

  // Other
  { keyword: "graphql", name: "GraphQL", source: "dependency", confidence: 0.85 },
  { keyword: "trpc", name: "tRPC", source: "dependency", confidence: 0.9 },
  { keyword: "zod", name: "Zod", source: "dependency", confidence: 0.8 },
];

/** Entry point filename signals */
const ENTRY_POINT_SIGNALS: Array<{
  pattern: RegExp;
  type: EntryPointType;
  confidence: number;
  reason: string;
}> = [
  { pattern: /^(index|main)\.(ts|js|mts|mjs)$/, type: "main", confidence: 0.85, reason: "Standard index/main entry point" },
  { pattern: /^(server|app)\.(ts|js)$/, type: "server", confidence: 0.9, reason: "Conventional server entry point name" },
  { pattern: /^(cli|bin)\.(ts|js)$/, type: "cli", confidence: 0.9, reason: "Conventional CLI entry point name" },
  { pattern: /^worker\.(ts|js)$/, type: "worker", confidence: 0.85, reason: "Conventional worker entry point name" },
  { pattern: /vitest\.config\.(ts|js)$/, type: "test-runner", confidence: 0.95, reason: "Vitest configuration file" },
  { pattern: /jest\.config\.(ts|js|json)$/, type: "test-runner", confidence: 0.95, reason: "Jest configuration file" },
  { pattern: /^vite\.config\.(ts|js)$/, type: "build-script", confidence: 0.95, reason: "Vite bundler configuration" },
  { pattern: /^webpack\.config\.(ts|js)$/, type: "build-script", confidence: 0.95, reason: "Webpack bundler configuration" },
  { pattern: /^next\.config\.(ts|js|mjs)$/, type: "build-script", confidence: 0.95, reason: "Next.js configuration (implies server)" },
];

/** Config file name → type mapping */
const CONFIG_FILE_NAMES: Record<string, ConfigFileType> = {
  "package.json": "package-json",
  "tsconfig.json": "tsconfig",
  "tsconfig.base.json": "tsconfig",
  "tsconfig.build.json": "tsconfig",
  "go.mod": "go-mod",
  "Cargo.toml": "cargo-toml",
  "pyproject.toml": "pyproject-toml",
  "requirements.txt": "requirements-txt",
  "pom.xml": "pom-xml",
  "build.gradle": "build-gradle",
  "build.gradle.kts": "build-gradle",
  "Gemfile": "gemfile",
  "composer.json": "composer-json",
  "lerna.json": "lerna-json",
  "nx.json": "nx-json",
  "turbo.json": "turbo-json",
  "docker-compose.yml": "docker-compose",
  "docker-compose.yaml": "docker-compose",
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL SCAN STATE
// ─────────────────────────────────────────────────────────────────────────────

interface ScanState {
  totalFiles: number;
  totalDirectories: number;
  skippedPaths: string[];
  langBytes: Map<LanguageId, number>;
  langCounts: Map<LanguageId, number>;
  configFiles: ConfigFile[];
  entryPoints: EntryPoint[];
  timedOut: boolean;
  startMs: number;
  rootPath: string;
  config: RepositoryMapperConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function tryParseJson(filePath: string): Promise<{
  parsed: Record<string, unknown> | null;
  parseError: string | null;
}> {
  try {
    const text = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return { parsed, parseError: null };
  } catch (err) {
    return {
      parsed: null,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

async function tryReadText(filePath: string): Promise<{
  parsed: Record<string, unknown> | null;
  parseError: string | null;
}> {
  try {
    const text = await readFile(filePath, "utf-8");
    return { parsed: { raw: text }, parseError: null };
  } catch (err) {
    return {
      parsed: null,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

async function parseConfigFile(absPath: string, type: ConfigFileType): Promise<ConfigFile> {
  const repoRelPath = absPath; // caller will make it relative

  let result: { parsed: Record<string, unknown> | null; parseError: string | null };

  switch (type) {
    case "package-json":
    case "tsconfig":
    case "lerna-json":
    case "nx-json":
    case "turbo-json":
    case "composer-json":
      result = await tryParseJson(absPath);
      break;
    case "go-mod":
    case "requirements-txt":
    case "gemfile":
    case "cargo-toml":
    case "pyproject-toml":
    case "pom-xml":
    case "build-gradle":
    case "docker-compose":
    case "other":
      result = await tryReadText(absPath);
      break;
    default:
      result = { parsed: null, parseError: "Unknown config type" };
  }

  return { path: repoRelPath, type, ...result };
}

function extractDependencies(packageJson: Record<string, unknown>): DependencyGraph {
  function toStringRecord(obj: unknown): Record<string, string> {
    if (typeof obj !== "object" || obj === null) return {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") result[k] = v;
    }
    return result;
  }

  return {
    direct: toStringRecord(packageJson["dependencies"]),
    dev: toStringRecord(packageJson["devDependencies"]),
    peer: toStringRecord(packageJson["peerDependencies"]),
  };
}

function detectFrameworks(
  deps: DependencyGraph,
  configFiles: ConfigFile[]
): DetectedFramework[] {
  const found = new Map<string, DetectedFramework>();

  const check = (deps: Record<string, string>, depType: "dependency" | "devDependency") => {
    for (const [depName] of Object.entries(deps)) {
      const lowerName = depName.toLowerCase();
      for (const signal of FRAMEWORK_SIGNALS) {
        if (lowerName.includes(signal.keyword) && signal.source === depType) {
          if (!found.has(signal.name)) {
            found.set(signal.name, {
              name: signal.name,
              source: signal.source,
              version: deps[depName] ?? null,
              confidence: signal.confidence,
            });
          }
        }
      }
    }
  };

  check(deps.direct, "dependency");
  check(deps.dev, "devDependency");

  // Config-file based detection
  for (const cf of configFiles) {
    if (cf.type === "nx-json") {
      found.set("Nx", { name: "Nx", source: "config-file", version: null, confidence: 0.98 });
    }
    if (cf.type === "lerna-json") {
      found.set("Lerna", { name: "Lerna", source: "config-file", version: null, confidence: 0.98 });
    }
    if (cf.type === "turbo-json") {
      found.set("Turborepo", { name: "Turborepo", source: "config-file", version: null, confidence: 0.98 });
    }
  }

  return Array.from(found.values()).sort((a, b) => b.confidence - a.confidence);
}

function classifyRepoType(
  packageJson: Record<string, unknown> | null,
  configFiles: ConfigFile[],
  structure: DirectoryNode
): RepoType {
  // Monorepo signals
  if (configFiles.some((c) => c.type === "lerna-json" || c.type === "nx-json" || c.type === "turbo-json")) {
    return "monorepo";
  }
  if (packageJson !== null) {
    if (typeof packageJson["workspaces"] !== "undefined") return "monorepo";
    if (typeof packageJson["private"] === "boolean" && packageJson["private"] === true) {
      // Private + no main → likely monorepo root
      if (typeof packageJson["main"] === "undefined") return "monorepo";
    }
  }

  // Library: has "main" or "exports" but no server scripts
  if (packageJson !== null) {
    const hasMain = typeof packageJson["main"] === "string";
    const hasExports = typeof packageJson["exports"] !== "undefined";
    const scripts = packageJson["scripts"];
    const hasStart = typeof scripts === "object" && scripts !== null && "start" in scripts;
    if ((hasMain || hasExports) && !hasStart) return "library";
  }

  // Microservices: multiple services directories
  const servicesDirs = (structure.children ?? []).filter(
    (c) => c.type === "directory" && /^service[s]?$|^apps?$/i.test(c.name)
  );
  if (servicesDirs.length > 0) {
    const subPkgs = (structure.children ?? []).filter(
      (c) => c.type === "directory" && (c.children ?? []).some((gc) => gc.name === "package.json")
    );
    if (subPkgs.length >= 2) return "microservices";
  }

  if (packageJson !== null) return "monolith";
  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// DFS TRAVERSAL
// ─────────────────────────────────────────────────────────────────────────────

async function traverseDirectory(
  absPath: string,
  depth: number,
  state: ScanState
): Promise<DirectoryNode> {
  // Timeout check
  if (Date.now() - state.startMs > state.config.timeoutMs) {
    state.timedOut = true;
  }

  const name = basename(absPath);
  const relPath = relative(state.rootPath, absPath);

  if (depth > state.config.maxDepth || state.timedOut) {
    return {
      name,
      path: absPath,
      type: "directory",
      children: null, // truncated
      language: null,
      size: 0,
      depth,
    };
  }

  let entries: string[];
  try {
    entries = await readdir(absPath);
  } catch {
    state.skippedPaths.push(relPath || ".");
    return {
      name,
      path: absPath,
      type: "directory",
      children: [],
      language: null,
      size: 0,
      depth,
    };
  }

  const children: DirectoryNode[] = [];

  for (const entry of entries.sort()) {
    const childPath = join(absPath, entry);
    const ext = extname(entry).toLowerCase();

    let fileStat: { isDirectory(): boolean; size: number };
    try {
      fileStat = await stat(childPath);
    } catch {
      state.skippedPaths.push(relative(state.rootPath, childPath));
      continue;
    }

    if (fileStat.isDirectory()) {
      if (state.config.ignoreDirs.includes(entry)) {
        state.skippedPaths.push(relative(state.rootPath, childPath));
        continue;
      }
      state.totalDirectories++;
      const childNode = await traverseDirectory(childPath, depth + 1, state);
      children.push(childNode);
    } else {
      // File
      if (state.config.ignoreExtensions.includes(ext)) {
        continue;
      }

      const language: LanguageId = EXTENSION_TO_LANGUAGE[ext] ?? "unknown";
      const size = fileStat.size;

      state.totalFiles++;
      state.langBytes.set(language, (state.langBytes.get(language) ?? 0) + size);
      state.langCounts.set(language, (state.langCounts.get(language) ?? 0) + 1);

      // Config file detection
      const configType = CONFIG_FILE_NAMES[entry];
      if (configType !== undefined) {
        const cf = await parseConfigFile(childPath, configType);
        cf.path = relative(state.rootPath, childPath);
        state.configFiles.push(cf);
      }

      // Entry point detection
      for (const signal of ENTRY_POINT_SIGNALS) {
        if (signal.pattern.test(entry)) {
          state.entryPoints.push({
            path: relative(state.rootPath, childPath),
            type: signal.type,
            confidence: signal.confidence,
            detectionReason: signal.reason,
          });
          break;
        }
      }

      children.push({
        name: entry,
        path: childPath,
        type: "file",
        children: null,
        language,
        size,
        depth,
      });
    }
  }

  return {
    name,
    path: absPath,
    type: "directory",
    children,
    language: null,
    size: 0,
    depth,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class RepositoryMapper {
  private readonly config: RepositoryMapperConfig;

  constructor(config: Partial<RepositoryMapperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Perform a full async scan of a repository.
   *
   * @param rootPath - Absolute path to the repository root
   * @returns RepositoryMap
   * @throws {Error} if rootPath does not exist or is not a directory
   */
  async mapRepository(rootPath: string): Promise<RepositoryMap> {
    // Verify root exists
    let rootStat: { isDirectory(): boolean };
    try {
      rootStat = await stat(rootPath);
    } catch {
      throw new Error(`RepositoryMapper: cannot access root path "${rootPath}"`);
    }
    if (!rootStat.isDirectory()) {
      throw new Error(`RepositoryMapper: "${rootPath}" is not a directory`);
    }

    const startMs = Date.now();

    const state: ScanState = {
      totalFiles: 0,
      totalDirectories: 1, // root itself
      skippedPaths: [],
      langBytes: new Map(),
      langCounts: new Map(),
      configFiles: [],
      entryPoints: [],
      timedOut: false,
      startMs,
      rootPath,
      config: this.config,
    };

    const structure = await traverseDirectory(rootPath, 0, state);

    const scanDurationMs = Date.now() - startMs;
    const totalBytes = Array.from(state.langBytes.values()).reduce((a, b) => a + b, 0);

    // Build language stats
    const languages: LanguageStats[] = Array.from(state.langCounts.entries())
      .map(([language, fileCount]) => ({
        language,
        fileCount,
        totalBytes: state.langBytes.get(language) ?? 0,
        percentage:
          totalBytes > 0
            ? Math.round(((state.langBytes.get(language) ?? 0) / totalBytes) * 100)
            : 0,
      }))
      .sort((a, b) => b.fileCount - a.fileCount);

    // Extract dependencies from root package.json
    const rootPkg = state.configFiles.find((c) => c.type === "package-json" && c.path === "package.json");
    const deps: DependencyGraph =
      rootPkg?.parsed !== null && rootPkg?.parsed !== undefined
        ? extractDependencies(rootPkg.parsed)
        : { direct: {}, dev: {}, peer: {} };

    // Also check package.json scripts for entry points
    if (rootPkg?.parsed !== null && rootPkg?.parsed !== undefined) {
      const scripts = rootPkg.parsed["scripts"];
      const mainField = rootPkg.parsed["main"];
      const binField = rootPkg.parsed["bin"];

      if (typeof mainField === "string" && mainField.trim() !== "") {
        state.entryPoints.push({
          path: mainField,
          type: "main",
          confidence: 0.95,
          detectionReason: `"main" field in package.json: "${mainField}"`,
        });
      }

      if (typeof binField === "object" && binField !== null) {
        for (const [binName, binPath] of Object.entries(binField)) {
          if (typeof binPath === "string") {
            state.entryPoints.push({
              path: binPath,
              type: "cli",
              confidence: 0.98,
              detectionReason: `"bin.${binName}" field in package.json`,
            });
          }
        }
      }

      if (typeof scripts === "object" && scripts !== null && "start" in scripts) {
        const startScript = (scripts as Record<string, unknown>)["start"];
        if (typeof startScript === "string") {
          state.entryPoints.push({
            path: "(npm start)",
            type: "server",
            confidence: 0.75,
            detectionReason: `"scripts.start" in package.json: "${startScript}"`,
          });
        }
      }
    }

    const frameworks = detectFrameworks(deps, state.configFiles);
    const repoType = classifyRepoType(
      rootPkg?.parsed ?? null,
      state.configFiles,
      structure
    );

    // Deduplicate entry points
    const uniqueEntryPoints = Array.from(
      new Map(state.entryPoints.map((e) => [e.path, e])).values()
    ).sort((a, b) => b.confidence - a.confidence);

    return {
      rootPath,
      repoType,
      structure,
      languages,
      frameworks,
      entryPoints: uniqueEntryPoints,
      dependencies: deps,
      configFiles: state.configFiles,
      scanDurationMs,
      totalFiles: state.totalFiles,
      totalDirectories: state.totalDirectories,
      skippedPaths: state.skippedPaths,
    };
  }

  /** Return the effective config (useful for inspection in tests) */
  getConfig(): Readonly<RepositoryMapperConfig> {
    return this.config;
  }
}
