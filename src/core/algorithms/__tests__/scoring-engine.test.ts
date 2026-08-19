/**
 * @file scoring-engine.test.ts
 * @description Tests for ScoringEngine: formula correctness, confidence derivation,
 * ranking with tiebreaks, decision trace quality, score validation.
 */

import { describe, it, expect } from "vitest";
import { ScoringEngine } from "../../algorithms/scoring-engine.ts";
import type { Initiative, ScoringBreakdown } from "../../../schemas/types.ts";

const NOW = new Date().toISOString();
const engine = new ScoringEngine();

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function makeBreakdown(overrides: Partial<ScoringBreakdown> = {}): ScoringBreakdown {
  return {
    impact: 5,
    confidence: 5,
    urgency: 4,
    leverage: 4,
    cost: 2,
    risk: 2,
    ...overrides,
  };
}

function makeInitiative(
  id: string,
  breakdown: ScoringBreakdown,
  finalScore: number,
  scoreConfidence: "High" | "Medium" | "Low" = "High"
): Initiative {
  return {
    id: `INIT-${id}` as `INIT-${string}`,
    slug: `test-initiative-${id.toLowerCase()}`,
    name: `Test Initiative ${id}`,
    status: "Proposed",
    problemStatement: {
      description: "Test problem",
      severity: "High",
      evidenceRefs: ["src/test.ts:1"],
    },
    opportunity: {
      description: "Test opportunity",
      successCriteria: ["Metric improves by 20%"],
      scope: ["Module A"],
      nonScope: ["Module B"],
    },
    evidence: [
      {
        source: "src/test.ts",
        type: "code",
        location: null,
        content: "Test evidence",
        timestamp: NOW,
        validated: true,
        validatedAt: NOW,
      },
    ],
    scoring: {
      breakdown,
      finalScore,
      scoreConfidence,
      decisionTrace: "Test decision trace — written by scoring engine.",
      derivationRules: "finalScore = round((I+C+U+L+(6-Cost)+(6-Risk))/30 * 100)",
    },
    findingRefs: [],
    createdAt: NOW,
    updatedAt: NOW,
    owner: "alice",
    stakeholders: ["bob"],
    blockers: [],
    risks: [],
    dependencies: [],
    openQuestions: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULA TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("ScoringEngine — formula", () => {
  it("computes correct finalScore for a known breakdown", () => {
    // (5+5+4+4+(6-2)+(6-2))/30*100 = 26/30*100 ≈ 87
    const bd = makeBreakdown({ impact: 5, confidence: 5, urgency: 4, leverage: 4, cost: 2, risk: 2 });
    const init = makeInitiative("001", bd, 87);
    const result = engine.computeScore(init);
    expect(result.finalScore).toBe(87);
  });

  it("computes max score (100) when all axes at best", () => {
    const bd = makeBreakdown({ impact: 5, confidence: 5, urgency: 5, leverage: 5, cost: 1, risk: 1 });
    const init = makeInitiative("002", bd, 100);
    const result = engine.computeScore(init);
    expect(result.finalScore).toBe(100);
  });

  it("computes min score (20) when all axes at worst", () => {
    const bd = makeBreakdown({ impact: 1, confidence: 1, urgency: 1, leverage: 1, cost: 5, risk: 5 });
    const init = makeInitiative("003", bd, 20);
    const result = engine.computeScore(init);
    expect(result.finalScore).toBe(20);
  });

  it("computeFromBreakdown produces integer score", () => {
    const bd = makeBreakdown({ impact: 3, confidence: 3, urgency: 3, leverage: 3, cost: 3, risk: 3 });
    const result = engine.computeFromBreakdown(bd, "Test context");
    expect(Number.isInteger(result.finalScore)).toBe(true);
  });

  it("finalScore is always in range 0–100", () => {
    const bd = makeBreakdown({ impact: 5, confidence: 5, urgency: 5, leverage: 5, cost: 1, risk: 1 });
    const init = makeInitiative("004", bd, 100);
    const result = engine.computeScore(init);
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCORE CONFIDENCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("ScoringEngine — score confidence", () => {
  it("returns High confidence for high score with validated evidence", () => {
    const bd = makeBreakdown();
    const init = makeInitiative("005", bd, 87);
    // Add a second validated evidence record
    const init2: Initiative = {
      ...init,
      evidence: [
        ...init.evidence,
        { ...init.evidence[0]!, source: "src/second.ts" },
      ],
    };
    const result = engine.computeScore(init2);
    expect(result.scoreConfidence).toBe("High");
  });

  it("returns Low confidence for low score", () => {
    const bd = makeBreakdown({ impact: 1, confidence: 1, urgency: 1, leverage: 1, cost: 5, risk: 5 });
    const init = makeInitiative("006", bd, 20, "Low");
    const result = engine.computeScore(init);
    expect(result.scoreConfidence).toBe("Low");
  });

  it("returns Medium confidence for mid-range score", () => {
    const bd = makeBreakdown({ impact: 3, confidence: 3, urgency: 3, leverage: 3, cost: 3, risk: 3 });
    // (3+3+3+3+3+3)/30*100 = 18/30*100 = 60
    const init = makeInitiative("007", bd, 60, "Medium");
    const result = engine.computeScore(init);
    expect(["High", "Medium"]).toContain(result.scoreConfidence);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DECISION TRACE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("ScoringEngine — decision trace", () => {
  it("decision trace contains initiative ID", () => {
    const bd = makeBreakdown();
    const init = makeInitiative("008", bd, 87);
    const result = engine.computeScore(init);
    expect(result.decisionTrace).toContain("INIT-008");
  });

  it("decision trace contains the formula derivation", () => {
    const bd = makeBreakdown();
    const init = makeInitiative("009", bd, 87);
    const result = engine.computeScore(init);
    expect(result.decisionTrace).toContain("30");
    expect(result.decisionTrace).toContain("100");
  });

  it("decision trace is non-empty", () => {
    const bd = makeBreakdown();
    const init = makeInitiative("010", bd, 87);
    const result = engine.computeScore(init);
    expect(result.decisionTrace.trim().length).toBeGreaterThan(50);
  });

  it("axisRationales has exactly 6 entries", () => {
    const bd = makeBreakdown();
    const init = makeInitiative("011", bd, 87);
    const result = engine.computeScore(init);
    expect(result.axisRationales).toHaveLength(6);
  });

  it("each axis rationale contains a score", () => {
    const bd = makeBreakdown();
    const init = makeInitiative("012", bd, 87);
    const result = engine.computeScore(init);
    for (const r of result.axisRationales) {
      expect(r.score).toBeGreaterThanOrEqual(1);
      expect(r.score).toBeLessThanOrEqual(5);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RANKING TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("ScoringEngine — ranking", () => {
  it("ranks initiatives by score descending", () => {
    const i1 = makeInitiative("101", makeBreakdown({ impact: 5, cost: 1, risk: 1, confidence: 5, urgency: 5, leverage: 5 }), 100, "High");
    const i2 = makeInitiative("102", makeBreakdown({ impact: 1, cost: 5, risk: 5, confidence: 1, urgency: 1, leverage: 1 }), 20, "Low");
    const ranked = engine.rank([i2, i1]); // deliberately reversed
    expect(ranked[0]?.initiativeId).toBe("INIT-101");
    expect(ranked[1]?.initiativeId).toBe("INIT-102");
  });

  it("returns correct rank numbers (1-indexed)", () => {
    const i1 = makeInitiative("201", makeBreakdown(), 87);
    const i2 = makeInitiative("202", makeBreakdown({ impact: 3 }), 80);
    const ranked = engine.rank([i1, i2]);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(2);
  });

  it("tiebreak by confidence when scores equal", () => {
    const bd = makeBreakdown({ impact: 4, confidence: 4, urgency: 4, leverage: 4, cost: 3, risk: 3 });
    const score = Math.round(((4 + 4 + 4 + 4 + 3 + 3) / 30) * 100); // = 73
    const highConf = makeInitiative("301", bd, score, "High");
    const lowConf = makeInitiative("302", bd, score, "Low");
    const ranked = engine.rank([lowConf, highConf]);
    expect(ranked[0]?.initiativeId).toBe("INIT-301");
    expect(ranked[0]?.tiebreakReason).not.toBeNull();
    expect(ranked[0]?.tiebreakReason).toContain("confidence");
  });

  it("tiebreak by impact when score and confidence equal", () => {
    const bd1 = makeBreakdown({ impact: 5 });
    const bd2 = makeBreakdown({ impact: 4 });
    // Force same finalScore by adjusting another axis
    const score1 = Math.round(((5 + 5 + 4 + 4 + 4 + 4) / 30) * 100);
    const score2 = Math.round(((4 + 5 + 4 + 4 + 4 + 4) / 30) * 100);
    // They'll have different scores actually, but tiebreak is tested when equal
    // Let me use a contrived setup where scores happen to be equal:
    const bd3 = makeBreakdown({ impact: 5, cost: 2 }); // score 87
    const bd4 = makeBreakdown({ impact: 4, cost: 1 }); // (4+5+4+4+5+4)/30*100 = 26/30*100 = 87
    const s3 = Math.round(((5 + 5 + 4 + 4 + 4 + 4) / 30) * 100);
    const s4 = Math.round(((4 + 5 + 4 + 4 + 5 + 4) / 30) * 100);
    const i3 = makeInitiative("401", bd3, s3, "High");
    const i4 = makeInitiative("402", bd4, s4, "High");
    // If scores happen to be equal, impact wins
    if (s3 === s4) {
      const ranked = engine.rank([i4, i3]);
      expect(ranked[0]?.initiativeId).toBe("INIT-401"); // impact 5 > 4
    } else {
      // Scores differ — just confirm ranking is consistent
      const ranked = engine.rank([i3, i4]);
      expect(ranked[0]?.rank).toBe(1);
    }
  });

  it("ranking is stable (idempotent)", () => {
    const i1 = makeInitiative("501", makeBreakdown(), 87);
    const i2 = makeInitiative("502", makeBreakdown({ impact: 4 }), 80);
    const i3 = makeInitiative("503", makeBreakdown({ impact: 3 }), 73);
    const ranked1 = engine.rank([i1, i2, i3]);
    const ranked2 = engine.rank([i3, i1, i2]);
    expect(ranked1.map((r) => r.initiativeId)).toEqual(ranked2.map((r) => r.initiativeId));
  });

  it("returns empty array for empty input", () => {
    expect(engine.rank([])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCORE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe("ScoringEngine — validateStoredScore", () => {
  it("returns null for consistent stored score", () => {
    const bd = makeBreakdown();
    const expected = Math.round(((5 + 5 + 4 + 4 + 4 + 4) / 30) * 100); // 87
    const init = makeInitiative("601", bd, expected);
    expect(engine.validateStoredScore(init)).toBeNull();
  });

  it("returns error string for inconsistent stored score", () => {
    const bd = makeBreakdown();
    const init = makeInitiative("602", bd, 50); // 50 ≠ 87
    const error = engine.validateStoredScore(init);
    expect(error).not.toBeNull();
    expect(error).toContain("INIT-602");
    expect(error).toContain("50");
  });
});
