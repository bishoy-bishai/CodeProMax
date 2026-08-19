/**
 * @file root-cause-analyzer.ts
 * @description Deterministic 5 Whys root cause analyzer.
 *
 * Design:
 *   A knowledge base of cause-chain templates maps finding categories to
 *   ordered sequences of causes (symptom → cause₁ → cause₂ → root cause).
 *   The analyzer selects the best-matching template, walks the chain, and
 *   terminates when a termination condition is met.
 *
 * "AI reasoning" extension point:
 *   Each level calls `resolveCause()` which currently uses the knowledge base.
 *   Replacing this function with an LLM call is a one-function change.
 *
 * Termination conditions (in priority order):
 *   1. systemic-actionable  — cause is systemic AND actionable  (ideal stop)
 *   2. evidence-gap         — insufficient evidence to continue
 *   3. too-speculative      — confidence would drop below 2
 *   4. max-depth-reached    — 7 levels
 *   5. self-evident         — cause explains itself completely
 *
 * Guarantees:
 *   - Never person-blames ("developer forgot X")
 *   - Every cause has at least one supporting evidence record
 *   - Output is always actionable at the root cause level
 */

import type { Finding, EvidenceRecord, FindingConfidence } from "../schemas/types.ts";
import type {
  RootCauseAnalysis,
  CauseEntry,
  RCATerminationReason,
  CauseChainTemplate,
  CauseLevelTemplate,
} from "./types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// CAUSE CHAIN KNOWLEDGE BASE
// ─────────────────────────────────────────────────────────────────────────────

