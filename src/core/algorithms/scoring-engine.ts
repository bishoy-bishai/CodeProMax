/**
 * @file scoring-engine.ts
 * @description Deterministic scoring and ranking engine for Initiatives.
 *
 * Scoring formula (additive, 0-100 integer):
 *   finalScore = round((impact + confidence + urgency + leverage + (6-cost) + (6-risk)) / 30 * 100)
 *
 * Axes:
 *   impact     1-5  Business/user value if the problem is solved
 *   confidence 1-5  Certainty that the problem is real and the solution works
 *   urgency    1-5  Cost of delay (time pressure)
 *   leverage   1-5  Force-multiplier; does fixing this unlock other wins?
 *   cost       1-5  Implementation cost (INVERTED: cost=1 → high score, cost=5 → low score)
 *   risk       1-5  Execution risk (INVERTED: risk=1 → high score, risk=5 → low score)
 *
 * Score range: 20 (all axes at worst) – 100 (all axes at best)
 * Tie-breaking order: score desc → confidence desc → impact desc → cost asc
 *
 * DESIGN NOTE: The prompt described a ratio formula (Numerator/Denominator * 20).
 * The Phase 0.1 schema already codifies and cross-validates the additive formula,
 * so the scoring engine uses it for consistency. The additive formula avoids
 * division-by-zero edge cases and produces a more stable ranking surface.
 */

import type { Initiative, ScoringBreakdown, ScoreConfidence } from "../../schemas/types.ts";
import type {
  ScoringComputation,
  AxisRationale,
  RankedInitiative,
} from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DERIVATION_RULES =
  "finalScore = round((impact + confidence + urgency + leverage + (6-cost) + (6-risk)) / 30 * 100). " +
  "Axes: impact=business value, confidence=certainty, urgency=cost of delay, leverage=multiplier effect, " +
  "cost=implementation cost (inverted), risk=execution risk (inverted). Range: 20-100.";

const SCORE_CONFIDENCE_THRESHOLDS = {
  HIGH: 70,   // finalScore >= 70 AND high-quality evidence
  MEDIUM: 45, // finalScore >= 45
  // Below 45: Low
} as const;

