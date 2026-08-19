/**
 * @file mcp-server.test.ts
 * @description End-to-end MCP protocol test: a real Client and a real
 * McpServer (with a stubbed CommandHandler pipeline) talking over
 * InMemoryTransport — verifies tool discovery and tool-call round-trips
 * through the actual MCP wire format, not just the handler functions.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../mcp-server.ts";
import { CommandHandler } from "../../commands/command-handler.ts";
import { AnalysisPipeline } from "../../core/analysis-pipeline.ts";
import type { Initiative, ScoringBreakdown } from "../../schemas/types.ts";
import type { AnalysisResult, RankedInitiativeWithDetails } from "../../services/types.ts";

const root = join(process.cwd(), ".tmp-mcp-server-test");
const NOW = new Date().toISOString();

function computeFinalScore(b: ScoringBreakdown): number {
  return Math.round(((b.impact + b.confidence + b.urgency + b.leverage + (6 - b.cost) + (6 - b.risk)) / 30) * 100);
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  const breakdown: ScoringBreakdown = { impact: 4, confidence: 4, urgency: 3, leverage: 3, cost: 2, risk: 2 };
  return {
    id: "INIT-600" as `INIT-${string}`,
    slug: "e2e-target",
    name: "End To End Target",
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
    analysisId: "analysis-e2e",
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

async function connectedClient(commandHandler: CommandHandler): Promise<{ client: Client; server: ReturnType<typeof createServer> }> {
  const server = createServer(root, commandHandler);
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

beforeEach(async () => {
  await mkdir(root, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("MCP server — tool discovery", () => {
  it("registers exactly the 6 documented tools", async () => {
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const { client } = await connectedClient(handler);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual(
      ["build_initiative", "find_initiatives", "get_status", "re_analyze", "review_initiatives", "update_initiative"].sort()
    );
  });

  it("every tool has a non-empty description", async () => {
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const { client } = await connectedClient(handler);

    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(20);
    }
  });
});

describe("MCP server — tool calls", () => {
  it("find_initiatives round-trips through the real protocol", async () => {
    const init = makeInitiative();
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([init])) });
    const { client } = await connectedClient(handler);

    const result = await client.callTool({ name: "find_initiatives", arguments: { num_initiatives: 1 } });
    expect(result.isError).toBeFalsy();

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text) as { success: boolean; data: { initiatives: Initiative[] } };
    expect(parsed.success).toBe(true);
    expect(parsed.data.initiatives).toHaveLength(1);
    expect(parsed.data.initiatives[0]?.id).toBe("INIT-600");
  });

  it("build_initiative on an unknown ID surfaces isError:true with the real ValidationError message", async () => {
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const { client } = await connectedClient(handler);

    const result = await client.callTool({ name: "build_initiative", arguments: { initiative_id: "INIT-999" } });
    expect(result.isError).toBe(true);

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text) as { success: boolean; error: { message: string } };
    expect(parsed.success).toBe(false);
    expect(parsed.error.message).toMatch(/INIT-999 not found/);
  });

  it("a malformed initiative_id is rejected by schema validation before the handler runs", async () => {
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const { client } = await connectedClient(handler);

    const result = await client.callTool({ name: "build_initiative", arguments: { initiative_id: "not-valid" } });
    expect(result.isError).toBe(true);

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toMatch(/Invalid arguments for tool build_initiative/);
    // The handler never runs — this is MCP-SDK-level schema rejection, not our ValidationError envelope.
    expect(() => JSON.parse(content[0]!.text)).toThrow();
  });

  it("get_status reflects a populated register", async () => {
    const init = makeInitiative();
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([init])) });
    const { client } = await connectedClient(handler);

    await client.callTool({ name: "find_initiatives", arguments: { num_initiatives: 1 } });
    const result = await client.callTool({ name: "get_status", arguments: {} });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text) as { success: boolean; data: { totalInitiatives: number } };
    expect(parsed.success).toBe(true);
    expect(parsed.data.totalInitiatives).toBe(1);
  });

  it("review_initiatives works with no arguments", async () => {
    const handler = new CommandHandler(root, { pipeline: new StubPipeline(makeAnalysisResult([])) });
    const { client } = await connectedClient(handler);

    const result = await client.callTool({ name: "review_initiatives", arguments: {} });
    expect(result.isError).toBeFalsy();
  });
});
