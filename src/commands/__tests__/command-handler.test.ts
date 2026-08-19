/**
 * @file command-handler.test.ts
 * @description Integration tests for CommandHandler. The analysis pipeline
 * is stubbed with canned AnalysisResults (repository scanning is already
 * covered by the pipeline's own tests) so these tests focus on command
 * orchestration: file writes, register persistence, state transitions, and
 * the review/status/re-analyze/update reconciliation logic.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { CommandHandler } from "../command-handler.ts";
import { AnalysisPipeline } from "../../core/analysis-pipeline.ts";
import { FileManager } from "../file-manager.ts";
import { RegisterManager } from "../register-manager.ts";
import { techSpecDocPath } from "../paths.ts";
import type { Initiative, ScoringBreakdown } from "../../schemas/types.ts";
import type { AnalysisResult, RankedInitiativeWithDetails } from "../../services/types.ts";

const root = join(process.cwd(), ".tmp-command-handler-test");
const NOW = new Date().toISOString();

/** finalScore = round((I+C+U+L+(6-Cost)+(6-Risk))/30 * 100) — must match ScoringResultSchema's cross-check */
function computeFinalScore(b: ScoringBreakdown): number {
  return Math.round(((b.impact + b.confidence + b.urgency + b.leverage + (6 - b.cost) + (6 - b.risk)) / 30) * 100);
}

function makeScoring(breakdown: ScoringBreakdown, overrides: Partial<Initiative["scoring"]> = {}): Initiative["scoring"] {
  return {
    breakdown,
    finalScore: computeFinalScore(breakdown),
    scoreConfidence: "High",
    decisionTrace: "trace",
    derivationRules: "rule",
    ...overrides,
  };
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: "INIT-100" as `INIT-${string}`,
    slug: "example-initiative",
    name: "Example Initiative",
    status: "Proposed",
    problemStatement: { description: "Errors are swallowed silently", severity: "High", evidenceRefs: ["a.ts:1"] },
    opportunity: {
      description: "Establish structured error handling.",
      successCriteria: ["MTTD reduced by 40%"],
      scope: ["Shared logger package"],
      nonScope: ["Storage migration"],
    },
    evidence: [
      { source: "a.ts", type: "code", location: null, content: "evidence", timestamp: NOW, validated: true, validatedAt: NOW },
    ],
    scoring: makeScoring({ impact: 4, confidence: 4, urgency: 3, leverage: 3, cost: 2, risk: 2 }),
    findingRefs: [],
    createdAt: NOW,
    updatedAt: NOW,
    owner: "alice",
    stakeholders: [],
    blockers: [],
    risks: [],
    dependencies: [],
    openQuestions: [],
    ...overrides,
  };
}

function makeAnalysisResult(initiatives: Initiative[]): AnalysisResult {
  const rankedInitiatives: RankedInitiativeWithDetails[] = initiatives
    .slice()
    .sort((a, b) => b.scoring.finalScore - a.scoring.finalScore)
    .map((initiative, i) => ({
      rank: i + 1,
      initiativeId: initiative.id,
      initiativeSlug: initiative.slug,
      finalScore: initiative.scoring.finalScore,
      scoreConfidence: initiative.scoring.scoreConfidence,
      tiebreakReason: null,
      initiative,
    }));

  return {
    analysisId: "analysis-test",
    repositoryPath: "/fake/repo",
    status: "COMPLETE",
    startedAt: NOW,
    completedAt: NOW,
    durationMs: 10,
    timedOut: false,
    evidenceSources: [],
    evidenceCount: initiatives.reduce((n, i) => n + i.evidence.length, 0),
    findings: [],
    rcaResults: [],
    findingsCount: 0,
    opportunities: [],
    initiatives,
    rankedInitiatives,
    initiativesCount: initiatives.length,
    warnings: [],
  };
}

class StubPipeline extends AnalysisPipeline {
  constructor(private readonly result: AnalysisResult) {
    super();
  }
  override async runFullAnalysis(): Promise<AnalysisResult> {
    return this.result;
  }
}

beforeEach(async () => {
  await mkdir(root, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function makeHandler(initiatives: Initiative[]): CommandHandler {
  return new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult(initiatives)) });
}

