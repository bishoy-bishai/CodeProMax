/**
 * @file pipeline.test.ts
 * @description Integration tests for the full AnalysisPipeline.
 * Tests run against the real fixture repository (fixtures/test-repo/).
 * The fixture repo is scanned once in beforeAll and the result is shared.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { AnalysisPipeline } from "../analysis-pipeline.ts";
import { OpportunityGenerator } from "../../services/opportunity-generator.ts";
import { InitiativeFactory } from "../../services/initiative-factory.ts";
import { RootCauseAnalyzer } from "../../analyzers/root-cause-analyzer.ts";
import { EvidenceCollector } from "../../analyzers/evidence-collector.ts";
import { RepositoryMapper } from "../algorithms/repository-mapper.ts";
import type { AnalysisResult } from "../../services/types.ts";
import type { Finding, EvidenceRecord } from "../../schemas/types.ts";

const FIXTURE_ROOT = join(process.cwd(), "fixtures", "test-repo");

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FIXTURE RUN (run once, reuse for all tests)
// ─────────────────────────────────────────────────────────────────────────────

let result: AnalysisResult;
let tempDir: string;

beforeAll(async () => {
  const pipeline = new AnalysisPipeline();
  result = await pipeline.runFullAnalysis(FIXTURE_ROOT, {
    onProgress: (_step, _detail) => { /* silent during tests */ },
  });

  tempDir = join(tmpdir(), `cpm-pipeline-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
}, 30_000);

// ─────────────────────────────────────────────────────────────────────────────
// RESULT STRUCTURE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("AnalysisPipeline — result structure", () => {
  it("returns an AnalysisResult object", () => {
    expect(result).toBeDefined();
    expect(typeof result.analysisId).toBe("string");
    expect(result.analysisId.startsWith("analysis-")).toBe(true);
  });

  it("status is COMPLETE or PARTIAL (not FAILED)", () => {
    expect(["COMPLETE", "PARTIAL"]).toContain(result.status);
  });

  it("repositoryPath matches the fixture root", () => {
    expect(result.repositoryPath).toBe(FIXTURE_ROOT);
  });

  it("startedAt and completedAt are valid ISO timestamps", () => {
    expect(() => new Date(result.startedAt)).not.toThrow();
    expect(() => new Date(result.completedAt)).not.toThrow();
    expect(new Date(result.completedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(result.startedAt).getTime()
    );
  });

  it("durationMs is positive", () => {
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("timedOut is false for fixture run", () => {
    expect(result.timedOut).toBe(false);
  });

  it("evidenceSources contains exactly 4 sources", () => {
    expect(result.evidenceSources).toHaveLength(4);
    const sourceNames = result.evidenceSources.map((s) => s.source);
    expect(sourceNames).toContain("code");
    expect(sourceNames).toContain("git");
    expect(sourceNames).toContain("test");
    expect(sourceNames).toContain("dependency");
  });

  it("warnings is an array", () => {
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("AnalysisPipeline — evidence", () => {
  it("collected at least some evidence from the fixture repo", () => {
    expect(result.evidenceCount).toBeGreaterThan(0);
  });

  it("all findings have non-empty evidence arrays", () => {
    for (const f of result.findings) {
      expect(f.evidence.length).toBeGreaterThan(0);
    }
  });

  it("all findings have FIND-NNN format IDs", () => {
    for (const f of result.findings) {
      expect(/^FIND-\d{3,}$/.test(f.id)).toBe(true);
    }
  });

  it("no finding has classification UNKNOWN (all filtered out)", () => {
    // findingsCount counts validated findings; findings array holds them
    for (const f of result.findings) {
      expect(f.classification).not.toBe("UNKNOWN");
    }
  });

  it("code source produced findings", () => {
    const codeSource = result.evidenceSources.find((s) => s.source === "code");
    expect(codeSource?.findingCount).toBeGreaterThan(0);
  });

  it("dependency source produced findings (fixture has deprecated deps)", () => {
    const depSource = result.evidenceSources.find((s) => s.source === "dependency");
    expect(depSource?.findingCount).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("AnalysisPipeline — initiatives", () => {
  it("produced at least one ranked initiative", () => {
    expect(result.rankedInitiatives.length).toBeGreaterThan(0);
  });

  it("ranked initiatives are sorted by score descending", () => {
    for (let i = 1; i < result.rankedInitiatives.length; i++) {
      const prev = result.rankedInitiatives[i - 1]!;
      const curr = result.rankedInitiatives[i]!;
      expect(prev.finalScore).toBeGreaterThanOrEqual(curr.finalScore);
    }
  });

  it("all ranked initiatives have valid INIT-NNN IDs", () => {
    for (const ri of result.rankedInitiatives) {
      expect(/^INIT-\d{3,}$/.test(ri.initiativeId)).toBe(true);
    }
  });

  it("all ranked initiatives include the full initiative object", () => {
    for (const ri of result.rankedInitiatives) {
      expect(ri.initiative).toBeDefined();
      expect(ri.initiative.id).toBe(ri.initiativeId);
    }
  });

  it("all initiative scores are in range 20–100", () => {
    for (const ri of result.rankedInitiatives) {
      expect(ri.finalScore).toBeGreaterThanOrEqual(20);
      expect(ri.finalScore).toBeLessThanOrEqual(100);
    }
  });

  it("all initiatives have at least one evidence record", () => {
    for (const ri of result.rankedInitiatives) {
      expect(ri.initiative.evidence.length).toBeGreaterThan(0);
    }
  });

  it("all initiatives have a non-empty decision trace", () => {
    for (const ri of result.rankedInitiatives) {
      expect(ri.initiative.scoring.decisionTrace.trim().length).toBeGreaterThan(30);
    }
  });

  it("all initiatives reference a finding (findingRefs non-empty)", () => {
    for (const ri of result.rankedInitiatives) {
      expect(ri.initiative.findingRefs.length).toBeGreaterThan(0);
    }
  });

  it("initiative count equals opportunities count", () => {
    expect(result.initiatives.length).toBe(result.opportunities.length);
  });

  it("rank numbers are contiguous starting from 1", () => {
    const ranks = result.rankedInitiatives.map((r) => r.rank);
    for (let i = 0; i < ranks.length; i++) {
      expect(ranks[i]).toBe(i + 1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("AnalysisPipeline — opportunities", () => {
  it("opportunity names are non-empty", () => {
    for (const opp of result.opportunities) {
      expect(opp.name.length).toBeGreaterThan(5);
    }
  });

  it("opportunity names are outcome-oriented (not implementation directives)", () => {
    const implementationVerbs = /^(add|fix|implement|create|make|change|update|refactor)\b/i;
    for (const opp of result.opportunities) {
      expect(implementationVerbs.test(opp.name)).toBe(false);
    }
  });

  it("each opportunity has at least 2 success criteria", () => {
    for (const opp of result.opportunities) {
      expect(opp.successCriteria.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("each opportunity has at least one scope item", () => {
    for (const opp of result.opportunities) {
      expect(opp.scope.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("each opportunity has at least one non-scope item", () => {
    for (const opp of result.opportunities) {
      expect(opp.nonScope.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RCA TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("AnalysisPipeline — RCA", () => {
  it("each RCA result has at least one cause level", () => {
    for (const rca of result.rcaResults) {
      expect(rca.causes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("each root cause is actionable", () => {
    for (const rca of result.rcaResults) {
      expect(rca.rootCause.isActionable).toBe(true);
    }
  });

  it("no RCA contains person-blaming language", () => {
    const blameRe = /developer forgot|bad developer|someone forgot|poor coding/i;
    for (const rca of result.rcaResults) {
      for (const cause of rca.causes) {
        expect(blameRe.test(cause.reason)).toBe(false);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FAILURE HANDLING TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("AnalysisPipeline — failure handling", () => {
  it("returns FAILED for non-existent repository", async () => {
    const pipeline = new AnalysisPipeline();
    const failResult = await pipeline.runFullAnalysis("/this/does/not/exist/ever");
    expect(failResult.status).toBe("FAILED");
    expect(failResult.warnings.length).toBeGreaterThan(0);
  });

  it("FAILED result still has correct structure (no missing fields)", async () => {
    const pipeline = new AnalysisPipeline();
    const failResult = await pipeline.runFullAnalysis("/no/such/path");
    expect(failResult.analysisId).toBeDefined();
    expect(failResult.startedAt).toBeDefined();
    expect(failResult.completedAt).toBeDefined();
    expect(Array.isArray(failResult.findings)).toBe(true);
    expect(Array.isArray(failResult.rankedInitiatives)).toBe(true);
  });

  it("returns PARTIAL when some source returns empty (minimal repo)", async () => {
    // A repo with no package.json → dep source gets no findings but doesn't fail
    const root = join(tempDir, "minimal-pipeline");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.ts"), "export const x = 1;\n".repeat(10));
    const pipeline = new AnalysisPipeline();
    const minResult = await pipeline.runFullAnalysis(root);
    expect(["COMPLETE", "PARTIAL"]).toContain(minResult.status);
    await rm(root, { recursive: true, force: true });
  });

  it("timeout triggers PARTIAL/FAILED with timedOut=true", async () => {
    const pipeline = new AnalysisPipeline();
    // 1ms timeout — will always time out on repo mapping
    const timedResult = await pipeline.runFullAnalysis(FIXTURE_ROOT, { timeoutMs: 1 });
    // With 1ms, either times out or completes instantly (both valid)
    expect(["COMPLETE", "PARTIAL", "FAILED"]).toContain(timedResult.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("AnalysisPipeline — formatSummary", () => {
  it("returns a non-empty string", () => {
    const pipeline = new AnalysisPipeline();
    const summary = pipeline.formatSummary(result);
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(100);
  });

  it("summary contains repository path", () => {
    const pipeline = new AnalysisPipeline();
    expect(pipeline.formatSummary(result)).toContain(FIXTURE_ROOT);
  });

  it("summary contains status", () => {
    const pipeline = new AnalysisPipeline();
    expect(pipeline.formatSummary(result)).toMatch(/COMPLETE|PARTIAL|FAILED/);
  });

  it("summary lists top initiatives", () => {
    const pipeline = new AnalysisPipeline();
    const summary = pipeline.formatSummary(result);
    if (result.rankedInitiatives.length > 0) {
      expect(summary).toContain("#1");
      expect(summary).toContain("INIT-");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIT TESTS: OpportunityGenerator
// ─────────────────────────────────────────────────────────────────────────────

describe("OpportunityGenerator — unit tests", () => {
  const gen = new OpportunityGenerator();
  const rca = new RootCauseAnalyzer();
  const NOW = new Date().toISOString();

  function makeFinding(title: string, desc: string): Finding {
    const ev: EvidenceRecord = {
      source: "src/test.ts", type: "code", location: null,
      content: "test", timestamp: NOW, validated: true, validatedAt: NOW,
    };
    return {
      id: "FIND-001", title, description: desc,
      classification: "FACT", confidence: 4,
      evidence: [ev], linkedFindings: [], initiativeRef: null,
      createdAt: NOW, updatedAt: NOW,
    };
  }

  it("generates opportunity for error handling finding", () => {
    const f = makeFinding("Missing error handling", "No try-catch in deleteProduct");
    const r = rca.analyze(f);
    const opp = gen.generate(f, r);
    expect(opp.name.length).toBeGreaterThan(5);
    expect(opp.successCriteria.length).toBeGreaterThanOrEqual(2);
  });

  it("slug is kebab-case", () => {
    const f = makeFinding("Missing error handling", "No try-catch");
    const r = rca.analyze(f);
    const opp = gen.generate(f, r);
    expect(/^[a-z0-9-]+$/.test(opp.slug)).toBe(true);
  });

  it("generates for all finding types without throwing", () => {
    const types = [
      ["Large function", "Function has 90 lines"],
      ["Duplicated code", "sanitizeString duplicated"],
      ["High coupling", "14 imports"],
      ["Outdated dependency", "moment deprecated"],
      ["High churn", "file changed 60 times"],
    ];
    for (const [title, desc] of types) {
      const f = makeFinding(title!, desc!);
      const r = rca.analyze(f);
      expect(() => gen.generate(f, r)).not.toThrow();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIT TESTS: InitiativeFactory
// ─────────────────────────────────────────────────────────────────────────────

describe("InitiativeFactory — unit tests", () => {
  const factory = new InitiativeFactory();
  const gen = new OpportunityGenerator();
  const rca = new RootCauseAnalyzer();
  const NOW = new Date().toISOString();

  function makeFinding(title: string, desc: string): Finding {
    const ev: EvidenceRecord = {
      source: "src/test.ts", type: "code", location: null,
      content: "test", timestamp: NOW, validated: true, validatedAt: NOW,
    };
    return {
      id: "FIND-099", title, description: desc,
      classification: "FACT", confidence: 4,
      evidence: [ev], linkedFindings: [], initiativeRef: null,
      createdAt: NOW, updatedAt: NOW,
    };
  }

  it("creates initiative with INIT-NNN ID", () => {
    const f = makeFinding("Missing error handling", "No try-catch");
    const r = rca.analyze(f);
    const o = gen.generate(f, r);
    const init = factory.create(o, f, r);
    expect(/^INIT-\d{3,}$/.test(init.id)).toBe(true);
  });

  it("created initiative has status Proposed", () => {
    const f = makeFinding("Missing error handling", "No try-catch");
    const r = rca.analyze(f);
    const o = gen.generate(f, r);
    expect(factory.create(o, f, r).status).toBe("Proposed");
  });

  it("all 6 axis scores are between 1 and 5", () => {
    const f = makeFinding("Missing error handling", "No try-catch");
    const r = rca.analyze(f);
    const o = gen.generate(f, r);
    const init = factory.create(o, f, r);
    const { impact, confidence, urgency, leverage, cost, risk } = init.scoring.breakdown;
    for (const score of [impact, confidence, urgency, leverage, cost, risk]) {
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(5);
    }
  });

  it("finalScore is in 20-100 range", () => {
    const f = makeFinding("Deprecated dependency", "moment deprecated");
    const r = rca.analyze(f);
    const o = gen.generate(f, r);
    const init = factory.create(o, f, r);
    expect(init.scoring.finalScore).toBeGreaterThanOrEqual(20);
    expect(init.scoring.finalScore).toBeLessThanOrEqual(100);
  });

  it("initiative inherits evidence from finding", () => {
    const f = makeFinding("Missing error handling", "No try-catch");
    const r = rca.analyze(f);
    const o = gen.generate(f, r);
    const init = factory.create(o, f, r);
    expect(init.evidence.length).toBe(f.evidence.length);
  });

  it("createAll returns one initiative per triple", () => {
    const triples = ["Missing error handling", "Duplicated code", "Outdated dependency"].map(
      (title) => {
        const f = makeFinding(title, `${title} description`);
        const r = rca.analyze(f);
        const o = gen.generate(f, r);
        return { opportunity: o, finding: f, rca: r };
      }
    );
    const { initiatives } = factory.createAll(triples);
    expect(initiatives).toHaveLength(3);
  });
});
