/**
 * @file initiative-factory.ts
 * @description Converts Opportunity + Finding + RootCauseAnalysis → Initiative.
 *
 * Score derivation heuristics:
 *
 * Impact   = f(finding.classification, finding.confidence, rca.rootCause.isSystemic)
 * Confidence = finding.confidence (direct mapping from evidence quality)
 * Urgency  = f(finding.description keywords: deprecated, critical, churn, repeated)
 * Leverage = f(rca.rootCause.isSystemic, rca.depth, opportunity.scope.length)
 * Cost     = f(finding.description keywords: heuristic for implementation effort)
 * Risk     = f(rca.depth, rca.rootCause.isSystemic, finding severity)
 *
 * All axis scores are clamped to [1, 5] and the final score is computed using:
 *   finalScore = round((impact + confidence + urgency + leverage + (6-cost) + (6-risk)) / 30 × 100)
 *
 * The ScoringEngine.computeFromBreakdown() produces the full decision trace.
 */

import type {
  Initiative,
  InitiativeId,
  AxisScore,
  ScoringBreakdown,
  ProblemSeverity,
  EvidenceRecord,
} from "../schemas/types.ts";
import type { Finding } from "../schemas/types.ts";
import type { RootCauseAnalysis } from "../analyzers/types.ts";
import type { Opportunity, DerivedScores } from "./types.ts";
import { ScoringEngine } from "../core/algorithms/scoring-engine.ts";

const scoringEngine = new ScoringEngine();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function clampAxis(n: number): AxisScore {
  return Math.max(1, Math.min(5, Math.round(n))) as AxisScore;
}