describe("CommandHandler.find", () => {
  it("rejects N outside 1-10", async () => {
    const handler = makeHandler([makeInitiative()]);
    await expect(handler.find(0, "/fake/repo")).rejects.toThrow(/between 1 and 10/);
    await expect(handler.find(11, "/fake/repo")).rejects.toThrow(/between 1 and 10/);
  });

  it("persists the full register but only writes docs for the top N", async () => {
    const a = makeInitiative({ id: "INIT-101" as `INIT-${string}`, slug: "a", scoring: makeScoring({ impact: 5, confidence: 5, urgency: 5, leverage: 5, cost: 1, risk: 1 }) });
    const b = makeInitiative({ id: "INIT-102" as `INIT-${string}`, slug: "b", scoring: makeScoring({ impact: 2, confidence: 2, urgency: 2, leverage: 2, cost: 4, risk: 4 }, { scoreConfidence: "Low" }) });

    const handler = makeHandler([a, b]);
    const result = await handler.find(1, "/fake/repo");

    expect(result.initiatives).toHaveLength(1);
    expect(result.initiatives[0]?.id).toBe("INIT-101");
    expect(result.filesCreated).toHaveLength(1);

    const register = new RegisterManager(new FileManager(), root);
    const all = await register.loadAll();
    expect(all).toHaveLength(2);
  });
});

describe("CommandHandler.build", () => {
  it("throws when the initiative is not in the register", async () => {
    const handler = makeHandler([]);
    await expect(handler.build("INIT-999" as `INIT-${string}`)).rejects.toThrow(/not found/);
  });

  it("generates all four documents and advances status when guards pass", async () => {
    const init = makeInitiative({ openQuestions: [] });
    const handler = makeHandler([init]);
    await handler.find(1, "/fake/repo");

    const result = await handler.build(init.id);

    expect(result.consistencyValid).toBe(true);
    expect(result.filesCreated.some((f) => f.endsWith("initiative.md"))).toBe(true);
    expect(result.filesCreated.some((f) => f.endsWith("epic.md"))).toBe(true);
    expect(result.filesCreated.some((f) => f.endsWith("tech-spec.md"))).toBe(true);
    expect(result.ticketCount).toBeGreaterThan(0);
    expect(result.finalStatus).toBe("Planned");
    expect(result.transitionWarnings).toEqual([]);
  });

  it("stops advancing at the first failed guard and reports why", async () => {
    const init = makeInitiative({
      openQuestions: [{ question: "Who owns rollout?", assignee: "bob", dueBy: null, answer: null, resolvedAt: null }],
    });
    const handler = makeHandler([init]);
    await handler.find(1, "/fake/repo");

    const result = await handler.build(init.id);

    expect(result.finalStatus).toBe("Selected");
    expect(result.transitionWarnings.length).toBeGreaterThan(0);
    expect(result.transitionWarnings[0]).toContain("Selected");
  });
});

describe("CommandHandler.review", () => {
  it("flags stale initiatives and duplicate problem statements", async () => {
    const staleDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const stale = makeInitiative({
      id: "INIT-200" as `INIT-${string}`,
      slug: "stale",
      createdAt: staleDate,
      updatedAt: staleDate,
    });
    const dup1 = makeInitiative({ id: "INIT-201" as `INIT-${string}`, slug: "dup1", problemStatement: { description: "Same problem", severity: "High", evidenceRefs: [] } });
    const dup2 = makeInitiative({ id: "INIT-202" as `INIT-${string}`, slug: "dup2", problemStatement: { description: "Same problem", severity: "High", evidenceRefs: [] } });

    const registerManager = new RegisterManager(new FileManager(), root);
    await registerManager.create([stale, dup1, dup2]);

    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const result = await handler.review();

    expect(result.issues.some((i) => i.initiativeId === "INIT-200" && i.issue.includes("stale"))).toBe(true);
    expect(result.issues.some((i) => i.initiativeId === "INIT-202" && i.issue.includes("duplicate"))).toBe(true);
  });

  it("flags a Planned initiative with no tech spec on disk", async () => {
    const planned = makeInitiative({ status: "Planned" });
    const registerManager = new RegisterManager(new FileManager(), root);
    await registerManager.create([planned]);

    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const result = await handler.review();

    expect(result.issues.some((i) => i.issue.includes("Tech spec missing"))).toBe(true);
  });

  it("does not flag a Planned initiative once its tech spec exists", async () => {
    const planned = makeInitiative({ status: "Planned" });
    const registerManager = new RegisterManager(new FileManager(), root);
    await registerManager.create([planned]);
    await new FileManager().write(techSpecDocPath(root, planned.slug), "# spec");

    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const result = await handler.review();

    expect(result.issues.some((i) => i.issue.includes("Tech spec missing"))).toBe(false);
  });
});

