/**
 * @file types.ts
 * @description Core-layer type definitions for Phase 0.2 algorithms.
 * These types are distinct from schema-layer types (src/schemas/types.ts)
 * and represent runtime analysis results, not persisted entities.
 */

import type { InitiativeStatus, InitiativeId, ISOTimestamp } from "../schemas/types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY MAPPER TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Supported language identifiers (lowercase, consistent with linguist) */
export type LanguageId =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "kotlin"
  | "swift"
  | "csharp"
  | "cpp"
  | "c"
  | "ruby"
  | "php"
  | "scala"
  | "elixir"
  | "haskell"
  | "shell"
  | "yaml"
  | "json"
  | "markdown"
  | "html"
  | "css"
  | "scss"
  | "sql"
  | "dockerfile"
  | "terraform"
  | "unknown";

/** How a repository is structured at the top level */
export type RepoType =
  | "monolith"      // Single deployable unit
  | "monorepo"      // Multiple packages in one repo (workspaces, lerna, nx)
  | "microservices" // Multiple services without shared workspace config
  | "library"       // No server/app; exports a package
  | "unknown";      // Cannot be determined

/** Source of a detected framework */
export type FrameworkSource = "dependency" | "devDependency" | "config-file" | "inference";

/** A detected framework or library */
export interface DetectedFramework {
  /** Framework name (e.g. "React", "Express", "Next.js") */
  name: string;
  /** How it was detected */
  source: FrameworkSource;
  /** Version if parseable */
  version: string | null;
  /** Confidence 0.0–1.0 */
  confidence: number;
}

/** Language usage statistics */
export interface LanguageStats {
  language: LanguageId;
  fileCount: number;
  totalBytes: number;
  /** 0–100, share of total scanned file bytes */
  percentage: number;
}

/** Classification of a detected entry point */
export type EntryPointType =
  | "server"        // HTTP/gRPC/WS server start
  | "cli"           // Command-line interface binary
  | "main"          // Generic main entry (scripts.main in package.json)
  | "worker"        // Background worker / queue consumer
  | "test-runner"   // Test bootstrap (vitest.config, jest.config)
  | "build-script"  // Bundler config (webpack.config, vite.config)
  | "unknown";

/** A detected repository entry point */
export interface EntryPoint {
  /** Repo-relative path */
  path: string;
  type: EntryPointType;
  /** 0.0–1.0 detection confidence */
  confidence: number;
  /** How it was found */
  detectionReason: string;
}

/** Dependency graph across package managers */
export interface DependencyGraph {
  /** Production dependencies (name → semver constraint) */
  direct: Record<string, string>;
  /** Development dependencies */
  dev: Record<string, string>;
  /** Peer dependencies */
  peer: Record<string, string>;
}

/** Type of config file detected */
export type ConfigFileType =
  | "package-json"
  | "tsconfig"
  | "go-mod"
  | "cargo-toml"
  | "pyproject-toml"
  | "requirements-txt"
  | "pom-xml"
  | "build-gradle"
  | "gemfile"
  | "composer-json"
  | "lerna-json"
  | "nx-json"
  | "turbo-json"
  | "docker-compose"
  | "other";

/** A parsed configuration file */
export interface ConfigFile {
  /** Repo-relative path */
  path: string;
  type: ConfigFileType;
  /** Parsed content — null if parse failed */
  parsed: Record<string, unknown> | null;
  /** Parse error message — null if parse succeeded */
  parseError: string | null;
}

/** A single node in the directory tree */
export interface DirectoryNode {
  name: string;
  /** Absolute path */
  path: string;
  type: "file" | "directory";
  /** Children for directories; null for files */
  children: DirectoryNode[] | null;
  /** Language for files; null for directories */
  language: LanguageId | null;
  /** File size in bytes; 0 for directories */
  size: number;
  /** Nesting depth from root (root = 0) */
  depth: number;
}

/** Full output of a repository scan */
export interface RepositoryMap {
  /** Absolute path to the scanned root */
  rootPath: string;
  repoType: RepoType;
  /** Directory tree (up to configured max depth) */
  structure: DirectoryNode;
  /** Language breakdown ordered by fileCount desc */
  languages: LanguageStats[];
  /** Detected frameworks ordered by confidence desc */
  frameworks: DetectedFramework[];
  /** Detected entry points ordered by confidence desc */
  entryPoints: EntryPoint[];
  dependencies: DependencyGraph;
  configFiles: ConfigFile[];
  /** Wall-clock time for the scan in milliseconds */
  scanDurationMs: number;
  totalFiles: number;
  totalDirectories: number;
  /** Paths skipped due to ignore rules (repo-relative) */
  skippedPaths: string[];
}

