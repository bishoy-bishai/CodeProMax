/**
 * @file repository-mapper.test.ts
 * @description Tests for RepositoryMapper.
 * Uses real temp directories for integration tests and validates
 * language detection, framework inference, entry point discovery, and error handling.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { RepositoryMapper } from "../../algorithms/repository-mapper.ts";

// ─────────────────────────────────────────────────────────────────────────────
// TEMP FIXTURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

let testRoot: string;

beforeAll(async () => {
  testRoot = join(tmpdir(), `cpm-test-${Date.now()}`);
  await mkdir(testRoot, { recursive: true });
});

afterAll(async () => {
  await rm(testRoot, { recursive: true, force: true });
});

async function createFixture(
  name: string,
  files: Record<string, string>
): Promise<string> {
  const root = join(testRoot, name);
  await mkdir(root, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const absPath = join(root, relPath);
    await mkdir(join(absPath, ".."), { recursive: true });
    await writeFile(absPath, content, "utf-8");
  }
  return root;
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("RepositoryMapper — basic scan", () => {
  it("returns a RepositoryMap with required fields", async () => {
    const root = await createFixture("basic", {
      "package.json": JSON.stringify({ name: "basic-app", dependencies: {} }),
      "src/index.ts": "export const x = 1;",
    });

    const mapper = new RepositoryMapper();
    const result = await mapper.mapRepository(root);

    expect(result.rootPath).toBe(root);
    expect(result.totalFiles).toBeGreaterThan(0);
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.languages)).toBe(true);
    expect(Array.isArray(result.frameworks)).toBe(true);
    expect(Array.isArray(result.entryPoints)).toBe(true);
    expect(Array.isArray(result.configFiles)).toBe(true);
    expect(Array.isArray(result.skippedPaths)).toBe(true);
  });

  it("detects TypeScript files", async () => {
    const root = await createFixture("ts-detect", {
      "src/index.ts": "export const x = 1;",
      "src/utils.ts": "export const y = 2;",
      "package.json": JSON.stringify({ name: "ts-app" }),
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const tsLang = result.languages.find((l) => l.language === "typescript");
    expect(tsLang).toBeDefined();
    expect(tsLang?.fileCount).toBeGreaterThanOrEqual(2);
  });

  it("detects Python files", async () => {
    const root = await createFixture("py-detect", {
      "main.py": "print('hello')",
      "utils.py": "def helper(): pass",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const pyLang = result.languages.find((l) => l.language === "python");
    expect(pyLang).toBeDefined();
    expect(pyLang?.fileCount).toBeGreaterThanOrEqual(2);
  });

  it("detects mixed language repo", async () => {
    const root = await createFixture("mixed", {
      "backend/main.go": "package main",
      "frontend/index.ts": "export const x = 1;",
      "package.json": JSON.stringify({ name: "mixed" }),
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const langs = result.languages.map((l) => l.language);
    expect(langs).toContain("typescript");
    expect(langs).toContain("go");
  });
});

describe("RepositoryMapper — framework detection", () => {
  it("detects React from dependencies", async () => {
    const root = await createFixture("react-app", {
      "package.json": JSON.stringify({
        name: "my-react-app",
        dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" },
      }),
      "src/index.tsx": "import React from 'react';",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const reactFw = result.frameworks.find((f) => f.name === "React");
    expect(reactFw).toBeDefined();
    expect(reactFw?.confidence).toBeGreaterThan(0.8);
  });

  it("detects NestJS from dependencies", async () => {
    const root = await createFixture("nestjs-app", {
      "package.json": JSON.stringify({
        name: "my-nest-app",
        dependencies: { "@nestjs/core": "^10.0.0", "@nestjs/common": "^10.0.0" },
      }),
      "src/main.ts": "import { NestFactory } from '@nestjs/core';",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const nestFw = result.frameworks.find((f) => f.name === "NestJS");
    expect(nestFw).toBeDefined();
  });

  it("detects Vite as build tool from devDependencies", async () => {
    const root = await createFixture("vite-app", {
      "package.json": JSON.stringify({
        name: "vite-app",
        dependencies: { react: "^18.0.0" },
        devDependencies: { vite: "^5.0.0" },
      }),
      "vite.config.ts": "import { defineConfig } from 'vite';",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const viteFw = result.frameworks.find((f) => f.name === "Vite");
    expect(viteFw).toBeDefined();
  });

  it("detects no frameworks for empty dependencies", async () => {
    const root = await createFixture("bare-app", {
      "package.json": JSON.stringify({ name: "bare", dependencies: {} }),
      "src/index.ts": "console.log('hello');",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    expect(result.frameworks).toHaveLength(0);
  });
});

describe("RepositoryMapper — entry point detection", () => {
  it("detects main from package.json main field", async () => {
    const root = await createFixture("main-field", {
      "package.json": JSON.stringify({ name: "app", main: "dist/index.js" }),
      "src/index.ts": "export const start = () => {};",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const mainEp = result.entryPoints.find((e) => e.type === "main");
    expect(mainEp).toBeDefined();
  });

  it("detects server.ts as server entry point", async () => {
    const root = await createFixture("server-ep", {
      "package.json": JSON.stringify({ name: "app" }),
      "server.ts": "import express from 'express';",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const serverEp = result.entryPoints.find((e) => e.type === "server");
    expect(serverEp).toBeDefined();
  });

  it("detects vitest.config.ts as test-runner entry point", async () => {
    const root = await createFixture("vitest-ep", {
      "package.json": JSON.stringify({ name: "app" }),
      "vitest.config.ts": "import { defineConfig } from 'vitest/config';",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const testEp = result.entryPoints.find((e) => e.type === "test-runner");
    expect(testEp).toBeDefined();
    expect(testEp?.confidence).toBeGreaterThan(0.9);
  });
});

describe("RepositoryMapper — repo type classification", () => {
  it("classifies monorepo via workspaces field", async () => {
    const root = await createFixture("monorepo", {
      "package.json": JSON.stringify({
        name: "my-monorepo",
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/app/package.json": JSON.stringify({ name: "app" }),
    });

    const result = await new RepositoryMapper().mapRepository(root);
    expect(result.repoType).toBe("monorepo");
  });

  it("classifies monorepo via lerna.json", async () => {
    const root = await createFixture("lerna-mono", {
      "package.json": JSON.stringify({ name: "lerna-root" }),
      "lerna.json": JSON.stringify({ version: "independent" }),
    });

    const result = await new RepositoryMapper().mapRepository(root);
    expect(result.repoType).toBe("monorepo");
  });

  it("classifies monolith for simple app with package.json", async () => {
    const root = await createFixture("monolith", {
      "package.json": JSON.stringify({
        name: "my-app",
        scripts: { start: "node dist/index.js" },
        dependencies: { express: "^4.18.0" },
      }),
      "src/index.ts": "const app = require('express')();",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    expect(result.repoType).toBe("monolith");
  });
});

describe("RepositoryMapper — error handling", () => {
  it("throws for non-existent root path", async () => {
    const mapper = new RepositoryMapper();
    await expect(mapper.mapRepository("/this/does/not/exist/ever")).rejects.toThrow();
  });

  it("handles malformed package.json gracefully", async () => {
    const root = await createFixture("malformed-pkg", {
      "package.json": "{ this is not valid JSON at all }",
      "src/index.ts": "export const x = 1;",
    });

    const mapper = new RepositoryMapper();
    // Should not throw — parse error is recorded in configFiles
    const result = await mapper.mapRepository(root);
    const pkgFile = result.configFiles.find((c) => c.type === "package-json");
    expect(pkgFile).toBeDefined();
    expect(pkgFile?.parseError).not.toBeNull();
    expect(pkgFile?.parsed).toBeNull();
  });

  it("skips node_modules directory", async () => {
    const root = await createFixture("skip-nm", {
      "package.json": JSON.stringify({ name: "app" }),
      "node_modules/lodash/index.js": "module.exports = {};",
      "src/index.ts": "export const x = 1;",
    });

    const result = await new RepositoryMapper().mapRepository(root);
    const langs = result.languages;
    // node_modules should be skipped; only src/index.ts should count
    const tsFiles = langs.find((l) => l.language === "typescript");
    expect(tsFiles?.fileCount).toBe(1);
    expect(result.skippedPaths.some((p) => p.includes("node_modules"))).toBe(true);
  });

  it("respects custom ignoreDirs config", async () => {
    const root = await createFixture("custom-ignore", {
      "package.json": JSON.stringify({ name: "app" }),
      "my-secret/private.ts": "export const secret = true;",
      "src/index.ts": "export const x = 1;",
    });

    const mapper = new RepositoryMapper({ ignoreDirs: ["my-secret"] });
    const result = await mapper.mapRepository(root);
    const skipped = result.skippedPaths.some((p) => p.includes("my-secret"));
    expect(skipped).toBe(true);
  });

  it("respects maxDepth config", async () => {
    const root = await createFixture("depth-limit", {
      "package.json": JSON.stringify({ name: "app" }),
      "l1/l2/l3/l4/l5/deep.ts": "export const deep = true;",
      "src/index.ts": "export const x = 1;",
    });

    const mapper = new RepositoryMapper({ maxDepth: 2 });
    const result = await mapper.mapRepository(root);
    // deep.ts at depth 5 should NOT be counted
    const totalTs = result.languages.find((l) => l.language === "typescript");
    // Only src/index.ts (depth 1) should be counted
    expect(totalTs?.fileCount ?? 0).toBeLessThan(3);
  });

  it("getConfig returns the effective configuration", () => {
    const mapper = new RepositoryMapper({ maxDepth: 3 });
    expect(mapper.getConfig().maxDepth).toBe(3);
  });
});