describe("CommandHandler.status", () => {
  it("summarizes totals and the top Proposed opportunity", async () => {
    const low = makeInitiative({ id: "INIT-300" as `INIT-${string}`, slug: "low", scoring: makeScoring({ impact: 2, confidence: 2, urgency: 2, leverage: 2, cost: 4, risk: 4 }, { scoreConfidence: "Low" }) });
    const high = makeInitiative({ id: "INIT-301" as `INIT-${string}`, slug: "high", scoring: makeScoring({ impact: 5, confidence: 5, urgency: 5, leverage: 5, cost: 1, risk: 1 }) });

    const registerManager = new RegisterManager(new FileManager(), root);
    await registerManager.create([low, high]);

    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const result = await handler.status();

    expect(result.totalInitiatives).toBe(2);
    expect(result.topOpportunity?.id).toBe("INIT-301");
  });

  it("reports no top opportunity when the register is empty", async () => {
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const result = await handler.status();
    expect(result.totalInitiatives).toBe(0);
    expect(result.topOpportunity).toBeNull();
  });
});

describe("CommandHandler.reAnalyze", () => {
  it("classifies new, resolved, changed, and unchanged initiatives", async () => {
    const persisting = makeInitiative({ id: "INIT-400" as `INIT-${string}`, slug: "persisting", problemStatement: { description: "Persisting problem", severity: "High", evidenceRefs: [] } });
    const resolved = makeInitiative({ id: "INIT-401" as `INIT-${string}`, slug: "resolved", problemStatement: { description: "Resolved problem", severity: "High", evidenceRefs: [] } });

    const registerManager = new RegisterManager(new FileManager(), root);
    await registerManager.create([persisting, resolved]);

    const persistingChanged: Initiative = {
      ...persisting,
      scoring: makeScoring({ ...persisting.scoring.breakdown, urgency: 5 }),
    };
    const brandNew = makeInitiative({ id: "INIT-402" as `INIT-${string}`, slug: "brand-new", problemStatement: { description: "Brand new problem", severity: "High", evidenceRefs: [] } });

    const handler = new CommandHandler(root, {
      pipeline: new StubPipeline(makeAnalysisResult([persistingChanged, brandNew])),
    });

    const result = await handler.reAnalyze("/fake/repo");

    expect(result.newInitiatives).toBe(1);
    expect(result.resolvedInitiatives).toBe(1);
    expect(result.changedScores).toBe(1);
    expect(result.changedDetails[0]?.id).toBe("INIT-400");
    expect(result.changedDetails[0]?.newScore).toBe(computeFinalScore({ impact: 4, confidence: 4, urgency: 5, leverage: 3, cost: 2, risk: 2 }));
  });
});

describe("CommandHandler.update", () => {
  it("refreshes evidence and score when a matching finding still exists", async () => {
    const init = makeInitiative();
    const registerManager = new RegisterManager(new FileManager(), root);
    await registerManager.create([init]);

    const refreshed: Initiative = { ...init, scoring: makeScoring({ ...init.scoring.breakdown, urgency: 5, leverage: 5 }) };
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([refreshed])) });

    const result = await handler.update(init.id, "/fake/repo");

    expect(result.previousScore).toBe(computeFinalScore({ impact: 4, confidence: 4, urgency: 3, leverage: 3, cost: 2, risk: 2 }));
    expect(result.newScore).toBe(computeFinalScore({ impact: 4, confidence: 4, urgency: 5, leverage: 5, cost: 2, risk: 2 }));
    expect(result.scoreChanged).toBe(true);
  });

  it("throws when the finding no longer appears in a fresh analysis", async () => {
    const init = makeInitiative();
    const registerManager = new RegisterManager(new FileManager(), root);
    await registerManager.create([init]);

    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    await expect(handler.update(init.id, "/fake/repo")).rejects.toThrow(/No matching finding/);
  });
});

describe("CommandHandler.help", () => {
  it("lists all seven commands", () => {
    const handler = makeHandler([]);
    const result = handler.help();
    expect(result.commands).toHaveLength(7);
    expect(result.commands.map((c) => c.name)).toContain("/codepro find N");
  });
});
