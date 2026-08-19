/**
 * @file initiative-generator.test.ts
 * @description Tests for InitiativeGenerator: structure, content fidelity,
 * gap-marking conventions, and TOC insertion.
 */

import { describe, it, expect } from "vitest";
import { InitiativeGenerator } from "../initiative-generator.ts";
import type { Initiative } from "../../schemas/types.ts";
import type { RootCauseAnalysis } from "../../analyzers/types.ts";

const NOW = new Date().toISOString();

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: "INIT-001" as `INIT-${string}`,
    slug: "improve-error-observability",
    name: "Improve Production Error Observability",
    status: "Proposed",
    problemStatement: {
      description: "Errors are swallowed silently in async handlers, hiding production failures.",
      severity: "High",
      evidenceRefs: ["src/api/handler.ts:42"],
    },
    opportunity: {
      description: "Establish consistent structured error handling across all services.",
      successCriteria: ["MTTD reduced by 40%", "Zero silent error swallowing in CI"],
      scope: ["All async service handlers"],
      nonScope: ["Frontend error boundaries"],
    },
    evidence: [
      {
        source: "src/api/handler.ts",
        type: "code",
        location: { file: "src/api/handler.ts", line: 42, functionName: "handleRequest", symbol: null },
        content: "catch block discards error without logging",
        timestamp: NOW,
        validated: true,
        validatedAt: NOW,
      },
      {
        source: "git log",
        type: "git",
        location: null,
        content: "12 fix commits in the last 6 months touching this file",
        timestamp: NOW,
        validated: false,
        validatedAt: null,
      },
    ],
    scoring: {
      breakdown: { impact: 5, confidence: 4, urgency: 4, leverage: 4, cost: 2, risk: 2 },
      finalScore: 83,
      scoreConfidence: "High",
      decisionTrace: "Impact is high because production errors are invisible. Confidence is high given repeated evidence.",
      derivationRules: "finalScore = round((I+C+U+L+(6-Cost)+(6-Risk))/30 * 100)",
    },
    findingRefs: ["FIND-001" as `FIND-${string}`],
    createdAt: NOW,
    updatedAt: NOW,
    owner: "alice",
    stakeholders: ["bob", "carol"],
    blockers: [],
    risks: [
      {
        description: "Rollout may mask unrelated errors during migration",
        likelihood: 2,
        impact: 3,
        owner: "alice",
        mitigation: "Feature-flag rollout by service",
        status: "Open",
      },
    ],
    dependencies: [],
    openQuestions: [
      {
        question: "Which logging backend should structured errors ship to?",
        assignee: "bob",
        dueBy: null,
        answer: null,
        resolvedAt: null,
      },
    ],
    ...overrides,
  };
}

function makeRca(): RootCauseAnalysis {
  return {
    symptom: "Errors are swallowed silently",
    findingId: "FIND-001" as `FIND-${string}`,
    causes: [
      {
        level: 1,
        reason: "Try-catch blocks log nothing on failure",
        evidence: [],
        confidence: 4,
        isSystemic: false,
        isActionable: true,
      },
      {
        level: 2,
        reason: "No shared error-handling middleware exists across services",
        evidence: [],
        confidence: 4,
        isSystemic: true,
        isActionable: true,
      },
    ],
    rootCause: {
      level: 2,
      reason: "No shared error-handling middleware exists across services",
      evidence: [],
      confidence: 4,
      isSystemic: true,
      isActionable: true,
    },
    depth: 2,
    confidence: "High",
    terminationReason: "systemic-actionable",
    analysisTimestamp: NOW,
  };
}

describe("InitiativeGenerator", () => {
  const generator = new InitiativeGenerator();

  it("starts with an H1 title matching the initiative name", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc.startsWith(`# Improve Production Error Observability`)).toBe(true);
  });

  it("includes all required top-level sections in order", () => {
    const doc = generator.generate(makeInitiative());
    const requiredHeadings = [
      "## Executive Summary",
      "## Problem Statement",
      "## Evidence",
      "## Root Cause",
      "## Opportunity",
      "## Expected Outcomes",
      "## Success Metrics",
      "## Scope",
      "## Non-Scope",
      "## Alternatives Considered",
      "## Recommended Direction",
      "## Risks & Blockers",
      "## Dependencies",
      "## Open Questions",
      "## Decision Trace",
    ];

    let cursor = -1;
    for (const heading of requiredHeadings) {
      const idx = doc.indexOf(heading);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("renders the metadata block with owner and reviewers", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("| Owner | alice |");
    expect(doc).toContain("| Reviewers | bob, carol |");
  });

  it("groups evidence by type", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("### Code (1)");
    expect(doc).toContain("### Git History (1)");
    expect(doc).toContain("catch block discards error without logging");
  });

  it("marks root cause as UNKNOWN when no RCA is supplied", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("[UNKNOWN:");
  });

  it("renders a full why-chain when RCA is supplied", () => {
    const doc = generator.generate(makeInitiative(), { rca: makeRca() });
    expect(doc).toContain("No shared error-handling middleware exists across services");
    expect(doc).toContain("systemic-actionable");
    expect(doc).not.toContain("no RootCauseAnalysis was supplied");
  });

  it("never fabricates alternatives — always marks as placeholder", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("[PLACEHOLDER:");
  });

  it("includes the verbatim decision trace", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("Impact is high because production errors are invisible.");
  });

  it("links to the corresponding epic document", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("[Epic](./improve-error-observability-epic.md)");
  });

  it("inserts a table of contents when the document exceeds the line threshold", () => {
    const bigInit = makeInitiative({
      opportunity: {
        description: "Long opportunity",
        successCriteria: Array.from({ length: 300 }, (_, i) => `Criterion ${i}`),
        scope: ["Module A"],
        nonScope: ["Module B"],
      },
    });
    const doc = generator.generate(bigInit);
    expect(doc).toContain("## Table of Contents");
  });

  it("omits the table of contents for short documents", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).not.toContain("## Table of Contents");
  });
});