// Per-axis rating descriptions for generating human-readable rationales
const AXIS_RATINGS: Record<number, string> = {
  1: "Minimal",
  2: "Low",
  3: "Moderate",
  4: "High",
  5: "Critical",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply the scoring formula to a breakdown.
 * Returns an integer in the range 20–100.
 */
function applyFormula(b: ScoringBreakdown): number {
  const raw = b.impact + b.confidence + b.urgency + b.leverage + (6 - b.cost) + (6 - b.risk);
  return Math.round((raw / 30) * 100);
}

/**
 * Determine score confidence based on final score and evidence quality signals.
 * Confidence reflects how trustworthy the score is, NOT how high it is.
 */
function deriveScoreConfidence(
  finalScore: number,
  evidenceCount: number,
  hasValidatedEvidence: boolean
): ScoreConfidence {
  if (
    finalScore >= SCORE_CONFIDENCE_THRESHOLDS.HIGH &&
    evidenceCount >= 2 &&
    hasValidatedEvidence
  ) {
    return "High";
  }
  if (finalScore >= SCORE_CONFIDENCE_THRESHOLDS.MEDIUM && evidenceCount >= 1) {
    return "Medium";
  }
  return "Low";
}

/** Describe an axis score in human-readable terms */
function describeAxis(axisName: string, score: number, isInverted: boolean): string {
  const label = AXIS_RATINGS[score] ?? "Unknown";
  if (isInverted) {
    // Cost and Risk: lower raw score → better outcome
    return `${axisName}: ${score}/5 (${label} — inverted; contributes ${6 - score} to score)`;
  }
  return `${axisName}: ${score}/5 (${label})`;
}

/** Build per-axis rationales from a breakdown */
function buildAxisRationales(b: ScoringBreakdown): AxisRationale[] {
  return [
    {
      axis: "impact",
      score: b.impact,
      rationale: `Impact ${b.impact}/5 — ${AXIS_RATINGS[b.impact] ?? "?"} business/user value if the problem is solved.`,
    },
    {
      axis: "confidence",
      score: b.confidence,
      rationale: `Confidence ${b.confidence}/5 — ${AXIS_RATINGS[b.confidence] ?? "?"} certainty that problem is real and solvable.`,
    },
    {
      axis: "urgency",
      score: b.urgency,
      rationale: `Urgency ${b.urgency}/5 — ${AXIS_RATINGS[b.urgency] ?? "?"} cost of delay (time pressure).`,
    },
    {
      axis: "leverage",
      score: b.leverage,
      rationale: `Leverage ${b.leverage}/5 — ${AXIS_RATINGS[b.leverage] ?? "?"} force-multiplier; does fixing this unlock other wins?`,
    },
    {
      axis: "cost",
      score: b.cost,
      rationale: `Cost ${b.cost}/5 — ${AXIS_RATINGS[b.cost] ?? "?"} implementation cost (inverted: cost=${b.cost} contributes ${6 - b.cost} to score).`,
    },
    {
      axis: "risk",
      score: b.risk,
      rationale: `Risk ${b.risk}/5 — ${AXIS_RATINGS[b.risk] ?? "?"} execution risk (inverted: risk=${b.risk} contributes ${6 - b.risk} to score).`,
    },
  ];
}

/** Generate a full decision trace narrative */
function buildDecisionTrace(
  initiative: Initiative,
  breakdown: ScoringBreakdown,
  finalScore: number,
  confidence: ScoreConfidence,
  rationales: AxisRationale[]
): string {
  const lines: string[] = [
    `=== Decision Trace: ${initiative.id} — "${initiative.name}" ===`,
    ``,
    ...rationales.map((r) => `  ${r.rationale}`),
    ``,
    `Score computation:`,
    `  (${breakdown.impact} + ${breakdown.confidence} + ${breakdown.urgency} + ${breakdown.leverage} + ${6 - breakdown.cost} + ${6 - breakdown.risk}) / 30 × 100`,
    `  = ${breakdown.impact + breakdown.confidence + breakdown.urgency + breakdown.leverage + (6 - breakdown.cost) + (6 - breakdown.risk)} / 30 × 100`,
    `  = ${finalScore} (rounded)`,
    ``,
    `Score confidence: ${confidence}`,
    `  Evidence records: ${initiative.evidence.length}`,
    `  Validated evidence: ${initiative.evidence.filter((e) => e.validated).length}`,
    ``,
    `Problem: ${initiative.problemStatement.description}`,
    `Severity: ${initiative.problemStatement.severity}`,
    `Owner: ${initiative.owner}`,
  ];

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export class ScoringEngine {
  /**
   * Compute a full scoring result for an initiative.
   *
   * The scoring engine does NOT modify the initiative — it returns a
   * ScoringComputation that the caller can apply to produce a new ScoringResult
   * and store on the initiative.
   *
   * @param initiative - Initiative with a breakdown already set
   *   (breakdown fields must be pre-filled by the analyst)
   * @returns Full computation including trace
   */
  computeScore(initiative: Initiative): ScoringComputation {
    const breakdown = initiative.scoring.breakdown;
    const finalScore = applyFormula(breakdown);
    const hasValidatedEvidence = initiative.evidence.some((e) => e.validated);
    const scoreConfidence = deriveScoreConfidence(
      finalScore,
      initiative.evidence.length,
      hasValidatedEvidence
    );
    const axisRationales = buildAxisRationales(breakdown);
    const decisionTrace = buildDecisionTrace(
      initiative,
      breakdown,
      finalScore,
      scoreConfidence,
      axisRationales
    );

    return {
      breakdown,
      finalScore,
      scoreConfidence,
      axisRationales,
      decisionTrace,
      derivationRules: DERIVATION_RULES,
    };
  }

  /**
   * Compute a score directly from a breakdown (without a full Initiative).
   * Useful during initiative creation, before the initiative is persisted.
   *
   * @param breakdown - Six-axis scoring breakdown (each 1–5)
   * @param context - Context string used in decision trace
   */
  computeFromBreakdown(
    breakdown: ScoringBreakdown,
    context: string = "Direct breakdown computation"
  ): Omit<ScoringComputation, "axisRationales"> & { axisRationales: AxisRationale[] } {
    const finalScore = applyFormula(breakdown);
    const scoreConfidence: ScoreConfidence =
      finalScore >= SCORE_CONFIDENCE_THRESHOLDS.HIGH ? "High" :
      finalScore >= SCORE_CONFIDENCE_THRESHOLDS.MEDIUM ? "Medium" : "Low";
    const axisRationales = buildAxisRationales(breakdown);

    const traceLines = [
      `=== Score Computation: ${context} ===`,
      "",
      ...axisRationales.map((r) => `  ${r.rationale}`),
      "",
      `  Formula: (${breakdown.impact}+${breakdown.confidence}+${breakdown.urgency}+${breakdown.leverage}+${6 - breakdown.cost}+${6 - breakdown.risk})/30×100 = ${finalScore}`,
      `  Score confidence: ${scoreConfidence} (based on score value; evidence quality unknown without full initiative)`,
    ];

    return {
      breakdown,
      finalScore,
      scoreConfidence,
      axisRationales,
      decisionTrace: traceLines.join("\n"),
      derivationRules: DERIVATION_RULES,
    };
  }

  /**
   * Rank a list of initiatives by score with explicit tie-breaking.
   *
   * Tie-breaking order:
   *   1. finalScore DESC
   *   2. scoreConfidence DESC (High > Medium > Low)
   *   3. breakdown.impact DESC
   *   4. breakdown.cost ASC (lower cost wins tie)
   *
   * @returns Sorted array with rank annotations
   */
  rank(initiatives: Initiative[]): RankedInitiative[] {
    const confidenceOrder: Record<ScoreConfidence, number> = {
      High: 3,
      Medium: 2,
      Low: 1,
    };

    const sorted = initiatives.slice().sort((a, b) => {
      // 1. Score descending
      const scoreDiff = b.scoring.finalScore - a.scoring.finalScore;
      if (scoreDiff !== 0) return scoreDiff;

      // 2. Score confidence descending
      const confDiff =
        confidenceOrder[b.scoring.scoreConfidence] -
        confidenceOrder[a.scoring.scoreConfidence];
      if (confDiff !== 0) return confDiff;

      // 3. Impact descending
      const impactDiff = b.scoring.breakdown.impact - a.scoring.breakdown.impact;
      if (impactDiff !== 0) return impactDiff;

      // 4. Cost ascending (lower cost wins)
      return a.scoring.breakdown.cost - b.scoring.breakdown.cost;
    });

    return sorted.map((initiative, index) => {
      const next = sorted[index + 1];
      let tiebreakReason: string | null = null;

      if (next !== undefined && initiative.scoring.finalScore === next.scoring.finalScore) {
        // Explain the tiebreak
        if (initiative.scoring.scoreConfidence !== next.scoring.scoreConfidence) {
          tiebreakReason = `Tied on score ${initiative.scoring.finalScore}; ranked by confidence (${initiative.scoring.scoreConfidence} > ${next.scoring.scoreConfidence}).`;
        } else if (initiative.scoring.breakdown.impact !== next.scoring.breakdown.impact) {
          tiebreakReason = `Tied on score and confidence; ranked by impact (${initiative.scoring.breakdown.impact} > ${next.scoring.breakdown.impact}).`;
        } else if (initiative.scoring.breakdown.cost !== next.scoring.breakdown.cost) {
          tiebreakReason = `Tied on score, confidence, and impact; ranked by cost (${initiative.scoring.breakdown.cost} < ${next.scoring.breakdown.cost}).`;
        } else {
          tiebreakReason = `Full tie on all tiebreak dimensions with next initiative — order is stable but arbitrary.`;
        }
      }

      return {
        rank: index + 1,
        initiativeId: initiative.id,
        initiativeSlug: initiative.slug,
        finalScore: initiative.scoring.finalScore,
        scoreConfidence: initiative.scoring.scoreConfidence,
        tiebreakReason,
      };
    });
  }

  /**
   * Validate that a stored finalScore matches the formula applied to its breakdown.
   * Returns null if valid; returns an error string if the score is inconsistent.
   */
  validateStoredScore(initiative: Initiative): string | null {
    const expected = applyFormula(initiative.scoring.breakdown);
    const actual = initiative.scoring.finalScore;
    if (Math.abs(expected - actual) > 1) {
      return (
        `Score mismatch for ${initiative.id}: stored=${actual}, formula yields=${expected}. ` +
        `Breakdown: ${JSON.stringify(initiative.scoring.breakdown)}.`
      );
    }
    return null;
  }
}
