/**
 * @file tech-spec-sections.ts
 * @description Section-builder functions for the Technical Specification document.
 * Same no-fabrication rule as the initiative/epic sections: every claim traces
 * back to Initiative data (scope, risks, evidence, scoring) or is explicitly
 * marked [PLACEHOLDER]/[UNKNOWN] for a human to fill in.
 */

import type { EvidenceRecord, Initiative, RiskItem } from "../../schemas/types.ts";
import { bulletList, placeholder, unknownMarker } from "./markdown-utils.ts";

// ─────────────────────────────────────────────────────────────────────────────
// GOALS / NON-GOALS / METRICS
// ─────────────────────────────────────────────────────────────────────────────

export function generateGoals(init: Initiative): string {
  return bulletList(init.opportunity.scope, unknownMarker("no in-scope items defined"));
}

export function generateNonGoals(init: Initiative): string {
  return bulletList(init.opportunity.nonScope, unknownMarker("no explicit non-scope defined"));
}

export function generateTechMetrics(init: Initiative): string {
  const b = init.scoring.breakdown;
  return [
    "| Axis | Score (1-5) |",
    "|---|---|",
    `| Impact | ${b.impact} |`,
    `| Confidence | ${b.confidence} |`,
    `| Urgency | ${b.urgency} |`,
    `| Leverage | ${b.leverage} |`,
    `| Cost (inverse) | ${b.cost} |`,
    `| Risk (inverse) | ${b.risk} |`,
    "",
    "**Functional success criteria:**",
    "",
    bulletList(init.opportunity.successCriteria, unknownMarker("no success criteria defined")),
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENT STATE
// ─────────────────────────────────────────────────────────────────────────────

function evidenceTouchpoints(evidence: readonly EvidenceRecord[]): string[] {
  return evidence
    .filter((e) => e.type === "code" || e.type === "config")
    .map((e) => {
      const loc =
        e.location !== null && e.location.file !== null
          ? `${e.location.file}${e.location.line !== null ? `:${e.location.line}` : ""}`
          : e.source;
      return `${loc} — ${e.content}`;
    });
}

export function generateCurrentArchitecture(init: Initiative): string {
  const touchpoints = evidenceTouchpoints(init.evidence);
  if (touchpoints.length === 0) {
    return unknownMarker(
      "no code/config evidence attached to this initiative — document the current architecture manually"
    );
  }
  return ["**Known touchpoints (from evidence):**", "", bulletList(touchpoints, "")].join("\n");
}

export function generateConstraints(init: Initiative): string {
  const constraintLike = [...init.risks, ...init.blockers].filter(
    (r) => r.status === "Open" || r.status === "Accepted"
  );
  if (constraintLike.length === 0) {
    return placeholder("no constraints captured — list technical, organizational, or timeline constraints here");
  }
  return bulletList(
    constraintLike.map((r) => `${r.description} (owner: ${r.owner})`),
    ""
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE DIAGRAM
// ─────────────────────────────────────────────────────────────────────────────

function mermaidNodeId(prefix: string, i: number): string {
  return `${prefix}${i}`;
}

/** Sanitize free text for use inside a Mermaid node label */
function mermaidLabel(text: string): string {
  return text.replace(/["\[\]{}()]/g, "").slice(0, 60);
}

/**
 * Derive a best-effort component diagram from the initiative's scope items.
 * This is illustrative — it reflects declared scope, not a verified topology.
 */
export function generateArchitectureDiagram(init: Initiative): string {
  if (init.opportunity.scope.length === 0) {
    return `graph TB\n    Unknown["${unknownMarker("no scope items to derive a diagram from")}"]`;
  }

  const lines = ["graph TB", '    Client["Client"]'];
  let previous = "Client";

  init.opportunity.scope.forEach((item, i) => {
    const id = mermaidNodeId("Scope", i);
    lines.push(`    ${id}["${mermaidLabel(item)}"]`);
    lines.push(`    ${previous} --> ${id}`);
    previous = id;
  });

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN OVERVIEW / COMPONENTS / DATA MODELS / API CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────

export function generateDesignOverview(init: Initiative): string {
  return init.opportunity.description;
}

export function generateComponents(init: Initiative): string {
  if (init.opportunity.scope.length === 0) {
    return unknownMarker("no scope items to enumerate as components");
  }
  return init.opportunity.scope
    .map((item) => `### ${item}\n\n${placeholder("responsibilities, inputs/outputs, and ownership for this component")}`)
    .join("\n\n");
}

export function generateDataModels(init: Initiative): string {
  return placeholder(
    `data model changes for "${init.name}" — enumerate new/modified schemas, fields, and migrations here`
  );
}

export function generateAPIContracts(init: Initiative): string {
  return placeholder(
    `API contract changes for "${init.name}" — enumerate new/modified endpoints, request/response shapes, and versioning here`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NON-FUNCTIONAL REQUIREMENTS (derived from risk keywords)
// ─────────────────────────────────────────────────────────────────────────────

type NfrCategory = "security" | "performance" | "scalability" | "reliability";

const NFR_KEYWORDS: Record<NfrCategory, string[]> = {
  security: ["security", "auth", "credential", "vulnerab", "injection", "compliance"],
  performance: ["latency", "performance", "slow", "throughput", "timeout"],
  scalability: ["scale", "scalability", "load", "capacity", "concurrency"],
  reliability: ["reliab", "availability", "outage", "downtime", "failure"],
};

function risksForCategory(risks: readonly RiskItem[], category: NfrCategory): RiskItem[] {
  const keywords = NFR_KEYWORDS[category];
  return risks.filter((r) => keywords.some((kw) => r.description.toLowerCase().includes(kw)));
}

function renderNfrSection(
  init: Initiative,
  category: NfrCategory,
  guidance: string
): string {
  const matches = risksForCategory([...init.risks, ...init.blockers], category);
  if (matches.length === 0) {
    return placeholder(`${guidance} — no ${category}-related risks captured on this initiative`);
  }
  return bulletList(
    matches.map((r) => `${r.description} — mitigation: ${r.mitigation} (owner: ${r.owner})`),
    ""
  );
}

export function generateSecurity(init: Initiative): string {
  return renderNfrSection(init, "security", "document authn/authz, data handling, and threat model impacts");
}

export function generatePerformance(init: Initiative): string {
  return renderNfrSection(init, "performance", "document expected latency/throughput impact and benchmarks");
}

export function generateScalability(init: Initiative): string {
  return renderNfrSection(init, "scalability", "document load assumptions and scaling limits");
}

export function generateReliability(init: Initiative): string {
  return renderNfrSection(init, "reliability", "document availability targets and failure tolerance");
}

// ─────────────────────────────────────────────────────────────────────────────
// FAILURE MODES & EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

export function generateFailures(init: Initiative): string {
  const all = [...init.risks, ...init.blockers];
  if (all.length === 0) {
    return unknownMarker("no risks/blockers recorded — enumerate failure scenarios manually");
  }
  return all
    .map(
      (r, i) =>
        `### Failure Scenario ${i + 1}: ${r.description}\n\n` +
        `- **Likelihood:** ${r.likelihood}/5 — **Impact:** ${r.impact}/5\n` +
        `- **Detection:** ${placeholder("how this failure is detected in production")}\n` +
        `- **Recovery:** ${r.mitigation}\n` +
        `- **Owner:** ${r.owner} — **Status:** ${r.status}`
    )
    .join("\n\n");
}

export function generateEdgeCases(): string {
  return placeholder(
    "edge cases (empty inputs, concurrent writes, partial failures, malformed data, etc.) — enumerate during implementation review"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTING STRATEGY
// ─────────────────────────────────────────────────────────────────────────────

export function generateUnitTestStrategy(init: Initiative): string {
  if (init.opportunity.scope.length === 0) {
    return unknownMarker("no scope items to derive unit test coverage from");
  }
  return bulletList(
    init.opportunity.scope.map((item) => `Unit coverage for: ${item}`),
    ""
  );
}

export function generateIntegrationTestStrategy(init: Initiative): string {
  return bulletList(
    init.opportunity.successCriteria.map((c) => `Integration test verifying: ${c}`),
    unknownMarker("no success criteria to derive integration coverage from")
  );
}

export function generateE2ETestStrategy(init: Initiative): string {
  return placeholder(
    `end-to-end test scenarios exercising the full "${init.name}" flow through the primary user/system path`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLLOUT & OBSERVABILITY
// ─────────────────────────────────────────────────────────────────────────────

export function generateRolloutPhases(): string {
  return [
    `1. **Internal/dogfood** — ${placeholder("internal cohort and duration")}`,
    `2. **Canary** — ${placeholder("canary percentage and duration")}`,
    `3. **Progressive rollout** — ${placeholder("rollout percentage steps and duration")}`,
    `4. **Full rollout** — ${placeholder("completion criteria")}`,
  ].join("\n");
}

export function generateFeatureFlags(init: Initiative): string {
  return placeholder(`feature flag name(s) gating "${init.name}", plus default state and kill-switch owner`);
}

export function generateMonitoring(init: Initiative): string {
  if (init.opportunity.successCriteria.length === 0) {
    return unknownMarker("no success criteria to derive monitoring signals from");
  }
  return bulletList(
    init.opportunity.successCriteria.map((c) => `Alert/metric tracking: ${c}`),
    ""
  );
}

export function generateDashboards(): string {
  return placeholder("dashboard link(s) — create before rollout begins");
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLLBACK PLAN
// ─────────────────────────────────────────────────────────────────────────────

export function generateRollbackPlan(init: Initiative): string {
  return [
    `Disable via the feature flag(s) listed in [Feature Flags](#feature-flags) — no code deploy required for rollback.`,
    "",
    `**Data migrations:** ${placeholder("whether any migration in this initiative is reversible, and the reversal procedure")}`,
    "",
    `**Rollback owner:** ${init.owner}`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function generateTechQuestions(init: Initiative): string {
  if (init.openQuestions.length === 0) {
    return `- ${unknownMarker("no open questions recorded on the initiative — add implementation-specific questions here")}`;
  }
  return init.openQuestions
    .map((q) => {
      const due = q.dueBy !== null ? q.dueBy : placeholder("due date");
      const status = q.answer !== null ? `Resolved: ${q.answer}` : "Unresolved";
      return `- **${q.question}** — assignee: ${q.assignee}, due: ${due}, status: ${status}`;
    })
    .join("\n");
}
