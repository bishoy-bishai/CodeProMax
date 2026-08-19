/**
 * @file schemas.test.ts
 * @description Comprehensive test suite for all Code Pro Max schemas.
 * Tests: valid data acceptance, invalid data rejection, cross-field refinements,
 * type guards, serializers, deserializers, and state machine transitions.
 */

import { describe, it, expect } from "vitest";
import {
  EvidenceRecordSchema,
  FindingSchema,
  InitiativeSchema,
  InitiativeRegisterSchema,
  ScoringResultSchema,
  StateMachineDefinitionSchema,
} from "../schemas.ts";
import {
  parseEvidenceRecord,
  parseFinding,
  parseInitiative,
  parseInitiativeRegister,
  parseScoringResult,
  isEvidenceRecord,
  isFinding,
  isInitiative,
  serializeInitiative,
  deserializeInitiative,
  filterInitiatives,
  recomputeStats,
} from "../validators.ts";
import { transition, getReachableStatuses, isTerminalStatus, STATE_MACHINE } from "../state-machine.ts";
import { ValidationError } from "../types.ts";
import type { Initiative, EvidenceRecord, Finding, InitiativeRegister } from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const LATER = new Date(Date.now() + 60_000).toISOString();

const VALID_EVIDENCE: EvidenceRecord = {
  source: "src/api/products.ts",
  type: "code",
  location: { file: "src/api/products.ts", line: 42, functionName: "getProducts", symbol: null },
  content: "SELECT * executed inside a loop — N+1 pattern detected",
  timestamp: NOW,
  validated: true,
  validatedAt: NOW,
};

const VALID_FINDING: Finding = {
  id: "FIND-001",
  title: "N+1 query in product listing",
  description: "getProducts() executes one query per product to fetch tags.",
  classification: "FACT",
  confidence: 5,
  evidence: [VALID_EVIDENCE],
  linkedFindings: [],
  initiativeRef: null,
  createdAt: NOW,
  updatedAt: NOW,
};

// Score: (5+5+4+4+(6-2)+(6-2))/30 * 100 = (5+5+4+4+4+4)/30*100 = 26/30*100 ≈ 87
const VALID_SCORING = {
  breakdown: { impact: 5, confidence: 5, urgency: 4, leverage: 4, cost: 2, risk: 2 },
  finalScore: 87,
  scoreConfidence: "High" as const,
  decisionTrace: "High impact, high confidence N+1 issue. Low cost and risk.",
  derivationRules: "finalScore = round((I+C+U+L+(6-Cost)+(6-Risk))/30 * 100)",
};

const VALID_INITIATIVE: Initiative = {
  id: "INIT-001",
  slug: "eliminate-n-plus-1-queries",
  name: "Eliminate N+1 Queries in Product API",
  status: "Proposed",
  problemStatement: {
    description: "Product listing API executes N+1 queries, causing 3s p99 latency.",
    severity: "High",
    evidenceRefs: ["src/api/products.ts:42"],
  },
  opportunity: {
    description: "Batch-load tags with a JOIN, reducing latency to <200ms p99.",
    successCriteria: ["p99 latency < 200ms", "No SELECT inside loop"],
    scope: ["products.ts getProducts()", "tag loading logic"],
    nonScope: ["Authentication", "Caching layer"],
  },
  evidence: [VALID_EVIDENCE],
  scoring: VALID_SCORING,
  findingRefs: ["FIND-001"],
  createdAt: NOW,
  updatedAt: NOW,
  owner: "bishoy",
  stakeholders: ["alice", "bob"],
  blockers: [],
  risks: [],
  dependencies: [],
  openQuestions: [],
};

