/**
 * @file epic-generator.test.ts
 * @description Tests for EpicGenerator: structure, content fidelity, and gap-marking.
 */

import { describe, it, expect } from "vitest";
import { EpicGenerator } from "../epic-generator.ts";
import type { Initiative } from "../../schemas/types.ts";

const NOW = new Date().toISOString();

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: "INIT-002" as `INIT-${string}`,
    slug: "reduce-handler-complexity",
    name: "Reduce Handler Complexity",
    status: "Proposed",
    problemStatement: {
      description: "The request handler has grown to 400 lines with cyclomatic complexity 32.",
      severity: "Medium",
      evidenceRefs: ["src/api/handler.ts:1-400"],
    },
    opportunity: {
      description: "Decompose the handler into focused, single-responsibility functions.",
      successCriteria: ["No function exceeds 50 lines", "Complexity gate enforced in CI"],
      scope: ["src/api/handler.ts"],
      nonScope: ["Auto-generated gRPC stubs"],
    },
    evidence: [
      {
        source: "src/api/handler.ts",
        type: "code",
        location: null,
        content: "400-line function, complexity 32",
        timestamp: NOW,
        validated: true,
        validatedAt: NOW,
      },
    ],
    scoring: {
      breakdown: { impact: 3, confidence: 4, urgency: 2, leverage: 4, cost: 3, risk: 2 },
      finalScore: 63,
      scoreConfidence: "Medium",
      decisionTrace: "Moderate impact, high leverage due to shared module reuse.",
      derivationRules: "finalScore = round((I+C+U+L+(6-Cost)+(6-Risk))/30 * 100)",
    },
    findingRefs: ["FIND-002" as `FIND-${string}`],
    createdAt: NOW,
    updatedAt: NOW,
    owner: "dave",
    stakeholders: [],
    blockers: [],
    risks: [],
    dependencies: ["INIT-001" as `INIT-${string}`],
    openQuestions: [],
    ...overrides,
  };
}

describe("EpicGenerator", () => {
  const generator = new EpicGenerator();

  it("starts with an H1 title prefixed with 'Epic:'", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc.startsWith("# Epic: Reduce Handler Complexity")).toBe(true);
  });

  it("includes all required top-level sections in order", () => {
    const doc = generator.generate(makeInitiative());
    const requiredHeadings = [
      "## Summary",
      "## Business Value",
      "## Engineering Value",
      "## Goals",
      "## Non-Goals",
      "## Acceptance Criteria",
      "## Success Metrics",
      "## Dependencies",
      "## Timeline Estimate",
      "## Definition of Done",
    ];

    let cursor = -1;
    for (const heading of requiredHeadings) {
      const idx = doc.indexOf(heading);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("renders acceptance criteria as Gherkin blocks derived from success criteria", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("```gherkin");
    expect(doc).toContain("Given the initiative");
    expect(doc).toContain("no function exceeds 50 lines");
  });

  it("marks the timeline estimate as a placeholder rather than fabricating hours", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("[PLACEHOLDER: hours estimate");
  });

  it("links dependencies to their initiative documents", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("[INIT-001](./init-001-initiative.md)");
  });

  it("marks empty dependencies as None recorded", () => {
    const doc = generator.generate(makeInitiative({ dependencies: [] }));
    expect(doc).toContain("- None recorded");
  });

  it("links to the corresponding initiative document", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("[Initiative](./reduce-handler-complexity-initiative.md)");
  });

  it("falls back to a placeholder reviewer line when no stakeholders exist", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("[PLACEHOLDER: assign reviewers]");
  });
});
