/**
 * @file tech-spec-generator.test.ts
 * @description Tests for TechSpecGenerator: structure, diagram generation,
 * NFR derivation from risks, failure-mode rendering, and gap-marking.
 */

import { describe, it, expect } from "vitest";
import { TechSpecGenerator } from "../tech-spec-generator.ts";
import type { Initiative } from "../../schemas/types.ts";

const NOW = new Date().toISOString();

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: "INIT-003" as `INIT-${string}`,
    slug: "harden-auth-service",
    name: "Harden Auth Service Against Token Replay",
    status: "Proposed",
    problemStatement: {
      description: "Auth tokens can be replayed after logout because revocation is not enforced.",
      severity: "Critical",
      evidenceRefs: ["src/auth/session.ts:88"],
    },
    opportunity: {
      description: "Enforce token revocation on logout across all auth-consuming services.",
      successCriteria: ["Revoked tokens rejected within 1 request", "Zero replay incidents in security audit"],
      scope: ["Token revocation service", "Auth middleware revocation check"],
      nonScope: ["OAuth provider migration"],
    },
    evidence: [
      {
        source: "src/auth/session.ts",
        type: "code",
        location: { file: "src/auth/session.ts", line: 88, functionName: "logout", symbol: null },
        content: "logout() clears cookie but does not invalidate the token server-side",
        timestamp: NOW,
        validated: true,
        validatedAt: NOW,
      },
    ],
    scoring: {
      breakdown: { impact: 5, confidence: 4, urgency: 5, leverage: 3, cost: 4, risk: 3 },
      finalScore: 77,
      scoreConfidence: "High",
      decisionTrace: "Critical security gap with direct evidence of missing revocation.",
      derivationRules: "finalScore = round((I+C+U+L+(6-Cost)+(6-Risk))/30 * 100)",
    },
    findingRefs: ["FIND-003" as `FIND-${string}`],
    createdAt: NOW,
    updatedAt: NOW,
    owner: "erin",
    stakeholders: ["frank"],
    blockers: [],
    risks: [
      {
        description: "Security review may find additional auth vulnerabilities mid-implementation",
        likelihood: 2,
        impact: 4,
        owner: "erin",
        mitigation: "Timebox security review to sprint 1",
        status: "Open",
      },
      {
        description: "Revocation check adds latency to every authenticated request",
        likelihood: 3,
        impact: 3,
        owner: "erin",
        mitigation: "Cache revocation list with short TTL",
        status: "Open",
      },
    ],
    dependencies: [],
    openQuestions: [],
    ...overrides,
  };
}

describe("TechSpecGenerator", () => {
  const generator = new TechSpecGenerator();

  it("generates valid Markdown starting with an H1 title", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc.startsWith("# Technical Specification: Harden Auth Service Against Token Replay")).toBe(true);
  });

  it("includes all 12 numbered top-level sections in order", () => {
    const doc = generator.generate(makeInitiative());
    const requiredHeadings = [
      "## 1. Context & Goals",
      "## 2. Current State",
      "## 3. Proposed Solution",
      "## 4. Detailed Design",
      "## 5. Security & Non-Functional Requirements",
      "## 6. Failure Modes & Edge Cases",
      "## 7. Alternatives Considered",
      "## 8. Testing Strategy",
      "## 9. Rollout & Observability",
      "## 10. Rollback Plan",
      "## 11. Open Questions",
      "## 12. Related Artifacts",
    ];
    let cursor = -1;
    for (const heading of requiredHeadings) {
      const idx = doc.indexOf(heading);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("includes a Mermaid architecture diagram derived from scope", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("```mermaid");
    expect(doc).toContain("graph TB");
    expect(doc).toContain("Token revocation service");
  });

  it("documents failure modes from the initiative's risks", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("### Failure Scenario 1: Security review may find additional auth vulnerabilities");
    expect(doc).toContain("Cache revocation list with short TTL");
  });

  it("covers security requirements by matching security-keyword risks", () => {
    const secInit = makeInitiative({
      risks: [
        {
          description: "Security review may find additional auth vulnerabilities mid-implementation",
          likelihood: 2,
          impact: 4,
          owner: "erin",
          mitigation: "Timebox security review to sprint 1",
          status: "Open",
        },
      ],
    });
    const doc = generator.generate(secInit);
    const securityIdx = doc.indexOf("### Security");
    const performanceIdx = doc.indexOf("### Performance");
    const securitySection = doc.slice(securityIdx, performanceIdx);
    expect(securitySection).toContain("Security review may find additional auth vulnerabilities");
  });

  it("covers performance requirements by matching latency-keyword risks", () => {
    const doc = generator.generate(makeInitiative());
    const performanceIdx = doc.indexOf("### Performance");
    const scalabilityIdx = doc.indexOf("### Scalability");
    const performanceSection = doc.slice(performanceIdx, scalabilityIdx);
    expect(performanceSection).toContain("Revocation check adds latency");
  });

  it("defines a testing strategy derived from scope and success criteria", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("Unit coverage for: Token revocation service");
    expect(doc).toContain("Integration test verifying: Revoked tokens rejected within 1 request");
  });

  it("never fabricates rollout percentages — uses placeholders", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("[PLACEHOLDER: canary percentage and duration]");
  });

  it("links to the initiative and epic documents", () => {
    const doc = generator.generate(makeInitiative());
    expect(doc).toContain("[INIT-003](./harden-auth-service-initiative.md)");
    expect(doc).toContain("[Epic](./harden-auth-service-epic.md)");
  });

  it("marks current architecture as UNKNOWN when no code/config evidence exists", () => {
    const doc = generator.generate(makeInitiative({ evidence: [] as unknown as Initiative["evidence"] }));
    const currentStateIdx = doc.indexOf("### Architecture");
    const constraintsIdx = doc.indexOf("### Constraints");
    expect(doc.slice(currentStateIdx, constraintsIdx)).toContain("[UNKNOWN:");
  });
});
