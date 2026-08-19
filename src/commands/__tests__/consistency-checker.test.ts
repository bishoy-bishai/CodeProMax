/**
 * @file consistency-checker.test.ts
 * @description Tests for ConsistencyChecker against real generator output,
 * plus targeted breakage of each check.
 */

import { describe, it, expect } from "vitest";
import { ConsistencyChecker } from "../consistency-checker.ts";
import { InitiativeGenerator } from "../../generators/initiative-generator.ts";
import { EpicGenerator } from "../../generators/epic-generator.ts";
import { TechSpecGenerator } from "../../generators/tech-spec-generator.ts";
import { TicketGenerator } from "../../generators/ticket-generator.ts";
import type { Initiative, ScoringBreakdown } from "../../schemas/types.ts";
import type { Ticket } from "../../generators/ticket-types.ts";

const NOW = new Date().toISOString();

function computeFinalScore(b: ScoringBreakdown): number {
  return Math.round(((b.impact + b.confidence + b.urgency + b.leverage + (6 - b.cost) + (6 - b.risk)) / 30) * 100);
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: "INIT-020" as `INIT-${string}`,
    slug: "consistency-check-target",
    name: "Consistency Check Target",
    status: "Proposed",
    problemStatement: { description: "A problem", severity: "High", evidenceRefs: ["a.ts:1"] },
    opportunity: {
      description: "An opportunity to fix things.",
      successCriteria: ["All checks pass"],
      scope: ["Shared logger package"],
      nonScope: ["Storage migration"],
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

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "INIT-020-01",
    title: "Shared logger package",
    story: "As an engineer\nI want to build the shared logger package\nSo that all checks pass",
    acceptanceCriteria:
      "Feature: Shared logger package\n\nScenario: delivered\n  Given the initiative\n  When completed\n  Then it passes",
    technicalNotes: "- notes",
    dependencies: [],
    effort: "S",
    effortLabel: "S (1-2 days)",
    definitionOfDone: ["done"],
    ...overrides,
  };
}

describe("ConsistencyChecker", () => {
  const checker = new ConsistencyChecker();

  it("validates real generator output as consistent", () => {
    const init = makeInitiative();
    const documents = {
      initiative: new InitiativeGenerator().generate(init),
      epic: new EpicGenerator().generate(init),
      techSpec: new TechSpecGenerator().generate(init),
      tickets: new TicketGenerator().generateTickets(init),
    };

    const report = checker.validate(documents, init);
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("flags a missing initiative name in the epic document", () => {
    const init = makeInitiative();
    const report = checker.validate(
      {
        initiative: "irrelevant",
        epic: "# Epic: Something Else",
        techSpec: `# Technical Specification: ${init.name}`,
        tickets: [makeTicket()],
      },
      init
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("Epic document does not reference"))).toBe(true);
  });

  it("flags a scope item missing from the tech spec", () => {
    const init = makeInitiative();
    const report = checker.validate(
      {
        initiative: "irrelevant",
        epic: `# Epic: ${init.name}\n\nShared logger package`,
        techSpec: `# Technical Specification: ${init.name}`,
        tickets: [makeTicket()],
      },
      init
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('missing from the tech spec'))).toBe(true);
  });

  it("flags a scope item with no representative ticket", () => {
    const init = makeInitiative();
    const report = checker.validate(
      {
        initiative: "irrelevant",
        epic: `# Epic: ${init.name}\n\nShared logger package`,
        techSpec: `# Technical Specification: ${init.name}\n\nShared logger package`,
        tickets: [],
      },
      init
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("No ticket represents scope item"))).toBe(true);
  });

  it("flags a ticket that fails INVEST validation", () => {
    const init = makeInitiative();
    const badTicket = makeTicket({ effort: "L" });
    const report = checker.validate(
      {
        initiative: "irrelevant",
        epic: `# Epic: ${init.name}\n\nShared logger package`,
        techSpec: `# Technical Specification: ${init.name}\n\nShared logger package`,
        tickets: [badTicket],
      },
      init
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("not INVEST-ready"))).toBe(true);
  });

  it("flags a ticket that depends on an unknown ticket ID", () => {
    const init = makeInitiative();
    const orphan = makeTicket({ dependencies: ["INIT-020-99" as Ticket["id"]] });
    const report = checker.validate(
      {
        initiative: "irrelevant",
        epic: `# Epic: ${init.name}\n\nShared logger package`,
        techSpec: `# Technical Specification: ${init.name}\n\nShared logger package`,
        tickets: [orphan],
      },
      init
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("depends on unknown ticket"))).toBe(true);
  });
});
