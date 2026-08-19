/**
 * @file types.ts (services layer)
 * @description Type definitions for the pipeline orchestration layer.
 * Sits above the analyzers layer and below the output/document layer.
 */

import type {
  Finding,
  Initiative,
  FindingId,
  InitiativeId,
  ProblemSeverity,
} from "../schemas/types.ts";
import type { RankedInitiative } from "../core/types.ts";
import type { RootCauseAnalysis } from "../analyzers/types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY (intermediate: Finding → Initiative)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An Opportunity is the outcome-oriented representation of a Finding.
 * It is the intermediate artifact between "what we observed" and
 * "what we should work on next".
 *
 * Naming rules (enforced by OpportunityGenerator):
 *   ✓ Outcome-oriented: "Improve Production Error Observability"
 *   ✗ Implementation-specific: "Add try-catch blocks"
 *   ✓ Measurable success criteria
 *   ✓ Explicit scope AND non-scope
 */
export interface Opportunity {
  /** Outcome-oriented name (kebab slug of this becomes the initiative slug) */
  name: string;
  /** kebab-case slug derived from name */
  slug: string;
  /** One-paragraph description of what we gain by solving this */
  description: string;
  /** Measurable success criteria (at least 2) */
  successCriteria: string[];
  /** What is in scope for this initiative */
  scope: string[];
  /** Explicit non-scope items — prevents scope creep */
  nonScope: string[];
  /** Severity inherited from the underlying finding */
  severity: ProblemSeverity;
  /** The finding that generated this opportunity */
  findingRef: FindingId;
  /** ID of the root cause analysis linked to the finding */
  rcaSummary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE CONTROL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Overall status of a pipeline run */
export type PipelineStatus =
  | "COMPLETE"   // All steps ran successfully
  | "PARTIAL"    // Some steps failed or were skipped; results still useful
  | "FAILED";    // Fatal failure — no useful results produced

/** Named step in the pipeline (for progress reporting) */
export type PipelineStep =
  | "repository-mapping"
  | "code-evidence"
  | "git-evidence"
  | "test-evidence"
  | "dependency-evidence"
  | "rca-analysis"
  | "opportunity-generation"
  | "initiative-creation"
  | "scoring"
  | "complete";

/** Callback invoked at each pipeline step transition */
export type ProgressCallback = (step: PipelineStep, detail: string) => void;

/** Options for a pipeline run */
export interface PipelineOptions {
  /**
   * Maximum wall-clock time for the full pipeline.
   * Default: 900_000 ms (15 minutes).
   * If exceeded, the run is marked PARTIAL and returns with whatever was collected.
   */
  timeoutMs?: number;
  /** Optional progress listener */
  onProgress?: ProgressCallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-SOURCE RESULT
// ─────────────────────────────────────────────────────────────────────────────

/** Status of a single evidence source within a pipeline run */
export type SourceStatus = "success" | "partial" | "skipped" | "failed";

/** Result summary for one of the four evidence sources */
export interface PipelineSourceResult {
  /** The evidence source */
  source: "code" | "git" | "test" | "dependency";
  status: SourceStatus;
  /** Number of findings produced by this source */
  findingCount: number;
  /** Non-fatal warnings (unreadable files, missing git, etc.) */
  warnings: string[];
  /** Wall-clock time for this source in milliseconds */
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL ANALYSIS RESULT
// ─────────────────────────────────────────────────────────────────────────────

/** A ranked initiative enriched with its full Initiative object */
export interface RankedInitiativeWithDetails extends RankedInitiative {
  initiative: Initiative;
}

/**
 * Complete output of a pipeline run.
 *
 * When status is PARTIAL, some fields may have fewer items than expected.
 * Consumers should always check `status` before treating the result as complete.
 */
export interface AnalysisResult {
  /** Unique ID for this analysis run (format: analysis-{timestamp}) */
  analysisId: string;
  repositoryPath: string;
  status: PipelineStatus;
  /** ISO-8601 timestamp of when the pipeline started */
  startedAt: string;
  /** ISO-8601 timestamp of when the pipeline finished */
  completedAt: string;
  /** Total wall-clock time in milliseconds */
  durationMs: number;
  /** True if the run was cut short by the timeout */
  timedOut: boolean;

  // ── Evidence layer ────────────────────────────────────────────────────────
  /** Per-source result summaries */
  evidenceSources: PipelineSourceResult[];
  /** Total finding count across all sources */
  evidenceCount: number;

  // ── Analysis layer ────────────────────────────────────────────────────────
  /** All findings collected and validated */
  findings: Finding[];
  /** Root cause analyses (one per finding, in same order) */
  rcaResults: RootCauseAnalysis[];
  /** Number of findings that passed validation (non-UNKNOWN classification) */
  findingsCount: number;

  // ── Output layer ──────────────────────────────────────────────────────────
  /** Opportunities generated from findings */
  opportunities: Opportunity[];
  /** Created initiatives (unranked) */
  initiatives: Initiative[];
  /** Ranked initiatives with full details, sorted by score descending */
  rankedInitiatives: RankedInitiativeWithDetails[];
  initiativesCount: number;

  // ── Diagnostics ───────────────────────────────────────────────────────────
  /** All warnings collected during the run */
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING INPUTS (used by InitiativeFactory)
// ─────────────────────────────────────────────────────────────────────────────

/** Raw scoring inputs derived from a finding + RCA, before formula application */
export interface DerivedScores {
  /** 1–5: business/user value if solved */
  impact: number;
  /** 1–5: certainty that the problem is real */
  confidence: number;
  /** 1–5: cost of delay */
  urgency: number;
  /** 1–5: systemic leverage (does fixing this unlock others?) */
  leverage: number;
  /** 1–5: implementation effort (low cost = high score) */
  cost: number;
  /** 1–5: execution risk (low risk = high score) */
  risk: number;
}
