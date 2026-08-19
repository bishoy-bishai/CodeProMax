/**
 * @file initiative-sections.ts
 * @description Section-builder functions for the strategic Initiative document.
 * Each function renders one Markdown section body (no heading) from real
 * Initiative data — never fabricated. Missing data is marked with the
 * [PLACEHOLDER]/[UNKNOWN] conventions from markdown-utils.ts.
 */

import type { EvidenceRecord, EvidenceType, Initiative } from "../../schemas/types.ts";
import type { RootCauseAnalysis } from "../../analyzers/types.ts";
import { bulletList, placeholder, unknownMarker } from "./markdown-utils.ts";

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTIVE SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export function generateExecutiveSummary(init: Initiative): string {
  return (
    `${init.problemStatement.description} ` +
    `We propose to ${init.opportunity.description.charAt(0).toLowerCase()}${init.opportunity.description.slice(1)} ` +
    `Expected impact: ${init.scoring.finalScore}/100 (${init.scoring.scoreConfidence} confidence) — ` +
    `${init.scoring.decisionTrace.split(".")[0] ?? init.scoring.decisionTrace}.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM STATEMENT
// ─────────────────────────────────────────────────────────────────────────────

export function generateProblemStatement(init: Initiative): string {
  return [
    init.problemStatement.description,
    "",
    `**Severity:** ${init.problemStatement.severity}`,
    "",
    "**Evidence references:**",
    bulletList(init.problemStatement.evidenceRefs, unknownMarker("no evidence references recorded")),
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE
// ─────────────────────────────────────────────────────────────────────────────

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  code: "Code",
  test: "Tests",
  git: "Git History",
  config: "Configuration",
  runtime: "Runtime",
  dependency: "Dependencies",
  documentation: "Documentation",
};

function renderEvidenceGroup(type: EvidenceType, evidence: readonly EvidenceRecord[]): string {
  const matches = evidence.filter((e) => e.type === type);
  if (matches.length === 0) return "";

  const lines = matches.map((e) => {
    const location =
      e.location !== null && e.location.file !== null
        ? `${e.location.file}${e.location.line !== null ? `:${e.location.line}` : ""}`
        : e.source;
    const status = e.validated ? "validated" : "unvalidated";
    return `- **${location}** (${status}): ${e.content}`;
  });

  return `### ${EVIDENCE_TYPE_LABELS[type]} (${matches.length})\n\n${lines.join("\n")}`;
}

export function generateEvidenceSection(evidence: readonly EvidenceRecord[]): string {
  const types: EvidenceType[] = [
    "code",
    "test",
    "git",
    "config",
    "runtime",
    "dependency",
    "documentation",
  ];

  const groups = types.map((type) => renderEvidenceGroup(type, evidence)).filter((g) => g !== "");

  if (groups.length === 0) {
    return unknownMarker("no evidence recorded for this initiative");
  }

  return groups.join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE
// ─────────────────────────────────────────────────────────────────────────────

export function generateRootCauseSection(init: Initiative, rca?: RootCauseAnalysis | null): string {
  if (rca === undefined || rca === null) {
    return [
      `**Root cause:** ${unknownMarker(
        "no RootCauseAnalysis was supplied to the generator — run RootCauseAnalyzer and pass its result via GeneratorOptions.rca for a full 5-Whys trace"
      )}`,
      "",
      `**Available context:** ${init.problemStatement.description}`,
    ].join("\n");
  }

  const whyChain = rca.causes
    .map(
      (c) =>
        `${c.level}. ${c.reason} _(confidence ${c.confidence}/5, ${c.evidence.length} evidence item${
          c.evidence.length === 1 ? "" : "s"
        }, ${c.isSystemic ? "systemic" : "isolated"}, ${c.isActionable ? "actionable" : "non-actionable"})_`
    )
    .join("\n");

  return [
    `**Root cause:** ${rca.rootCause.reason}`,
    "",
    `**Systemic:** ${rca.rootCause.isSystemic ? "Yes" : "No"} — **Actionable:** ${
      rca.rootCause.isActionable ? "Yes" : "No"
    } — **Analysis confidence:** ${rca.confidence}`,
    "",
    "### Why Chain",
    "",
    whyChain,
    "",
    `**Chain terminated because:** ${rca.terminationReason}`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY
// ─────────────────────────────────────────────────────────────────────────────

export function generateOpportunitySection(init: Initiative): string {
  return [
    init.opportunity.description,
    "",
    "**Success criteria:**",
    bulletList(init.opportunity.successCriteria, unknownMarker("no success criteria defined")),
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPECTED OUTCOMES
// ─────────────────────────────────────────────────────────────────────────────

export function generateOutcomesSection(init: Initiative): string {
  return bulletList(
    init.opportunity.successCriteria,
    unknownMarker("no measurable outcomes defined")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS METRICS
// ─────────────────────────────────────────────────────────────────────────────

export function generateMetricsSection(init: Initiative): string {
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
    `**Final score:** ${init.scoring.finalScore}/100 (${init.scoring.scoreConfidence} confidence)`,
    "",
    `**Derivation:** ${init.scoring.derivationRules}`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// ALTERNATIVES CONSIDERED
// ─────────────────────────────────────────────────────────────────────────────

export function generateAlternativesSection(): string {
  return placeholder(
    "alternatives considered are not captured on the Initiative record — document them here before this initiative is finalized"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDED DIRECTION
// ─────────────────────────────────────────────────────────────────────────────

export function generateRecommendationSection(init: Initiative): string {
  return (
    `Proceed with "${init.name}" as scoped in Opportunity above. ` +
    `Scoring (${init.scoring.finalScore}/100, ${init.scoring.scoreConfidence} confidence) reflects: ${init.scoring.decisionTrace}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RISKS & BLOCKERS
// ─────────────────────────────────────────────────────────────────────────────

export function generateRisksSection(init: Initiative): string {
  const renderRisk = (r: (typeof init.risks)[number]): string =>
    `- **${r.description}** — likelihood ${r.likelihood}/5, impact ${r.impact}/5, status: ${r.status}, ` +
    `owner: ${r.owner}, mitigation: ${r.mitigation}`;

  const blockers =
    init.blockers.length > 0
      ? init.blockers.map(renderRisk).join("\n")
      : `- ${unknownMarker("no active blockers recorded")}`;

  const risks =
    init.risks.length > 0
      ? init.risks.map(renderRisk).join("\n")
      : `- ${unknownMarker("no risks recorded")}`;

  return ["### Blockers", "", blockers, "", "### Risks", "", risks].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────

export function generateDependenciesSection(init: Initiative): string {
  return bulletList(
    init.dependencies.map((id) => `[${id}](./${id.toLowerCase()}-initiative.md)`),
    "None recorded"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function generateQuestionsSection(init: Initiative): string {
  if (init.openQuestions.length === 0) {
    return `- ${unknownMarker("no open questions recorded")}`;
  }

  return init.openQuestions
    .map((q) => {
      const due = q.dueBy !== null ? q.dueBy : placeholder("due date");
      const status = q.answer !== null ? `Resolved: ${q.answer}` : "Unresolved";
      return `- **${q.question}** — assignee: ${q.assignee}, due: ${due}, status: ${status}`;
    })
    .join("\n");
}
