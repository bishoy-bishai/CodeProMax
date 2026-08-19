/**
 * @file register-manager.test.ts
 * @description Tests for RegisterManager: JSON round-trip fidelity, Markdown
 * summary generation, update/get semantics, and empty-register fallback.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { FileManager } from "../file-manager.ts";
import { RegisterManager } from "../register-manager.ts";
import { registerMarkdownPath } from "../paths.ts";
import type { Initiative, ScoringBreakdown } from "../../schemas/types.ts";

const root = join(process.cwd(), ".tmp-register-manager-test");
const NOW = new Date().toISOString();

/** finalScore = round((I+C+U+L+(6-Cost)+(6-Risk))/30 * 100) — must match ScoringResultSchema's cross-check */
function computeFinalScore(b: ScoringBreakdown): number {
  return Math.round(((b.impact + b.confidence + b.urgency + b.leverage + (6 - b.cost) + (6 - b.risk)) / 30) * 100);
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: "INIT-010" as `INIT-${string}`,
    slug: "test-init",
    name: "Test Initiative",
    status: "Proposed",
    problemStatement: { description: "A problem", severity: "High", evidenceRefs: ["a.ts:1"] },
    opportunity: {
      description: "An opportunity",
      successCriteria: ["Criterion 1"],
      scope: ["Scope A"],
      nonScope: ["Non-scope A"],
    },
    evidence: [
      { source: "a.ts", type: "code", location: null, content: "evidence", timestamp: NOW, validated: true, validatedAt: NOW },
    ],
    scoring: {
      breakdown: { impact: 4, confidence: 4, urgency: 3, leverage: 3, cost: 2, risk: 2 },
      finalScore: computeFinalScore({ impact: 4, confidence: 4, urgency: 3, leverage: 3, cost: 2, risk: 2 }),
      scoreConfidence: "High",
      decisionTrace: "trace",
      derivationRules: "rule",
    },
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

beforeEach(async () => {
  await mkdir(root, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("RegisterManager", () => {
  function makeManager(): RegisterManager {
    return new RegisterManager(new FileManager(), root);
  }

  it("returns an empty register when nothing has been created yet", async () => {
    const register = await makeManager().load();
    expect(register.initiatives).toEqual([]);
    expect(register.stats.total).toBe(0);
  });

  it("round-trips a created register through JSON losslessly", async () => {
    const manager = makeManager();
    const init = makeInitiative();
    await manager.create([init]);

    const loaded = await manager.load();
    expect(loaded.initiatives).toHaveLength(1);
    expect(loaded.initiatives[0]).toEqual(init);
    expect(loaded.stats.total).toBe(1);
    expect(loaded.stats.byStatus.Proposed).toBe(1);
  });

  it("writes a human-readable Markdown summary alongside the JSON", async () => {
    const manager = makeManager();
    await manager.create([makeInitiative()]);

    const fm = new FileManager();
    const md = await fm.read(registerMarkdownPath(root));
    expect(md).not.toBeNull();
    expect(md).toContain("# Initiative Register");
    expect(md).toContain("INIT-010");
    expect(md).toContain("Test Initiative");
  });

  it("fetches a single initiative by ID", async () => {
    const manager = makeManager();
    const init = makeInitiative();
    await manager.create([init]);
    expect(await manager.get(init.id)).toEqual(init);
  });

  it("returns null for an unknown ID", async () => {
    const manager = makeManager();
    await manager.create([makeInitiative()]);
    expect(await manager.get("INIT-999" as `INIT-${string}`)).toBeNull();
  });

  it("update() replaces an existing initiative and recomputes stats", async () => {
    const manager = makeManager();
    const init = makeInitiative();
    await manager.create([init]);

    const updated: Initiative = { ...init, status: "Selected", owner: "bob" };
    await manager.update(updated);

    const loaded = await manager.get(init.id);
    expect(loaded?.status).toBe("Selected");
    expect(loaded?.owner).toBe("bob");

    const register = await manager.load();
    expect(register.stats.byStatus.Selected).toBe(1);
    expect(register.stats.byStatus.Proposed).toBe(0);
  });

  it("update() appends a new initiative when the ID is not already present", async () => {
    const manager = makeManager();
    await manager.create([makeInitiative()]);
    const second = makeInitiative({ id: "INIT-011" as `INIT-${string}`, slug: "second" });
    await manager.update(second);

    const all = await manager.loadAll();
    expect(all).toHaveLength(2);
  });
});
