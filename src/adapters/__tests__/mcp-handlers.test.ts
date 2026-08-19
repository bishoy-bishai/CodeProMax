/**
 * @file mcp-handlers.test.ts
 * @description Unit tests for the MCP tool handlers: successful pass-through
 * to CommandHandler, and ValidationError/generic-error mapping into the
 * McpToolResponse envelope.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { CommandHandler } from "../../commands/command-handler.ts";
import { AnalysisPipeline } from "../../core/analysis-pipeline.ts";
import { RegisterManager } from "../../commands/register-manager.ts";
import { FileManager } from "../../commands/file-manager.ts";
import {
  handleBuildInitiative,
  handleFindInitiatives,
  handleGetStatus,
  handleHelp,
  handleReAnalyze,
  handleReviewInitiatives,
  handleUpdateInitiative,
} from "../mcp-handlers.ts";
import type { Initiative, ScoringBreakdown } from "../../schemas/types.ts";
import type { AnalysisResult, RankedInitiativeWithDetails } from "../../services/types.ts";

const root = join(process.cwd(), ".tmp-mcp-handlers-test");
const NOW = new Date().toISOString();

function computeFinalScore(b: ScoringBreakdown): number {
  return Math.round(((b.impact + b.confidence + b.urgency + b.leverage + (6 - b.cost) + (6 - b.risk)) / 30) * 100);
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  const breakdown: ScoringBreakdown = { impact: 4, confidence: 4, urgency: 3, leverage: 3, cost: 2, risk: 2 };
  return {
    id: "INIT-500" as `INIT-${string}`,
    slug: "mcp-target",
    name: "MCP Target Initiative",
    status: "Proposed",
    problemStatement: { description: "A problem", severity: "High", evidenceRefs: ["a.ts:1"] },
    opportunity: { description: "An opportunity", successCriteria: ["Criterion"], scope: ["Scope A"], nonScope: ["Non-scope A"] },
    evidence: [{ source: "a.ts", type: "code", location: null, content: "evidence", timestamp: NOW, validated: true, validatedAt: NOW }],
    scoring: { breakdown, finalScore: computeFinalScore(breakdown), scoreConfidence: "High", decisionTrace: "trace", derivationRules: "rule" },
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
  const rankedInitiatives: RankedInitiativeWithDetails[] = initiatives.map((initiative, i) => ({
    rank: i + 1,
    initiativeId: initiative.id,
    initiativeSlug: initiative.slug,
    finalScore: initiative.scoring.finalScore,
    scoreConfidence: initiative.scoring.scoreConfidence,
    tiebreakReason: null,
    initiative,
  }));
  return {
    analysisId: "analysis-mcp-test",
    repositoryPath: "/fake/repo",
    status: "COMPLETE",
    startedAt: NOW,
    completedAt: NOW,
    durationMs: 5,
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

describe("handleFindInitiatives", () => {
  it("returns success:true with the real FindResult shape", async () => {
    const handler = makeHandler([makeInitiative()]);
    const response = await handleFindInitiatives(handler, { num_initiatives: 1 }, root);
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.initiatives).toHaveLength(1);
      expect(response.data.initiatives[0]?.id).toBe("INIT-500");
    }
  });

  it("maps N-out-of-range ValidationError into a structured failure", async () => {
    const handler = makeHandler([]);
    const response = await handleFindInitiatives(handler, { num_initiatives: 99 as never }, root);
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.message).toMatch(/between 1 and 10/);
      expect(response.error.details).not.toBeNull();
    }
  });

  it("falls back to the default repo path when none is given", async () => {
    const handler = makeHandler([makeInitiative()]);
    const response = await handleFindInitiatives(handler, { num_initiatives: 1 }, root);
    expect(response.success).toBe(true);
  });
});

describe("handleBuildInitiative", () => {
  it("returns a structured failure for an unknown initiative", async () => {
    const handler = makeHandler([]);
    const response = await handleBuildInitiative(handler, { initiative_id: "INIT-999" });
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.message).toMatch(/not found/);
    }
  });

  it("builds documents for a known initiative", async () => {
    const init = makeInitiative({ openQuestions: [] });
    const handler = makeHandler([init]);
    await handleFindInitiatives(handler, { num_initiatives: 1 }, root);

    const response = await handleBuildInitiative(handler, { initiative_id: init.id });
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.filesCreated.length).toBeGreaterThan(0);
    }
  });
});

describe("handleReviewInitiatives", () => {
  it("returns an empty issue list for a fresh, empty register", async () => {
    const handler = makeHandler([]);
    const response = await handleReviewInitiatives(handler, {});
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.initiativeCount).toBe(0);
    }
  });
});

describe("handleReAnalyze", () => {
  it("reports the register as fully new on first analysis", async () => {
    const init = makeInitiative();
    const handler = makeHandler([init]);
    const response = await handleReAnalyze(handler, {}, root);
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.newInitiatives).toBe(1);
    }
  });
});

describe("handleUpdateInitiative", () => {
  it("fails with a helpful message when the initiative isn't registered", async () => {
    const handler = makeHandler([]);
    const response = await handleUpdateInitiative(handler, { initiative_id: "INIT-999" }, root);
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.message).toMatch(/not found/);
    }
  });
});

describe("handleGetStatus", () => {
  it("summarizes an empty register", async () => {
    const registerManager = new RegisterManager(new FileManager(), root);
    await registerManager.create([]);
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });

    const response = await handleGetStatus(handler, {});
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.totalInitiatives).toBe(0);
      expect(response.data.topOpportunity).toBeNull();
    }
  });
});

describe("handleHelp", () => {
  it("returns all seven underlying commands even though only 6 are registered as MCP tools", () => {
    const handler = makeHandler([]);
    const response = handleHelp(handler);
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.commands).toHaveLength(7);
    }
  });
});
