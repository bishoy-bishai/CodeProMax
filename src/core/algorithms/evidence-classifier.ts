/**
 * @file evidence-classifier.ts
 * @description Rules-based evidence classification and confidence scoring.
 *
 * Classification rules (deterministic, no ML):
 *   FACT        — code or runtime evidence directly observed; multiple corroboration
 *   INFERENCE   — derived from 2+ consistent signals; not directly observed
 *   HYPOTHESIS  — fewer than 2 independent sources; needs verification
 *   UNKNOWN     — insufficient evidence to classify
 *
 * Confidence rules (applied in priority order):
 *   1. Runtime + code evidence present              → confidence 5
 *   2. 2+ independent source types                 → confidence 4
 *   3. 1 source, directly observed (code/test/git) → confidence 3
 *   4. 1 source, inferred/config                   → confidence 2
 *   5. Hypothesis only / UNKNOWN                   → confidence 1
 */

import type { EvidenceRecord, EvidenceType, FindingClassification, FindingConfidence } from "../../schemas/types.ts";
import type {
  ClassificationResult,
  EvidenceContradiction,
  EvidenceGap,
} from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Evidence types that constitute direct observation (highest epistemic value) */
const DIRECT_OBSERVATION_TYPES: ReadonlySet<EvidenceType> = new Set([
  "code",
  "test",
  "runtime",
]);

/** Evidence types that constitute indirect/inferred observation */
const INDIRECT_TYPES: ReadonlySet<EvidenceType> = new Set([
  "git",
  "config",
  "dependency",
  "documentation",
]);

/** Minimum number of independent source types for INFERENCE classification */
const INFERENCE_SOURCE_THRESHOLD = 2;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Extract unique evidence types from an array of records */
function getUniqueTypes(evidence: EvidenceRecord[]): EvidenceType[] {
  const seen = new Set<EvidenceType>();
  for (const rec of evidence) {
    seen.add(rec.type);
  }
  return Array.from(seen);
}

/** Check if both runtime AND code evidence are present */
function hasRuntimeAndCode(types: EvidenceType[]): boolean {
  return types.includes("runtime") && types.includes("code");
}

/** Detect contradiction: same file/line with conflicting content */
function detectContradictions(evidence: EvidenceRecord[]): EvidenceContradiction[] {
  const contradictions: EvidenceContradiction[] = [];

  for (let i = 0; i < evidence.length; i++) {
    for (let j = i + 1; j < evidence.length; j++) {
      const a = evidence[i];
      const b = evidence[j];

      if (a === undefined || b === undefined) continue;

      // Same source file + same line → expect same content
      if (
        a.location?.file !== null &&
        a.location?.file === b.location?.file &&
        a.location?.line !== null &&
        a.location?.line === b.location?.line &&
        a.content !== b.content
      ) {
        contradictions.push({
          description: `Evidence items ${i} and ${j} point to the same location (${a.location?.file}:${a.location?.line}) but have different content.`,
          evidenceIndices: [i, j],
        });
      }

      // Same source URL (non-file) with very different content length
      if (
        a.source === b.source &&
        a.type === b.type &&
        Math.abs(a.content.length - b.content.length) > 200
      ) {
        contradictions.push({
          description: `Evidence items ${i} and ${j} share the same source ("${a.source}") but have significantly different content, suggesting a stale record.`,
          evidenceIndices: [i, j],
        });
      }
    }
  }

  return contradictions;
}

/** Identify gaps: missing evidence types that would raise confidence */
function identifyGaps(
  presentTypes: EvidenceType[],
  classification: FindingClassification
): EvidenceGap[] {
  const gaps: EvidenceGap[] = [];

  if (!presentTypes.includes("runtime") && presentTypes.includes("code")) {
    gaps.push({
      description:
        "Code evidence is present but no runtime profiling/logs/metrics corroborate it. " +
        "Runtime validation would raise confidence to 5.",
      missingType: "runtime",
      confidencePenalty: 1,
    });
  }

  if (classification === "HYPOTHESIS" && !presentTypes.includes("test")) {
    gaps.push({
      description:
        "Hypothesis lacks test coverage evidence. A failing or missing test case " +
        "would elevate this to INFERENCE.",
      missingType: "test",
      confidencePenalty: 1,
    });
  }

  if (!presentTypes.includes("git") && presentTypes.length === 1) {
    gaps.push({
      description:
        "Only one evidence source. Git history (blame, frequency of touches) " +
        "would provide an independent corroboration signal.",
      missingType: "git",
      confidencePenalty: 0,
    });
  }

  return gaps;
}

/**
 * Clamp a number to the FindingConfidence range 1–5.
 * Using the literal union as the return type requires a cast here —
 * the upstream rules guarantee the value is always in [1,5].
 */