/** Configuration for a RepositoryMapper scan */
export interface RepositoryMapperConfig {
  /** Maximum directory depth to traverse (default: 4) */
  maxDepth: number;
  /**
   * Directory names to skip entirely.
   * Default covers node_modules, .git, dist, build, etc.
   */
  ignoreDirs: string[];
  /**
   * File extensions to skip (e.g. binary assets).
   * Default: .png, .jpg, .woff, etc.
   */
  ignoreExtensions: string[];
  /**
   * Scan timeout in milliseconds.
   * Default: 300_000 (5 minutes).
   */
  timeoutMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE CLASSIFIER TYPES
// ─────────────────────────────────────────────────────────────────────────────

import type { FindingClassification, FindingConfidence, EvidenceType } from "../schemas/types.ts";

/** A contradiction between two evidence records */
export interface EvidenceContradiction {
  /** Description of the contradiction */
  description: string;
  /** Indices into the input evidence array */
  evidenceIndices: [number, number];
}

/** A gap in the evidence coverage */
export interface EvidenceGap {
  description: string;
  /** The missing evidence type that would resolve the gap */
  missingType: EvidenceType;
  /** How much this gap reduces confidence */
  confidencePenalty: number;
}

/** Full output of evidence classification */
export interface ClassificationResult {
  classification: FindingClassification;
  confidence: FindingConfidence;
  /**
   * Human-readable reasoning for classification and confidence.
   * Must explain every rule that was applied.
   */
  reasoning: string;
  /** Evidence types that were present */
  presentTypes: EvidenceType[];
  /** Contradictions detected between evidence records */
  contradictions: EvidenceContradiction[];
  /** Gaps in evidence coverage */
  gaps: EvidenceGap[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING ENGINE TYPES
// ─────────────────────────────────────────────────────────────────────────────

import type { ScoringBreakdown, ScoreConfidence } from "../schemas/types.ts";

/** Per-axis explanation in a decision trace */
export interface AxisRationale {
  axis: keyof ScoringBreakdown;
  score: number;
  /** Human-readable rationale for this axis score */
  rationale: string;
}

/** Full scoring computation result (before updating the Initiative) */
export interface ScoringComputation {
  breakdown: ScoringBreakdown;
  finalScore: number;
  scoreConfidence: ScoreConfidence;
  /** Axis-by-axis rationales, one per breakdown field */
  axisRationales: AxisRationale[];
  /** Full decision trace narrative */
  decisionTrace: string;
  /** Formula used */
  derivationRules: string;
}

/** Ranking position with tiebreak explanation */
export interface RankedInitiative {
  rank: number;
  initiativeId: InitiativeId;
  initiativeSlug: string;
  finalScore: number;
  scoreConfidence: ScoreConfidence;
  /** Reason this initiative beat the next one (null if no tie or last item) */
  tiebreakReason: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE MACHINE (CORE) TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A single recorded transition event */
export interface TransitionRecord {
  initiativeId: InitiativeId;
  from: InitiativeStatus;
  to: InitiativeStatus;
  /** Must be non-empty — no silent transitions */
  reason: string;
  /** Username, system agent, or process triggering the change */
  triggeredBy: string;
  timestamp: ISOTimestamp;
  /** Snapshot of guard check results */
  guardResults: GuardResult[];
}

/** Result of a single guard check */
export interface GuardResult {
  guardName: string;
  passed: boolean;
  /** Detail explaining why it passed or failed */
  detail: string;
}

/** Function-based guard: returns true if the transition is allowed */
export type GuardFn = (initiative: import("../schemas/types.ts").Initiative) => GuardResult;

/** Enhanced transition definition with function guards */
export interface CoreStateTransition {
  from: InitiativeStatus;
  to: InitiativeStatus;
  /** All guards must pass; failures are collected and reported */
  guards: GuardFn[];
  /** Human-readable description of conditions */
  conditionSummary: string[];
  /** Side effects (documentation only; not automatically executed) */
  sideEffects: string[];
}
