/**
 * @file ticket-generator.test.ts
 * @description Tests for TicketGenerator: vertical slicing, effort derivation
 * from the cost axis, automatic splitting of L-sized tickets, dependency
 * chaining, and Gherkin-formatted acceptance criteria.
 */

import { describe, it, expect } from "vitest";
import { TicketGenerator } from "../ticket-generator.ts";
import { validateInvest } from "../../validators/invest-validator.ts";
import type { Initiative } from "../../schemas/types.ts";

const NOW = new Date().toISOString();

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: "INIT-004" as `INIT-${string}`,
    slug: "normalize-error-logging",
    name: "Normalize Error Logging Across Services",
    status: "Proposed",
    problemStatement: {
      description: "Errors are logged inconsistently, making cross-service correlation impossible.",
      severity: "High",
      evidenceRefs: ["src/services/order-service.ts:120"],
    },
    opportunity: {
      description: "Introduce a shared structured logger used by every service.",
      successCriteria: [
        "All services emit structured JSON logs with a request ID",
        "Log correlation dashboard shows end-to-end traces",
      ],
      scope: ["Shared structured logger package", "Request ID propagation middleware"],
      nonScope: ["Log storage backend migration"],
    },
    evidence: [
      {
        source: "src/services/order-service.ts",
        type: "code",
        location: { file: "src/services/order-service.ts", line: 120, functionName: "placeOrder", symbol: null },
        content: "console.log used instead of structured logger",
        timestamp: NOW,
        validated: true,
        validatedAt: NOW,
      },
    ],
    scoring: {
      breakdown: { impact: 4, confidence: 4, urgency: 3, leverage: 4, cost: 2, risk: 2 },
      finalScore: 73,
      scoreConfidence: "High",
      decisionTrace: "Moderate cost, high leverage since the logger is reused everywhere.",
      derivationRules: "finalScore = round((I+C+U+L+(6-Cost)+(6-Risk))/30 * 100)",
    },
    findingRefs: ["FIND-004" as `FIND-${string}`],
    createdAt: NOW,
    updatedAt: NOW,
    owner: "grace",
    stakeholders: [],
    blockers: [],
    risks: [],
    dependencies: [],
    openQuestions: [],
    ...overrides,
  };
}

describe("TicketGenerator", () => {
  const generator = new TicketGenerator();

  it("creates one vertical-slice ticket per scope item", () => {
    const tickets = generator.generateTickets(makeInitiative());
    expect(tickets).toHaveLength(2);
    expect(tickets[0]?.title).toBe("Shared structured logger package");
    expect(tickets[1]?.title).toBe("Request ID propagation middleware");
  });

  it("derives effort from the cost axis (cost=2 → S)", () => {
    const tickets = generator.generateTickets(makeInitiative());
    expect(tickets[0]?.effort).toBe("S");
    expect(tickets[0]?.effortLabel).toBe("S (1-2 days)");
  });

  it("derives M effort for a mid cost axis", () => {
    const init = makeInitiative({
      scoring: {
        breakdown: { impact: 4, confidence: 4, urgency: 3, leverage: 4, cost: 3, risk: 2 },
        finalScore: 70,
        scoreConfidence: "High",
        decisionTrace: "trace",
        derivationRules: "rule",
      },
    });
    const tickets = generator.generateTickets(init);
    expect(tickets[0]?.effort).toBe("M");
  });

  it("splits high-cost initiatives into two M tickets per scope item", () => {
    const init = makeInitiative({
      opportunity: {
        description: "Introduce a shared structured logger used by every service.",
        successCriteria: ["All services emit structured JSON logs"],
        scope: ["Shared structured logger package"],
        nonScope: [],
      },
      scoring: {
        breakdown: { impact: 4, confidence: 4, urgency: 3, leverage: 4, cost: 5, risk: 3 },
        finalScore: 65,
        scoreConfidence: "Medium",
        decisionTrace: "trace",
        derivationRules: "rule",
      },
    });
    const tickets = generator.generateTickets(init);
    expect(tickets).toHaveLength(2);
    expect(tickets[0]?.effort).toBe("M");
    expect(tickets[1]?.effort).toBe("M");
    expect(tickets[0]?.title).toContain("Part 1: Design & Foundation");
    expect(tickets[1]?.title).toContain("Part 2: Implementation & Rollout");
  });

  it("chains dependencies linearly, each ticket depending on at most the previous one", () => {
    const tickets = generator.generateTickets(makeInitiative());
    expect(tickets[0]?.dependencies).toEqual([]);
    expect(tickets[1]?.dependencies).toEqual([tickets[0]?.id]);
  });

  it("assigns ticket IDs in the {InitiativeId}-{NN} format", () => {
    const tickets = generator.generateTickets(makeInitiative());
    expect(tickets[0]?.id).toBe("INIT-004-01");
    expect(tickets[1]?.id).toBe("INIT-004-02");
  });

  it("renders acceptance criteria as Gherkin Feature/Scenario/Given/When/Then", () => {
    const tickets = generator.generateTickets(makeInitiative());
    const ac = tickets[0]?.acceptanceCriteria ?? "";
    expect(ac).toContain("Feature:");
    expect(ac).toContain("Scenario:");
    expect(ac).toContain("Given");
    expect(ac).toContain("When");
    expect(ac).toContain("Then");
  });

  it("includes a valuable 'so that' clause in the story", () => {
    const tickets = generator.generateTickets(makeInitiative());
    expect(tickets[0]?.story).toMatch(/So that .+/);
  });

  it("surfaces relevant evidence in technical notes when keywords match", () => {
    const tickets = generator.generateTickets(makeInitiative());
    expect(tickets[0]?.technicalNotes).toContain("console.log used instead of structured logger");
  });

  it("falls back to a placeholder in technical notes when no evidence matches", () => {
    const init = makeInitiative({
      opportunity: {
        description: "Introduce a shared structured logger used by every service.",
        successCriteria: ["All services emit structured JSON logs"],
        scope: ["Unrelated compliance paperwork"],
        nonScope: [],
      },
    });
    const tickets = generator.generateTickets(init);
    expect(tickets[0]?.technicalNotes).toContain("[PLACEHOLDER:");
  });

  it("returns an empty ticket list when the initiative has no scope", () => {
    const init = makeInitiative({
      opportunity: {
        description: "desc",
        successCriteria: [],
        scope: [],
        nonScope: [],
      },
    });
    expect(generator.generateTickets(init)).toEqual([]);
  });

  it("produces tickets that pass INVEST validation end-to-end", () => {
    const tickets = generator.generateTickets(makeInitiative());
    for (const ticket of tickets) {
      const score = validateInvest(ticket);
      expect(score.status).toBe("READY");
    }
  });
});