const VALID_REGISTER: InitiativeRegister = {
  initiatives: [VALID_INITIATIVE],
  stats: {
    total: 1,
    byStatus: {
      Proposed: 1,
      Selected: 0,
      Planned: 0,
      "In Progress": 0,
      Released: 0,
      Validated: 0,
      Completed: 0,
    },
  },
  lastUpdated: NOW,
};

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE RECORD TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceRecord", () => {
  it("accepts valid evidence record", () => {
    expect(() => parseEvidenceRecord(VALID_EVIDENCE)).not.toThrow();
  });

  it("rejects empty source", () => {
    const bad = { ...VALID_EVIDENCE, source: "" };
    expect(() => parseEvidenceRecord(bad)).toThrow(ValidationError);
  });

  it("rejects invalid evidence type", () => {
    const bad = { ...VALID_EVIDENCE, type: "magic" };
    expect(() => parseEvidenceRecord(bad)).toThrow(ValidationError);
  });

  it("rejects validated=true with null validatedAt", () => {
    const bad = { ...VALID_EVIDENCE, validated: true, validatedAt: null };
    expect(() => parseEvidenceRecord(bad)).toThrow(ValidationError);
  });

  it("accepts validated=false with null validatedAt", () => {
    const ok = { ...VALID_EVIDENCE, validated: false, validatedAt: null };
    expect(() => parseEvidenceRecord(ok)).not.toThrow();
  });

  it("isEvidenceRecord type guard returns true for valid data", () => {
    expect(isEvidenceRecord(VALID_EVIDENCE)).toBe(true);
  });

  it("isEvidenceRecord type guard returns false for invalid data", () => {
    expect(isEvidenceRecord({ source: "" })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCORING RESULT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("ScoringResult", () => {
  it("accepts valid scoring result", () => {
    expect(() => parseScoringResult(VALID_SCORING)).not.toThrow();
  });

  it("rejects finalScore that doesn't match breakdown formula", () => {
    const bad = { ...VALID_SCORING, finalScore: 50 }; // Should be ~87
    expect(() => parseScoringResult(bad)).toThrow(ValidationError);
  });

  it("rejects axis score out of range", () => {
    const bad = {
      ...VALID_SCORING,
      breakdown: { ...VALID_SCORING.breakdown, impact: 6 },
    };
    expect(() => parseScoringResult(bad)).toThrow(ValidationError);
  });

  it("rejects empty decisionTrace", () => {
    const bad = { ...VALID_SCORING, decisionTrace: "" };
    expect(() => parseScoringResult(bad)).toThrow(ValidationError);
  });

  it("rejects finalScore > 100", () => {
    const bad = { ...VALID_SCORING, finalScore: 101 };
    expect(() => parseScoringResult(bad)).toThrow(ValidationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FINDING TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Finding", () => {
  it("accepts valid finding", () => {
    expect(() => parseFinding(VALID_FINDING)).not.toThrow();
  });

  it("rejects empty evidence array", () => {
    const bad = { ...VALID_FINDING, evidence: [] };
    expect(() => parseFinding(bad)).toThrow(ValidationError);
  });

  it("rejects invalid ID format", () => {
    const bad = { ...VALID_FINDING, id: "F-001" };
    expect(() => parseFinding(bad)).toThrow(ValidationError);
  });

  it("rejects confidence out of range", () => {
    const bad = { ...VALID_FINDING, confidence: 6 };
    expect(() => parseFinding(bad)).toThrow(ValidationError);
  });

  it("rejects updatedAt before createdAt", () => {
    const bad = { ...VALID_FINDING, updatedAt: "2000-01-01T00:00:00.000Z" };
    expect(() => parseFinding(bad)).toThrow(ValidationError);
  });

  it("isFinding type guard works", () => {
    expect(isFinding(VALID_FINDING)).toBe(true);
    expect(isFinding({ id: "nope" })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Initiative", () => {
  it("accepts valid initiative", () => {
    expect(() => parseInitiative(VALID_INITIATIVE)).not.toThrow();
  });

  it("rejects non-kebab-case slug", () => {
    const bad = { ...VALID_INITIATIVE, slug: "Eliminate N+1 Queries" };
    expect(() => parseInitiative(bad)).toThrow(ValidationError);
  });

  it("rejects initiative with no evidence", () => {
    const bad = { ...VALID_INITIATIVE, evidence: [] };
    expect(() => parseInitiative(bad)).toThrow(ValidationError);
  });

  it("rejects invalid INIT-NNN id format", () => {
    const bad = { ...VALID_INITIATIVE, id: "INT-001" };
    expect(() => parseInitiative(bad)).toThrow(ValidationError);
  });

  it("rejects empty nonScope", () => {
    const bad = {
      ...VALID_INITIATIVE,
      opportunity: { ...VALID_INITIATIVE.opportunity, nonScope: [] },
    };
    expect(() => parseInitiative(bad)).toThrow(ValidationError);
  });

  it("serialize/deserialize round-trip is lossless", () => {
    const serialized = serializeInitiative(VALID_INITIATIVE);
    const deserialized = deserializeInitiative(serialized);
    expect(deserialized).toEqual(VALID_INITIATIVE);
  });

  it("isInitiative type guard works", () => {
    expect(isInitiative(VALID_INITIATIVE)).toBe(true);
    expect(isInitiative({})).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE REGISTER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("InitiativeRegister", () => {
  it("accepts valid register", () => {
    expect(() => parseInitiativeRegister(VALID_REGISTER)).not.toThrow();
  });

  it("rejects mismatched stats.total", () => {
    const bad: InitiativeRegister = {
      ...VALID_REGISTER,
      stats: { ...VALID_REGISTER.stats, total: 99 },
    };
    expect(() => parseInitiativeRegister(bad)).toThrow(ValidationError);
  });

  it("rejects byStatus sum != total", () => {
    const bad: InitiativeRegister = {
      ...VALID_REGISTER,
      stats: {
        total: 1,
        byStatus: { ...VALID_REGISTER.stats.byStatus, Proposed: 2 }, // sum=2, total=1
      },
    };
    expect(() => parseInitiativeRegister(bad)).toThrow(ValidationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATE MACHINE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("StateMachine", () => {
  it("state machine definition is itself valid", () => {
    expect(() =>
      StateMachineDefinitionSchema.parse(STATE_MACHINE)
    ).not.toThrow();
  });

  it("Completed is a terminal state", () => {
    expect(isTerminalStatus("Completed")).toBe(true);
  });

  it("Proposed is not a terminal state", () => {
    expect(isTerminalStatus("Proposed")).toBe(false);
  });

  it("getReachableStatuses from Proposed returns [Selected]", () => {
    expect(getReachableStatuses("Proposed")).toContain("Selected");
  });

  it("transitions Proposed → Selected with valid initiative", () => {
    const result = transition(VALID_INITIATIVE, "Selected");
    expect(result.status).toBe("Selected");
  });

  it("throws ValidationError on invalid transition", () => {
    expect(() => transition(VALID_INITIATIVE, "Completed")).toThrow(ValidationError);
  });

  it("throws ValidationError when owner is missing", () => {
    const noOwner = { ...VALID_INITIATIVE, owner: "" };
    expect(() => transition(noOwner as Initiative, "Selected")).toThrow(ValidationError);
  });

  it("throws ValidationError when open blockers exist for In Progress → Released", () => {
    const withBlocker: Initiative = {
      ...VALID_INITIATIVE,
      status: "In Progress",
      blockers: [
        {
          description: "DB migration pending",
          likelihood: 3,
          impact: 4,
          owner: "alice",
          mitigation: "Schedule migration window",
          status: "Open",
        },
      ],
    };
    expect(() => transition(withBlocker, "Released")).toThrow(ValidationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER UTILITIES TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("filterInitiatives", () => {
  it("filters by status", () => {
    const results = filterInitiatives(VALID_REGISTER, { status: "Proposed" });
    expect(results).toHaveLength(1);
  });

  it("returns empty array when no match", () => {
    const results = filterInitiatives(VALID_REGISTER, { status: "Completed" });
    expect(results).toHaveLength(0);
  });

  it("filters by minScore", () => {
    const results = filterInitiatives(VALID_REGISTER, { minScore: 90 });
    expect(results).toHaveLength(0);

    const results2 = filterInitiatives(VALID_REGISTER, { minScore: 50 });
    expect(results2).toHaveLength(1);
  });
});

describe("recomputeStats", () => {
  it("correctly computes stats from initiatives", () => {
    const stats = recomputeStats([VALID_INITIATIVE]);
    expect(stats.total).toBe(1);
    expect(stats.byStatus["Proposed"]).toBe(1);
    expect(stats.byStatus["Completed"]).toBe(0);
  });

  it("returns zero totals for empty array", () => {
    const stats = recomputeStats([]);
    expect(stats.total).toBe(0);
    expect(Object.values(stats.byStatus).every((v) => v === 0)).toBe(true);
  });
});