function createIdGenerator(): () => InitiativeId {
  let counter = 0;
  return (): InitiativeId => {
    counter++;
    return `INIT-${String(counter).padStart(3, "0")}` as InitiativeId;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE DERIVATION
// ─────────────────────────────────────────────────────────────────────────────

/** Derive axis scores from finding + RCA using documented heuristics */
function deriveScores(
  finding: Finding,
  rca: RootCauseAnalysis
): DerivedScores {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  // ── Impact ────────────────────────────────────────────────────────────────
  // FACT = 4, INFERENCE = 3, HYPOTHESIS = 2 (base)
  // +1 if root cause is systemic (wide blast radius)
  const classificationBase =
    finding.classification === "FACT" ? 4 :
    finding.classification === "INFERENCE" ? 3 : 2;
  const impact = classificationBase + (rca.rootCause.isSystemic ? 1 : 0);

  // ── Confidence ────────────────────────────────────────────────────────────
  // Direct: use the evidence confidence from the finding (1–5)
  const confidence = finding.confidence;

  // ── Urgency ───────────────────────────────────────────────────────────────
  // Critical/deprecated/security → 5; churn/repeated → 4; production → 3; else 2
  const urgency =
    text.includes("deprecated") || text.includes("security") || text.includes("critical") ? 5 :
    text.includes("churn") || text.includes("repeated") || text.includes("hotspot") ? 4 :
    text.includes("production") || text.includes("high") ? 3 : 2;

  // ── Leverage ──────────────────────────────────────────────────────────────
  // Systemic + actionable + deep RCA → high leverage
  const leverageBase = rca.rootCause.isSystemic && rca.rootCause.isActionable ? 4 : 2;
  const leverageDepth = rca.depth >= 3 ? 1 : 0; // deep RCA implies broad root cause
  const leverage = leverageBase + leverageDepth;

  // ── Cost ──────────────────────────────────────────────────────────────────
  // Low number = easy (contributes more to score since score uses 6-cost)
  // "dependency" or "duplicate" → 2 (easy to fix)
  // "error handling" or "coverage" → 2
  // "coupling" or "architecture" → 4 (hard — many files, risk of breakage)
  // "large function" → 3 (medium effort)
  const cost =
    text.includes("dependency") || text.includes("duplicate") || text.includes("outdated") ? 2 :
    text.includes("error handling") || text.includes("coverage") || text.includes("test") ? 2 :
    text.includes("coupling") || text.includes("architecture") || text.includes("boundary") ? 4 :
    text.includes("large function") || text.includes("complex") ? 3 : 3;

  // ── Risk ──────────────────────────────────────────────────────────────────
  // Low number = risky (contributes more to score since score uses 6-risk)
  // Deep systemic changes = higher risk
  // Dependency swaps = medium risk (need testing)
  // Error handling patches = low risk
  const risk =
    rca.rootCause.isSystemic && rca.depth >= 3 ? 3 :
    text.includes("dependency") || text.includes("package") ? 3 :
    text.includes("coupling") || text.includes("architecture") ? 4 :
    2;

  return {
    impact: clampAxis(impact),
    confidence: clampAxis(confidence),
    urgency: clampAxis(urgency),
    leverage: clampAxis(leverage),
    cost: clampAxis(cost),
    risk: clampAxis(risk),
  };
}

/** Severity → ProblemSeverity mapping */
function toSeverity(severity: ProblemSeverity): ProblemSeverity {
  return severity;
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export class InitiativeFactory {
  private readonly nextId: () => InitiativeId;

  constructor() {
    this.nextId = createIdGenerator();
  }

  /**
   * Create an Initiative from an Opportunity, its source Finding, and RCA.
   *
   * All axis scores are derived from evidence — never fabricated.
   * The full decision trace is generated by ScoringEngine.
   *
   * @param opportunity - The outcome-oriented opportunity
   * @param finding - The source finding
   * @param rca - The root cause analysis for the finding
   * @returns A fully populated Initiative in "Proposed" status
   */
  create(
    opportunity: Opportunity,
    finding: Finding,
    rca: RootCauseAnalysis
  ): Initiative {
    const id = this.nextId();
    const now = new Date().toISOString();
    const derived = deriveScores(finding, rca);

    const breakdown: ScoringBreakdown = {
      impact: clampAxis(derived.impact),
      confidence: clampAxis(derived.confidence),
      urgency: clampAxis(derived.urgency),
      leverage: clampAxis(derived.leverage),
      cost: clampAxis(derived.cost),
      risk: clampAxis(derived.risk),
    };

    // Create a minimal initiative shell for the scoring engine to compute the trace
    const shell: Initiative = buildShell(id, opportunity, finding, rca, breakdown, now);
    const computation = scoringEngine.computeScore(shell);

    // Return the fully populated initiative with computed scores
    return {
      ...shell,
      scoring: {
        breakdown,
        finalScore: computation.finalScore,
        scoreConfidence: computation.scoreConfidence,
        decisionTrace: computation.decisionTrace,
        derivationRules: computation.derivationRules,
      },
    };
  }

  /**
   * Create initiatives for a batch of (opportunity, finding, rca) triples.
   * Order is preserved; failed creations are skipped with a warning.
   */
  createAll(
    triples: ReadonlyArray<{
      opportunity: Opportunity;
      finding: Finding;
      rca: RootCauseAnalysis;
    }>
  ): { initiatives: Initiative[]; warnings: string[] } {
    const initiatives: Initiative[] = [];
    const warnings: string[] = [];

    for (const { opportunity, finding, rca } of triples) {
      try {
        initiatives.push(this.create(opportunity, finding, rca));
      } catch (err) {
        warnings.push(
          `InitiativeFactory.create failed for finding ${finding.id}: ` +
          `${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return { initiatives, warnings };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE SHELL BUILDER (keeps create() readable)
// ─────────────────────────────────────────────────────────────────────────────

function buildShell(
  id: InitiativeId,
  opportunity: Opportunity,
  finding: Finding,
  rca: RootCauseAnalysis,
  breakdown: ScoringBreakdown,
  now: string
): Initiative {
  const evidenceRefs = finding.evidence.map(
    (e: EvidenceRecord) =>
      e.location !== null
        ? `${e.location.file}:${e.location.line ?? "?"}`
        : e.source
  );

  return {
    id,
    slug: opportunity.slug,
    name: opportunity.name,
    status: "Proposed",
    problemStatement: {
      description: finding.description,
      severity: toSeverity(opportunity.severity),
      evidenceRefs,
    },
    opportunity: {
      description: opportunity.description,
      successCriteria: opportunity.successCriteria,
      scope: opportunity.scope,
      nonScope: opportunity.nonScope,
    },
    evidence: finding.evidence,
    scoring: {
      breakdown,
      // Placeholder — will be overwritten with computed values in create()
      finalScore: 0,
      scoreConfidence: "Low",
      decisionTrace: "",
      derivationRules: "round((I+C+U+L+(6-Cost)+(6-Risk))/30×100)",
    },
    findingRefs: [finding.id],
    createdAt: now,
    updatedAt: now,
    owner: "<unassigned>",
    stakeholders: [],
    blockers: [],
    risks: [],
    dependencies: [],
    openQuestions: [
      {
        question: `Who will own the implementation of "${opportunity.name}"?`,
        assignee: null,
        dueBy: null,
        answer: null,
        resolvedAt: null,
      },
    ],
  };
}
