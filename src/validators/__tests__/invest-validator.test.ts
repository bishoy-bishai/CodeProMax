/**
 * @file invest-validator.test.ts
 * @description Tests for validateInvest: each of the six INVEST criteria,
 * overall status derivation, and reason reporting.
 */

import { describe, it, expect } from "vitest";
import { validateInvest, validateInvestAll } from "../invest-validator.ts";
import type { Ticket } from "../../generators/ticket-types.ts";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "INIT-001-01",
    title: "Shared structured logger package",
    story:
      "As an engineer\nI want to build the shared structured logger package\nSo that all services can emit consistent structured logs",
    acceptanceCriteria:
      "Feature: Shared structured logger package\n\nScenario: logger is delivered\n  Given the initiative is being implemented\n  When the logger package is completed\n  Then all services can adopt it",
    technicalNotes: "- src/services/order-service.ts: console.log used instead of structured logger",
    dependencies: [],
    effort: "S",
    effortLabel: "S (1-2 days)",
    definitionOfDone: ["Code reviewed and merged", "Tests passing in CI"],
    ...overrides,
  };
}

describe("validateInvest", () => {
  it("validates a well-formed ticket as READY", () => {
    const score = validateInvest(makeTicket());
    expect(score.status).toBe("READY");
    expect(score.reasons).toEqual([]);
  });

  it("validates independent stories (0 or 1 dependency)", () => {
    expect(validateInvest(makeTicket({ dependencies: [] })).independent).toBe(true);
    expect(validateInvest(makeTicket({ dependencies: ["INIT-001-00" as Ticket["id"]] })).independent).toBe(true);
  });

  it("flags stories with more than one dependency as not independent", () => {
    const score = validateInvest(
      makeTicket({ dependencies: ["INIT-001-00" as Ticket["id"], "INIT-001-02" as Ticket["id"]] })
    );
    expect(score.independent).toBe(false);
    expect(score.status).toBe("NEEDS_REFINEMENT");
    expect(score.reasons.some((r) => r.startsWith("Independent"))).toBe(true);
  });

  it("flags thin stories as not negotiable", () => {
    const score = validateInvest(makeTicket({ story: "Too short", acceptanceCriteria: "Too short" }));
    expect(score.negotiable).toBe(false);
    expect(score.reasons.some((r) => r.startsWith("Negotiable"))).toBe(true);
  });

  it("validates valuable stories with a 'so that' clause", () => {
    expect(validateInvest(makeTicket()).valuable).toBe(true);
  });

  it("flags stories missing a 'so that' clause as not valuable", () => {
    const score = validateInvest(makeTicket({ story: "As an engineer\nI want to do the thing" }));
    expect(score.valuable).toBe(false);
    expect(score.reasons.some((r) => r.startsWith("Valuable"))).toBe(true);
  });

  it("validates estimable tickets with a recognized effort size", () => {
    expect(validateInvest(makeTicket({ effort: "M" })).estimable).toBe(true);
  });

  it("rejects too-large stories as not small", () => {
    const score = validateInvest(makeTicket({ effort: "L" }));
    expect(score.small).toBe(false);
    expect(score.status).toBe("NEEDS_REFINEMENT");
    expect(score.reasons.some((r) => r.startsWith("Small"))).toBe(true);
  });

  it("accepts S and M as small", () => {
    expect(validateInvest(makeTicket({ effort: "S" })).small).toBe(true);
    expect(validateInvest(makeTicket({ effort: "M" })).small).toBe(true);
  });

  it("validates testable criteria containing Given/When/Then", () => {
    expect(validateInvest(makeTicket()).testable).toBe(true);
  });

  it("flags acceptance criteria without full Given/When/Then as not testable", () => {
    const score = validateInvest(makeTicket({ acceptanceCriteria: "Feature: X\n\nScenario: Y\n  Given a state" }));
    expect(score.testable).toBe(false);
    expect(score.reasons.some((r) => r.startsWith("Testable"))).toBe(true);
  });

  it("marks status NEEDS_REFINEMENT when any single criterion fails", () => {
    const score = validateInvest(makeTicket({ effort: "L" }));
    expect(score.status).toBe("NEEDS_REFINEMENT");
  });

  it("validates a batch of tickets in order", () => {
    const scores = validateInvestAll([makeTicket(), makeTicket({ effort: "L" })]);
    expect(scores).toHaveLength(2);
    expect(scores[0]?.status).toBe("READY");
    expect(scores[1]?.status).toBe("NEEDS_REFINEMENT");
  });
});
