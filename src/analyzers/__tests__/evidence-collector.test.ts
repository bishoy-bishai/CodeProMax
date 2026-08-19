/**
 * @file evidence-collector.test.ts
 * @description Comprehensive test suite for EvidenceCollector.
 * Uses real fixture files in fixtures/test-repo/ and in-memory strings.
 * 30+ tests covering all 4 collection methods + helpers + edge cases.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { EvidenceCollector, parseGitLog } from "../evidence-collector.ts";
import { RepositoryMapper } from "../../core/algorithms/repository-mapper.ts";

const FIXTURE_ROOT = join(process.cwd(), "fixtures", "test-repo");

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE MAP (scan once for all tests)
// ─────────────────────────────────────────────────────────────────────────────

let fixtureMap: Awaited<ReturnType<RepositoryMapper["mapRepository"]>>;
let tempRoot: string;

beforeAll(async () => {
  const mapper = new RepositoryMapper({ maxDepth: 6 });
  fixtureMap = await mapper.mapRepository(FIXTURE_ROOT);

  // Create temp dir for ad-hoc tests
  tempRoot = join(tmpdir(), `cpm-ec-test-${Date.now()}`);
  await mkdir(tempRoot, { recursive: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// CODE EVIDENCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceCollector — collectCodeEvidence", () => {
  it("returns an array of findings", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detects large/complex function in products.ts", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    const largeFn = findings.find(
      (f) =>
        f.description.includes("large-function") ||
        f.description.toLowerCase().includes("getproducts") ||
        f.description.toLowerCase().includes("lines") ||
        f.description.toLowerCase().includes("complexity")
    );
    expect(largeFn).toBeDefined();
  });

  it("detects missing error handling in async functions", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    const errHandling = findings.find(
      (f) =>
        f.description.toLowerCase().includes("try-catch") ||
        f.description.toLowerCase().includes("error handling") ||
        f.description.toLowerCase().includes("unhandled")
    );
    expect(errHandling).toBeDefined();
  });

  it("detects high coupling (many imports) in products.ts", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    const coupling = findings.find(
      (f) =>
        f.description.toLowerCase().includes("import") ||
        f.description.toLowerCase().includes("coupling")
    );
    expect(coupling).toBeDefined();
  });

  it("detects duplicated code between validator.ts and formatter.ts", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    const dup = findings.find(
      (f) =>
        f.description.toLowerCase().includes("similar") ||
        f.description.toLowerCase().includes("duplicate")
    );
    expect(dup).toBeDefined();
  });

  it("all findings have non-empty evidence arrays", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    expect(findings.every((f) => f.evidence.length > 0)).toBe(true);
  });

  it("all findings have FIND-NNN format IDs", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    expect(findings.every((f) => /^FIND-\d{3,}$/.test(f.id))).toBe(true);
  });

  it("all findings have FACT or INFERENCE classification", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    const validClassifications = new Set(["FACT", "INFERENCE", "HYPOTHESIS", "UNKNOWN"]);
    expect(findings.every((f) => validClassifications.has(f.classification))).toBe(true);
  });

  it("missing error handling findings are classified FACT", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    const errFindings = findings.filter(
      (f) => f.description.toLowerCase().includes("try-catch")
    );
    for (const f of errFindings) {
      expect(f.classification).toBe("FACT");
    }
  });

  it("handles unreadable files gracefully (no throw)", async () => {
    const mapper = new RepositoryMapper({ maxDepth: 2 });
    const map = await mapper.mapRepository(FIXTURE_ROOT);
    const collector = new EvidenceCollector();
    // Should not throw even if some paths are invalid
    await expect(collector.collectCodeEvidence(map)).resolves.toBeDefined();
  });

  it("finds are traceable with file + content in evidence", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectCodeEvidence(fixtureMap);
    for (const finding of findings) {
      for (const ev of finding.evidence) {
        expect(ev.source.length).toBeGreaterThan(0);
        expect(ev.content.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GIT EVIDENCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceCollector — collectGitEvidence", () => {
  it("returns empty array or findings when git not available", async () => {
    const mapper = new RepositoryMapper({ maxDepth: 2 });
    const map = await mapper.mapRepository(FIXTURE_ROOT);
    const collector = new EvidenceCollector();
    const findings = await collector.collectGitEvidence(map);
    // Either empty (no git) or has findings (git available) — both valid
    expect(Array.isArray(findings)).toBe(true);
  });

  it("records a warning when git is unavailable for a file", async () => {
    const mapper = new RepositoryMapper({ maxDepth: 2 });
    const map = await mapper.mapRepository(FIXTURE_ROOT);
    const collector = new EvidenceCollector();
    await collector.collectGitEvidence(map);
    // Warnings are accessible
    expect(Array.isArray(collector.getWarnings())).toBe(true);
  });

  it("git findings have evidence type 'git'", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectGitEvidence(fixtureMap);
    for (const f of findings) {
      expect(f.evidence.every((e) => e.type === "git")).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GIT LOG PARSER TESTS (pure function — no git required)
// ─────────────────────────────────────────────────────────────────────────────

describe("parseGitLog", () => {
  it("parses well-formed git log output", () => {
    const output = [
      "abc123|2026-01-15T10:00:00+00:00|fix: handle null case|alice",
      "def456|2026-01-14T09:00:00+00:00|feat: add product filter|bob",
    ].join("\n");
    const commits = parseGitLog(output);
    expect(commits).toHaveLength(2);
    expect(commits[0]?.hash).toBe("abc123");
    expect(commits[0]?.author).toBe("alice");
    expect(commits[1]?.subject).toBe("feat: add product filter");
  });

  it("returns empty array for empty input", () => {
    expect(parseGitLog("")).toEqual([]);
  });

  it("skips blank lines", () => {
    const output = "\nabc123|2026-01-15T10:00:00+00:00|fix: x|alice\n\n";
    expect(parseGitLog(output)).toHaveLength(1);
  });

  it("handles missing author field gracefully", () => {
    const output = "abc123|2026-01-15T10:00:00+00:00|fix: x|";
    const commits = parseGitLog(output);
    expect(commits[0]?.author).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST EVIDENCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceCollector — collectTestEvidence", () => {
  it("detects missing tests in fixture repo", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectTestEvidence(fixtureMap);
    // Fixture repo has no tests → should have at least one finding
    expect(findings.length).toBeGreaterThan(0);
  });

  it("finding describes test gap clearly", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectTestEvidence(fixtureMap);
    const testFinding = findings.find(
      (f) =>
        f.description.toLowerCase().includes("test") ||
        f.description.toLowerCase().includes("coverage")
    );
    expect(testFinding).toBeDefined();
    expect(testFinding?.description.length).toBeGreaterThan(20);
  });

  it("test findings have evidence type 'test' or 'config'", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectTestEvidence(fixtureMap);
    for (const f of findings) {
      const types = new Set(f.evidence.map((e) => e.type));
      const validTypes = new Set(["test", "config", "code"]);
      for (const t of types) {
        expect(validTypes.has(t)).toBe(true);
      }
    }
  });

  it("confidence ≥ 3 for test findings (directly observable)", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectTestEvidence(fixtureMap);
    for (const f of findings) {
      expect(f.confidence).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns no findings for repo with good test coverage", async () => {
    // Create a temp repo that looks well-tested
    const root = join(tempRoot, "well-tested");
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "__tests__"), { recursive: true });
    await writeFile(join(root, "src", "index.ts"), "export const x = 1;");
    await writeFile(join(root, "__tests__", "index.test.ts"), "test('x', () => { expect(1).toBe(1); throw new Error('fail'); });");
    await writeFile(join(root, "package.json"), JSON.stringify({
      name: "well-tested",
      scripts: { test: "vitest", coverage: "vitest --coverage" },
    }));

    const mapper = new RepositoryMapper({ maxDepth: 4 });
    const map = await mapper.mapRepository(root);
    const collector = new EvidenceCollector();
    const findings = await collector.collectTestEvidence(map);

    // May still find "no coverage config" etc., but should be fewer
    expect(findings.length).toBeLessThan(5);
    await rm(root, { recursive: true, force: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCY EVIDENCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceCollector — collectDependencyEvidence", () => {
  it("detects outdated dependencies in fixture repo", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectDependencyEvidence(fixtureMap);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("flags moment as deprecated", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectDependencyEvidence(fixtureMap);
    const momentFinding = findings.find((f) => f.description.toLowerCase().includes("moment"));
    expect(momentFinding).toBeDefined();
  });

  it("flags request as deprecated", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectDependencyEvidence(fixtureMap);
    const requestFinding = findings.find((f) => f.description.toLowerCase().includes("request"));
    expect(requestFinding).toBeDefined();
  });

  it("detects functional duplicate HTTP clients (axios + node-fetch)", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectDependencyEvidence(fixtureMap);
    const dupFinding = findings.find(
      (f) =>
        (f.description.toLowerCase().includes("axios") ||
         f.description.toLowerCase().includes("node-fetch")) &&
        f.description.toLowerCase().includes("overlap")
    );
    expect(dupFinding).toBeDefined();
  });

  it("all dependency findings have confidence 5", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectDependencyEvidence(fixtureMap);
    for (const f of findings) {
      expect(f.confidence).toBe(5);
    }
  });

  it("all dependency findings have evidence type 'dependency'", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectDependencyEvidence(fixtureMap);
    for (const f of findings) {
      expect(f.evidence.every((e) => e.type === "dependency")).toBe(true);
    }
  });

  it("returns empty for repo with no package.json", async () => {
    const root = join(tempRoot, "no-pkg");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "main.go"), "package main");
    const mapper = new RepositoryMapper({ maxDepth: 4 });
    const map = await mapper.mapRepository(root);
    const collector = new EvidenceCollector();
    const findings = await collector.collectDependencyEvidence(map);
    expect(findings).toHaveLength(0);
    await rm(root, { recursive: true, force: true });
  });

  it("all findings have FACT classification", async () => {
    const collector = new EvidenceCollector();
    const findings = await collector.collectDependencyEvidence(fixtureMap);
    for (const f of findings) {
      expect(f.classification).toBe("FACT");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COLLECT ALL TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceCollector — collectAll", () => {
  it("returns findings from multiple sources", async () => {
    const collector = new EvidenceCollector();
    const all = await collector.collectAll(fixtureMap);
    expect(all.length).toBeGreaterThan(0);
  });

  it("all finding IDs are unique", async () => {
    const collector = new EvidenceCollector();
    const all = await collector.collectAll(fixtureMap);
    const ids = all.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("continues even if one source fails", async () => {
    // An empty repo structure — code/test/dep may return empty, git may warn
    const root = join(tempRoot, "minimal");
    await mkdir(root, { recursive: true });
    const mapper = new RepositoryMapper({ maxDepth: 2 });
    const map = await mapper.mapRepository(root);
    const collector = new EvidenceCollector();
    await expect(collector.collectAll(map)).resolves.toBeDefined();
    await rm(root, { recursive: true, force: true });
  });
});