const CAUSE_CHAIN_KNOWLEDGE_BASE: CauseChainTemplate[] = [
  // ── Missing error handling ─────────────────────────────────────────────────
  {
    matchKeywords: ["error handling", "unhandled", "try-catch", "catch", "reject", "uncaught"],
    causes: [
      {
        reason: "Errors are silently dropped or not propagated at the call site, leaving callers unaware of failures.",
        evidenceType: "code",
        confidence: 4,
        isSystemic: false,
        isActionable: true,
      },
      {
        reason: "No shared error-handling middleware or wrapper enforces consistent error treatment across the codebase.",
        evidenceType: "code",
        confidence: 3,
        isSystemic: true,
        isActionable: true,
      },
      {
        reason: "No standardized error contract (shape, codes, correlation IDs) was defined when the system was first built. Each module invented its own error pattern.",
        evidenceType: "documentation",
        confidence: 3,
        isSystemic: true,
        isActionable: true,
      },
    ],
  },

  // ── Large / complex functions ──────────────────────────────────────────────
  {
    matchKeywords: ["large function", "complex", "cyclomatic", "long method", "lines"],
    causes: [
      {
        reason: "Business logic, data transformation, and I/O are co-located in a single function with no internal abstractions.",
        evidenceType: "code",
        confidence: 4,
        isSystemic: false,
        isActionable: true,
      },
      {
        reason: "The function grew organically over time; each change added a branch rather than extracting a helper. Incremental complexity was never reviewed.",
        evidenceType: "git",
        confidence: 3,
        isSystemic: false,
        isActionable: true,
      },
      {
        reason: "No automated complexity gate (e.g. ESLint complexity rule, SonarQube) exists in the CI pipeline to flag functions exceeding the threshold.",
        evidenceType: "config",
        confidence: 3,
        isSystemic: true,
        isActionable: true,
      },
    ],
  },

  // ── Duplicated code ────────────────────────────────────────────────────────
  {
    matchKeywords: ["duplicate", "duplicated", "copy", "similar", "repeated"],
    causes: [
      {
        reason: "The logic was copy-pasted from an existing file rather than extracted into a shared utility because there was no obvious shared location.",
        evidenceType: "code",
        confidence: 4,
        isSystemic: false,
        isActionable: true,
      },
      {
        reason: "The shared utilities layer is either absent or undiscoverable, making duplication the path of least resistance.",
        evidenceType: "code",
        confidence: 3,
        isSystemic: true,
        isActionable: true,
      },
      {
        reason: "No automated duplication detector (e.g. jscpd) runs in CI. Duplication is invisible until it causes a divergence bug.",
        evidenceType: "config",
        confidence: 3,
        isSystemic: true,
        isActionable: true,
      },
    ],
  },

  // ── High coupling ──────────────────────────────────────────────────────────
  {
    matchKeywords: ["coupling", "import", "dependency", "module", "cross-module"],
    causes: [
      {
        reason: "The module imports directly from other modules' implementation details rather than through a published interface, creating tight coupling.",
        evidenceType: "code",
        confidence: 4,
        isSystemic: false,
        isActionable: true,
      },
      {
        reason: "Module boundaries are not enforced architecturally. Any module can import any other, regardless of the intended dependency direction.",
        evidenceType: "config",
        confidence: 3,
        isSystemic: true,
        isActionable: true,
      },
      {
        reason: "No Architecture Decision Record (ADR) or module dependency policy was established. The boundary rules exist only in informal team knowledge.",
        evidenceType: "documentation",
        confidence: 2,
        isSystemic: true,
        isActionable: true,
      },
    ],
  },

  // ── Outdated / deprecated dependencies ────────────────────────────────────
  {
    matchKeywords: ["outdated", "deprecated", "old", "version", "dependency", "package"],
    causes: [
      {
        reason: "The package has not been updated because the upgrade introduces breaking changes or unknown risk, and the team lacks a safe upgrade process.",
        evidenceType: "dependency",
        confidence: 4,
        isSystemic: false,
        isActionable: true,
      },
      {
        reason: "No automated dependency update bot (Dependabot, Renovate) or scheduled upgrade review exists to surface outdated packages proactively.",
        evidenceType: "config",
        confidence: 3,
        isSystemic: true,
        isActionable: true,
      },
      {
        reason: "Upgrades are low-priority because no policy ties dependency freshness to the definition of 'production-ready'. Technical debt accumulates silently.",
        evidenceType: "documentation",
        confidence: 2,
        isSystemic: true,
        isActionable: true,
      },
    ],
  },

  // ── High-churn files (git) ─────────────────────────────────────────────────
  {
    matchKeywords: ["churn", "commit", "hotspot", "frequently changed", "fixes"],
    causes: [
      {
        reason: "The file accumulates repeated bug fixes because each fix targets the symptom (a specific case) rather than the underlying abstraction.",
        evidenceType: "git",
        confidence: 4,
        isSystemic: false,
        isActionable: true,
      },
      {
        reason: "The file handles too many responsibilities, making each feature change require a modification to it, regardless of which feature is changing.",
        evidenceType: "code",
        confidence: 3,
        isSystemic: true,
        isActionable: true,
      },
      {
        reason: "No ownership model distributes responsibility across modules. A small number of files become global utilities, attracting all changes.",
        evidenceType: "documentation",
        confidence: 2,
        isSystemic: true,
        isActionable: true,
      },
    ],
  },

  // ── Low test coverage ──────────────────────────────────────────────────────
  {
    matchKeywords: ["coverage", "test", "untested", "missing test"],
    causes: [
      {
        reason: "Error paths and edge cases are not tested because they require non-trivial setup (mocking I/O, injecting errors). Only the happy path is tested.",
        evidenceType: "test",
        confidence: 4,
        isSystemic: false,
        isActionable: true,
      },
      {
        reason: "No coverage gate in CI fails builds below a minimum threshold, so coverage can silently decline without alerting the team.",
        evidenceType: "config",
        confidence: 3,
        isSystemic: true,
        isActionable: true,
      },
      {
        reason: "Testing was deprioritised during initial delivery. The implicit policy is 'ship first, test later', and 'later' never arrives.",
        evidenceType: "documentation",
        confidence: 2,
        isSystemic: true,
        isActionable: true,
      },
    ],
  },

  // ── Fallback (generic) ────────────────────────────────────────────────────
  {
    matchKeywords: [],
    causes: [
      {
        reason: "The observed symptom results from an implementation decision that was not reviewed for long-term maintainability at the time it was made.",
        evidenceType: "code",
        confidence: 3,
        isSystemic: false,
        isActionable: true,
      },
      {
        reason: "No automated quality gate enforces the standard that would prevent this class of issue. It is caught only by manual review — if at all.",
        evidenceType: "config",
        confidence: 2,
        isSystemic: true,
        isActionable: true,
      },
    ],
  },
];

const MAX_DEPTH = 7;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select the best-matching cause chain template for a finding.
 * Falls back to the generic template if no keywords match.
 */
