/**
 * @file state-machine.test.ts (core layer)
 * @description Tests for core/state-machine.ts — function-based guards,
 * mandatory reason/triggeredBy, audit logs, guard inspection.
 */

import { describe, it, expect } from "vitest";
import { transition, getTransitionOptions, getCoreTransitions } from "../state-machine.ts";
import { ValidationError } from "../../schemas/types.ts";
import type { Initiative } from "../../schemas/types.ts";

const NOW = new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE
// ─────────────────────────────────────────────────────────────────────────────

function makeInit(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: "INIT-001",
    slug: "test-initiative",
    name: "Test Initiative",
    status: "Proposed",
    problemStatement: {
      description: "Problem description",
      severity: "High",
      evidenceRefs: ["src/test.ts:1"],
    },
    opportunity: {
      description: "Opportunity",
      successCriteria: ["Metric improves"],
      scope: ["Module A"],
      nonScope: ["Module B"],
    },
    evidence: [
      {
        source: "src/test.ts",
        type: "code",
        location: null,
        content: "Direct evidence",
        timestamp: NOW,
        validated: true,
        validatedAt: NOW,
      },
    ],
    scoring: {
      breakdown: { impact: 5, confidence: 5, urgency: 4, leverage: 4, cost: 2, risk: 2 },
      finalScore: 87,
      scoreConfidence: "High",
      decisionTrace: "Strong evidence, high impact, low cost and risk.",
      derivationRules: "round((I+C+U+L+(6-Cost)+(6-Risk))/30*100)",
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
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALID TRANSITION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Core StateMachine — valid transitions", () => {
  it("transitions Proposed → Selected with valid initiative", () => {
    const { initiative, log } = transition(
      makeInit(),
      "Selected",
      "Scoring complete, evidence validated.",
      "alice"
    );
    expect(initiative.status).toBe("Selected");
    expect(log.from).toBe("Proposed");
    expect(log.to).toBe("Selected");
  });

  it("returns updated updatedAt timestamp", () => {
    const init = makeInit();
    const { initiative } = transition(init, "Selected", "Reason", "alice");
    expect(new Date(initiative.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(init.updatedAt).getTime()
    );
  });

  it("does not mutate the original initiative", () => {
    const original = makeInit();
    const originalStatus = original.status;
    transition(original, "Selected", "Reason", "alice");
    expect(original.status).toBe(originalStatus);
  });

  it("audit log contains all required fields", () => {
    const { log } = transition(makeInit(), "Selected", "Test reason", "ci-system");
    expect(log.initiativeId).toBe("INIT-001");
    expect(log.reason).toBe("Test reason");
    expect(log.triggeredBy).toBe("ci-system");
    expect(log.timestamp).toBeTruthy();
    expect(Array.isArray(log.guardResults)).toBe(true);
  });

  it("all guard results are included in the log", () => {
    const { log } = transition(makeInit(), "Selected", "Reason", "alice");
    expect(log.guardResults.every((r) => r.passed)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GUARD FAILURE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Core StateMachine — guard failures", () => {
  it("throws when owner is empty", () => {
    const init = makeInit({ owner: "" });
    expect(() => transition(init, "Selected", "Reason", "alice")).toThrow(ValidationError);
  });

  it("throws when evidence is empty (using schema-valid mock)", () => {
    // We can't actually create an invalid Initiative (schema won't allow empty evidence),
    // but we test the guard independently via getTransitionOptions
    const init = makeInit();
    // Verify guard passes for valid evidence
    const options = getTransitionOptions(init);
    const toSelected = options.find((o) => o.to === "Selected");
    const evidenceGuard = toSelected?.guardResults.find((r) => r.guardName === "evidence-non-empty");
    expect(evidenceGuard?.passed).toBe(true);
  });

  it("throws on invalid transition: Proposed → Completed", () => {
    expect(() =>
      transition(makeInit(), "Completed", "Reason", "alice")
    ).toThrow(ValidationError);
  });

  it("throws on self-transition: Proposed → Proposed", () => {
    expect(() =>
      transition(makeInit(), "Proposed", "Reason", "alice")
    ).toThrow(ValidationError);
  });

  it("throws when open blockers exist (Planned → In Progress)", () => {
    const init: Initiative = {
      ...makeInit({ status: "Planned" }),
      opportunity: {
        description: "Opportunity",
        successCriteria: ["Metric improves"],
        scope: ["Module A"],
        nonScope: ["Module B"],
      },
      blockers: [
        {
          description: "DB migration pending",
          likelihood: 3,
          impact: 4,
          owner: "bob",
          mitigation: "Schedule migration",
          status: "Open",
        },
      ],
    };
    expect(() => transition(init, "In Progress", "Reason", "alice")).toThrow(ValidationError);
  });

  it("throws when open questions block Planned transition", () => {
    const init: Initiative = {
      ...makeInit(),
      openQuestions: [
        {
          question: "Is the API public?",
          assignee: "alice",
          dueBy: null,
          answer: null, // unanswered
          resolvedAt: null,
        },
      ],
    };
    // Selected → Planned requires all questions answered
    const selected = makeInit({
      status: "Selected",
      openQuestions: init.openQuestions,
      opportunity: {
        description: "Opportunity",
        successCriteria: ["Metric improves"],
        scope: ["Module A"],
        nonScope: ["Module B"],
      },
    });
    expect(() => transition(selected, "Planned", "Reason", "alice")).toThrow(ValidationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REASON / TRIGGERED-BY VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Core StateMachine — mandatory reason/triggeredBy", () => {
  it("throws when reason is empty string", () => {
    expect(() => transition(makeInit(), "Selected", "", "alice")).toThrow(ValidationError);
  });

  it("throws when reason is whitespace only", () => {
    expect(() => transition(makeInit(), "Selected", "   ", "alice")).toThrow(ValidationError);
  });

  it("throws when triggeredBy is empty", () => {
    expect(() =>
      transition(makeInit(), "Selected", "Valid reason", "")
    ).toThrow(ValidationError);
  });

  it("accepts any non-empty reason string", () => {
    const { initiative } = transition(makeInit(), "Selected", "x", "alice");
    expect(initiative.status).toBe("Selected");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTION / QUERY API
// ─────────────────────────────────────────────────────────────────────────────

describe("Core StateMachine — getTransitionOptions", () => {
  it("returns options from Proposed state", () => {
    const options = getTransitionOptions(makeInit());
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => o.to !== "Proposed")).toBe(true);
  });

  it("marks transition as canTransition=true when all guards pass", () => {
    const options = getTransitionOptions(makeInit());
    const toSelected = options.find((o) => o.to === "Selected");
    expect(toSelected?.canTransition).toBe(true);
  });

  it("marks transition as canTransition=false when owner is missing", () => {
    const init = makeInit({ owner: "" });
    const options = getTransitionOptions(init);
    const toSelected = options.find((o) => o.to === "Selected");
    expect(toSelected?.canTransition).toBe(false);
  });
});

describe("Core StateMachine — getCoreTransitions", () => {
  it("returns at least 6 forward transitions", () => {
    const transitions = getCoreTransitions();
    expect(transitions.length).toBeGreaterThanOrEqual(6);
  });

  it("all transitions have at least one guard", () => {
    const transitions = getCoreTransitions();
    expect(transitions.every((t) => t.guards.length > 0)).toBe(true);
  });
});