function clampConfidence(value: number): FindingConfidence {
  const clamped = Math.max(1, Math.min(5, Math.round(value)));
  return clamped as FindingConfidence;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class EvidenceClassifier {
  /**
   * Classify an array of evidence records, computing:
   * - Epistemic classification (FACT / INFERENCE / HYPOTHESIS / UNKNOWN)
   * - Confidence score (1–5)
   * - Human-readable reasoning
   * - Detected contradictions
   * - Identified evidence gaps
   *
   * @param evidence - Must be non-empty; pass at minimum one record
   * @throws {Error} if evidence array is empty
   */
  classify(evidence: EvidenceRecord[]): ClassificationResult {
    if (evidence.length === 0) {
      throw new Error(
        "EvidenceClassifier.classify() requires at least one evidence record. " +
          "A finding with no evidence is speculation, not a finding."
      );
    }

    const presentTypes = getUniqueTypes(evidence);
    const contradictions = detectContradictions(evidence);
    const reasoningParts: string[] = [];

    // ── STEP 1: Determine classification ──────────────────────────────────────

    let classification: FindingClassification;

    if (evidence.length === 1 && INDIRECT_TYPES.has(evidence[0]!.type)) {
      // Single indirect source: weakest epistemic state
      classification = "HYPOTHESIS";
      reasoningParts.push(
        `HYPOTHESIS: Only one evidence record present and it is of indirect type "${evidence[0]!.type}". ` +
          "This cannot be directly observed — it must be validated."
      );
    } else if (
      presentTypes.every((t) => INDIRECT_TYPES.has(t)) &&
      presentTypes.length < INFERENCE_SOURCE_THRESHOLD
    ) {
      classification = "HYPOTHESIS";
      reasoningParts.push(
        `HYPOTHESIS: All ${evidence.length} evidence record(s) are from indirect source types ` +
          `(${presentTypes.join(", ")}). Direct observation (code, test, runtime) is absent.`
      );
    } else if (
      presentTypes.some((t) => DIRECT_OBSERVATION_TYPES.has(t)) &&
      presentTypes.length >= INFERENCE_SOURCE_THRESHOLD
    ) {
      classification = "FACT";
      reasoningParts.push(
        `FACT: ${presentTypes.length} independent evidence types present including direct observation ` +
          `type(s) (${presentTypes.filter((t) => DIRECT_OBSERVATION_TYPES.has(t)).join(", ")}). ` +
          "Problem is directly observable."
      );
    } else if (presentTypes.length >= INFERENCE_SOURCE_THRESHOLD) {
      classification = "INFERENCE";
      reasoningParts.push(
        `INFERENCE: ${presentTypes.length} independent evidence types (${presentTypes.join(", ")}) ` +
          "converge on the same conclusion, but direct observation is absent."
      );
    } else if (presentTypes.some((t) => DIRECT_OBSERVATION_TYPES.has(t))) {
      // Single direct observation source
      classification = "FACT";
      reasoningParts.push(
        `FACT: Direct observation evidence of type "${presentTypes.find((t) => DIRECT_OBSERVATION_TYPES.has(t))}" ` +
          "is present. Problem is directly verifiable from source."
      );
    } else {
      classification = "UNKNOWN";
      reasoningParts.push(
        "UNKNOWN: Insufficient or unclassifiable evidence. Classification deferred — " +
          "must be resolved before this finding can be linked to an initiative."
      );
    }

    // ── STEP 2: Determine confidence ──────────────────────────────────────────

    let rawConfidence: number;
    let confidenceReason: string;

    if (classification === "UNKNOWN") {
      rawConfidence = 1;
      confidenceReason = "Confidence 1: Classification is UNKNOWN — no reliable basis for scoring.";
    } else if (classification === "HYPOTHESIS") {
      rawConfidence = evidence.length === 1 ? 1 : 2;
      confidenceReason = `Confidence ${rawConfidence}: Hypothesis with ${evidence.length} source(s). ` +
        "Rule: hypothesis = max confidence 2.";
    } else if (hasRuntimeAndCode(presentTypes)) {
      rawConfidence = 5;
      confidenceReason =
        "Confidence 5: Runtime evidence corroborates code evidence — highest epistemic certainty. " +
          "Rule: runtime + code = confidence 5.";
    } else if (presentTypes.length >= INFERENCE_SOURCE_THRESHOLD) {
      rawConfidence = 4;
      confidenceReason =
        `Confidence 4: ${presentTypes.length} independent source types agree. ` +
          "Rule: 2+ independent sources = confidence 4.";
    } else if (presentTypes.some((t) => DIRECT_OBSERVATION_TYPES.has(t))) {
      rawConfidence = 3;
      confidenceReason =
        "Confidence 3: Single direct-observation source (code, test, or runtime). " +
          "Rule: 1 direct source = confidence 3 max.";
    } else {
      rawConfidence = 2;
      confidenceReason =
        "Confidence 2: Single indirect source. " +
          "Rule: 1 indirect source = confidence 2.";
    }

    // Penalise for contradictions
    const contradictionPenalty = contradictions.length;
    if (contradictionPenalty > 0) {
      rawConfidence -= contradictionPenalty;
      reasoningParts.push(
        `Confidence reduced by ${contradictionPenalty} for ${contradictionPenalty} ` +
          `contradiction(s) detected in evidence.`
      );
    }

    // Penalise for unvalidated evidence
    const unvalidatedCount = evidence.filter((e) => !e.validated).length;
    if (unvalidatedCount > 0 && unvalidatedCount === evidence.length) {
      rawConfidence = Math.max(1, rawConfidence - 1);
      reasoningParts.push(
        `Confidence reduced by 1: all ${unvalidatedCount} evidence record(s) are unvalidated.`
      );
    }

    const confidence = clampConfidence(rawConfidence);
    reasoningParts.push(confidenceReason);

    const gaps = identifyGaps(presentTypes, classification);
    if (gaps.length > 0) {
      reasoningParts.push(
        `Gaps identified: ${gaps.map((g) => g.missingType).join(", ")} evidence would strengthen this finding.`
      );
    }

    return {
      classification,
      confidence,
      reasoning: reasoningParts.join(" | "),
      presentTypes,
      contradictions,
      gaps,
    };
  }
}