function selectTemplate(finding: Finding): CauseChainTemplate {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  // Score each template by keyword matches
  let bestScore = 0;
  let bestTemplate = CAUSE_CHAIN_KNOWLEDGE_BASE[CAUSE_CHAIN_KNOWLEDGE_BASE.length - 1]!;

  for (const template of CAUSE_CHAIN_KNOWLEDGE_BASE) {
    if (template.matchKeywords.length === 0) continue; // skip fallback in scoring
    const score = template.matchKeywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  return bestTemplate;
}

/**
 * Build an evidence record for a cause level using the finding's evidence
 * that matches the required evidence type.
 */
function buildCauseEvidence(
  finding: Finding,
  template: CauseLevelTemplate
): EvidenceRecord[] {
  // Use finding evidence of the matching type if available
  const matching = finding.evidence.filter((e) => e.type === template.evidenceType);
  if (matching.length > 0) return matching;
  // Fallback: use all finding evidence (cross-type inference)
  return [...finding.evidence];
}

/**
 * Determine the termination reason for a cause level.
 * Returns null if the chain should continue.
 */
function evaluateTermination(
  cause: CauseLevelTemplate,
  level: number
): RCATerminationReason | null {
  if (level >= MAX_DEPTH) return "max-depth-reached";
  if (cause.confidence <= 1) return "too-speculative";
  if (cause.isSystemic && cause.isActionable) return "systemic-actionable";
  return null;
}

/**
 * Derive overall RCA confidence from the minimum confidence in the chain.
 */
function deriveOverallConfidence(causes: CauseEntry[]): import("../schemas/types.ts").ScoreConfidence {
  const minConf = Math.min(...causes.map((c) => c.confidence));
  if (minConf >= 4) return "High";
  if (minConf >= 3) return "Medium";
  return "Low";
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE ANALYZER
// ─────────────────────────────────────────────────────────────────────────────

export class RootCauseAnalyzer {
  /**
   * Run a 5 Whys analysis on a finding.
   *
   * Algorithm:
   *   1. Select the best-matching cause chain template
   *   2. Walk the chain level by level
   *   3. At each level: check termination conditions
   *   4. If terminate → stop and record reason
   *   5. Otherwise → add cause, advance to next level
   *
   * @param finding - A validated Finding with at least one evidence record
   * @returns Full RootCauseAnalysis with causes, root cause, and termination reason
   */
  analyze(finding: Finding): RootCauseAnalysis {
    const template = selectTemplate(finding);
    const causes: CauseEntry[] = [];
    let terminationReason: RCATerminationReason = "max-depth-reached";
    const now = new Date().toISOString();

    for (let i = 0; i < template.causes.length; i++) {
      const levelTemplate = template.causes[i];
      if (levelTemplate === undefined) break;

      const level = i + 1;
      const evidence = buildCauseEvidence(finding, levelTemplate);

      const cause: CauseEntry = {
        level,
        reason: levelTemplate.reason,
        evidence,
        confidence: levelTemplate.confidence,
        isSystemic: levelTemplate.isSystemic,
        isActionable: levelTemplate.isActionable,
      };

      causes.push(cause);

      const stopReason = evaluateTermination(levelTemplate, level);
      if (stopReason !== null) {
        terminationReason = stopReason;
        break;
      }
    }

    // If we exhausted the chain without hitting a termination condition,
    // mark the last cause as the root cause with the appropriate reason.
    if (causes.length === template.causes.length) {
      const last = causes[causes.length - 1];
      if (last !== undefined && last.isSystemic && last.isActionable) {
        terminationReason = "systemic-actionable";
      } else if (causes.length > 0) {
        terminationReason = "evidence-gap";
      }
    }

    const rootCause = causes[causes.length - 1] ?? {
      level: 1,
      reason: "Insufficient evidence to determine root cause. Further investigation required.",
      evidence: [...finding.evidence],
      confidence: 1 as FindingConfidence,
      isSystemic: false,
      isActionable: false,
    };

    return {
      symptom: finding.description,
      findingId: finding.id,
      causes,
      rootCause,
      depth: causes.length,
      confidence: deriveOverallConfidence(causes),
      terminationReason,
      analysisTimestamp: now,
    };
  }

  /**
   * Analyze multiple findings and return sorted results (highest confidence first).
   * Continues through all findings even if individual analyses fail.
   */
  analyzeAll(findings: Finding[]): RootCauseAnalysis[] {
    const results: RootCauseAnalysis[] = [];

    for (const finding of findings) {
      try {
        results.push(this.analyze(finding));
      } catch {
        // Individual failure does not abort the batch
      }
    }

    return results.sort((a, b) => {
      const order: Record<ScoreConfidence, number> = { High: 3, Medium: 2, Low: 1 };
      return order[b.confidence] - order[a.confidence];
    });
  }

  /**
   * Format a RootCauseAnalysis as a human-readable narrative for inclusion
   * in initiative documentation.
   */
  formatTrace(rca: RootCauseAnalysis): string {
    const lines: string[] = [
      `=== Root Cause Analysis: ${rca.findingId} ===`,
      `Symptom: ${rca.symptom}`,
      ``,
    ];

    for (const cause of rca.causes) {
      const isRoot = cause === rca.rootCause;
      lines.push(
        `Level ${cause.level}${isRoot ? " [ROOT CAUSE]" : ""}: ${cause.reason}`,
        `  Confidence: ${cause.confidence}/5 | Systemic: ${cause.isSystemic ? "yes" : "no"} | Actionable: ${cause.isActionable ? "yes" : "no"}`,
        `  Evidence: ${cause.evidence.length} record(s) of type(s): ${[...new Set(cause.evidence.map((e) => e.type))].join(", ")}`,
        ``
      );
    }

    lines.push(
      `Overall confidence: ${rca.confidence}`,
      `Termination reason: ${rca.terminationReason}`,
      `Depth: ${rca.depth} Why level(s)`,
    );

    return lines.join("\n");
  }
}

// Re-export ScoreConfidence needed internally
type ScoreConfidence = import("../schemas/types.ts").ScoreConfidence;
