/**
 * @file types.ts
 * @description Production-grade TypeScript type definitions for Code Pro Max.
 * Zero `any` types. All optionals are explicitly nullable.
 * All fields are documented with rationale.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVE BRAND TYPES
// Branded types prevent accidental mixing of IDs, scores, etc.
// ─────────────────────────────────────────────────────────────────────────────

/** Immutable initiative identifier: INIT-NNN */
export type InitiativeId = `INIT-${string}`;

/** Immutable finding identifier: FIND-NNN */
export type FindingId = `FIND-${string}`;

/** ISO-8601 datetime string */
export type ISOTimestamp = string;

/** Score from 0–100 (integer). Enforced at runtime via Zod. */
export type FinalScore = number;

/** Sub-score axis, 1–5 integer */
export type AxisScore = number;

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// Using string literal union types (not TypeScript enum) for better
// JSON round-trip safety and exhaustiveness checking via `never`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full lifecycle of an initiative.
 * State machine transitions are enforced in state-machine.ts.
 */
export type InitiativeStatus =
  | "Proposed"      // Idea captured, not yet evaluated
  | "Selected"      // Chosen for planning
  | "Planned"       // Work broken down, estimate exists
  | "In Progress"   // Active development
  | "Released"      // Code shipped, validation pending
  | "Validated"     // Metrics confirm the outcome
  | "Completed";    // Retrospective done, knowledge captured

/**
 * Epistemic classification for a finding.
 * - FACT: Directly observed, reproducible
 * - INFERENCE: Derived from evidence, not directly observed
 * - HYPOTHESIS: Unverified, needs testing
 * - UNKNOWN: Classification deferred; must be resolved before initiative creation
 */
export type FindingClassification = "FACT" | "INFERENCE" | "HYPOTHESIS" | "UNKNOWN";

/**
 * Confidence score for a finding, 1–5.
 * 1 = wild guess, 5 = multiple corroborating sources.
 */
export type FindingConfidence = 1 | 2 | 3 | 4 | 5;

/**
 * Evidence source type.
 * Drives how the evidence is validated and displayed.
 */
export type EvidenceType =
  | "code"           // Source file analysis
  | "test"           // Test result or coverage report
  | "git"            // Git history, blame, diff
  | "config"         // Config file or env variable
  | "runtime"        // Profiling, logs, metrics at runtime
  | "dependency"     // Third-party library or lockfile
  | "documentation"; // README, ADR, wiki, comments

/**
 * Score confidence (aggregate certainty of the scoring result).
 * High = strong evidence + clear signal; Low = limited evidence.
 */
export type ScoreConfidence = "High" | "Medium" | "Low";

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE RECORD
// Atomic unit of supporting data. Used by both Finding and ScoringResult.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Precise location within a source artifact.
 * All sub-fields nullable because not all evidence has line-level precision.
 */
export interface EvidenceLocation {
  /** Absolute or repo-relative file path */
  file: string | null;
  /** 1-based line number */
  line: number | null;
  /** Enclosing function or method name */
  functionName: string | null;
  /** Symbol (class, variable, identifier) */
  symbol: string | null;
}

/**
 * A single piece of evidence supporting a finding or scoring decision.
 */
export interface EvidenceRecord {
  /** Required: file path or URL to the source artifact */
  source: string;
  /** Required: how to interpret/validate this evidence */
  type: EvidenceType;
  /** Optional: precise location within the source */
  location: EvidenceLocation | null;
  /** Required: excerpt or factual summary (not an opinion) */
  content: string;
  /** Required: when this evidence was captured */
  timestamp: ISOTimestamp;
  /** Required: has this evidence been cross-checked? */
  validated: boolean;
  /** Nullable: when it was validated; null if not yet validated */
  validatedAt: ISOTimestamp | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-axis breakdown of the ICE-extended scoring model.
 * Each axis is scored 1–5 by the analyst, then combined into FinalScore.
 */
export interface ScoringBreakdown {
  /** Business/user impact if solved */
  impact: AxisScore;
  /** Confidence that the problem is real and solvable */
  confidence: AxisScore;
  /** Time pressure — penalty for delaying */
  urgency: AxisScore;
  /** Force-multiplier effect; does fixing this unlock other wins? */
  leverage: AxisScore;
  /** Inverse cost — low cost = high score */
  cost: AxisScore;
  /** Inverse risk — low risk = high score */
  risk: AxisScore;
}

/**
 * Full scoring output including derivation trail.
 */
export interface ScoringResult {
  /** Per-axis breakdown */
  breakdown: ScoringBreakdown;
  /** Computed 0–100 integer score */
  finalScore: FinalScore;
  /** Analyst confidence in the score */
  scoreConfidence: ScoreConfidence;
  /**
   * Human-readable narrative explaining how the score was derived.
   * Required — must not be empty — enforces explicit reasoning.
   */
  decisionTrace: string;
  /**
   * Formal derivation rules applied (e.g., "finalScore = round((I+C+U+L+(6-Cost)+(6-Risk))/30 * 100)").
   * Required for reproducibility.
   */
  derivationRules: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FINDING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A discrete observed or inferred problem/opportunity in the codebase.
 * Findings aggregate into Initiatives.
 */
export interface Finding {
  /** Immutable ID, assigned at creation */
  id: FindingId;
  /** Short, factual title */
  title: string;
  /** Detailed description — what was observed and where */
  description: string;
  /** Epistemic classification */
  classification: FindingClassification;
  /** Analyst confidence in this finding, 1–5 */
  confidence: FindingConfidence;
  /**
   * Evidence array — must be non-empty.
   * A finding with no evidence is not a finding; it is speculation.
   */
  evidence: [EvidenceRecord, ...EvidenceRecord[]];
  /**
   * Other finding IDs that corroborate, contradict, or extend this one.
   * Bidirectional: both sides of the link should be recorded.
   */
  linkedFindings: FindingId[];
  /**
   * The initiative this finding was absorbed into.
   * Null if the finding is not yet associated with an initiative.
   */
  initiativeRef: InitiativeId | null;
  /** When this finding was first recorded */
  createdAt: ISOTimestamp;
  /** When this finding was last updated */
  updatedAt: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Problem statement with direct evidence references.
 * Required: defines the "what" and "why now".
 */
export interface ProblemStatement {
  /** Factual description of the problem */
  description: string;
  /** Severity: how bad is this right now? */
  severity: "Critical" | "High" | "Medium" | "Low";
  /** IDs of EvidenceRecords that directly substantiate this problem */
  evidenceRefs: string[];
}

/**
 * Opportunity definition: what success looks like.
 */
export interface OpportunityDefinition {
  /** Outcome-oriented description of what we gain by solving this */
  description: string;
  /** Measurable success criteria */
  successCriteria: string[];
  /** What is in scope */
  scope: string[];
  /**
   * Explicit non-scope (what we are NOT doing).
   * Required to prevent scope creep.
   */
  nonScope: string[];
}

/**
 * A risk or blocker with owner and resolution plan.
 */
export interface RiskItem {
  /** Unique description of the risk/blocker */
  description: string;
  /** Likelihood: 1 (rare) to 5 (certain) */
  likelihood: AxisScore;
  /** Impact if it occurs: 1 (trivial) to 5 (catastrophic) */
  impact: AxisScore;
  /** Owner responsible for tracking/mitigating */
  owner: string;
  /** Planned mitigation or resolution */
  mitigation: string;
  /** Current status */
  status: "Open" | "Mitigated" | "Accepted" | "Closed";
}

/**
 * An open question that must be resolved before the initiative can progress.
 */
export interface OpenQuestion {
  /** The question */
  question: string;
  /** Who is responsible for answering it */
  assignee: string;
  /** Deadline for resolution */
  dueBy: ISOTimestamp | null;
  /** Current answer (null until resolved) */
  answer: string | null;
  /** Resolution timestamp */
  resolvedAt: ISOTimestamp | null;
}

/**
 * Core Initiative entity — the top-level unit of engineering improvement work.
 */
export interface Initiative {
  /** Immutable ID in INIT-NNN format */
  id: InitiativeId;
  /**
   * Outcome-oriented name in kebab-case.
   * Example: "eliminate-n+1-queries-in-product-api"
   * Required to be outcome-oriented, not task-oriented.
   */
  slug: string;
  /** Human-readable display name */
  name: string;
  /** Current lifecycle status */
  status: InitiativeStatus;
  /** What problem we are solving and why it matters */
  problemStatement: ProblemStatement;
  /** What success looks like and what's in/out of scope */
  opportunity: OpportunityDefinition;
  /**
   * Evidence array — must be non-empty.
   * An initiative with no evidence cannot be scored reliably.
   */
  evidence: [EvidenceRecord, ...EvidenceRecord[]];
  /** Full scoring result */
  scoring: ScoringResult;
  /** Finding IDs that contributed to this initiative */
  findingRefs: FindingId[];
  /** Metadata */
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  /** Primary owner (GitHub handle or name) */
  owner: string;
  /** Other stakeholders */
  stakeholders: string[];
  /** Active blockers */
  blockers: RiskItem[];
  /** Known risks */
  risks: RiskItem[];
  /** IDs of other initiatives this depends on */
  dependencies: InitiativeId[];
  /** Unresolved open questions */
  openQuestions: OpenQuestion[];
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE REGISTER
// ─────────────────────────────────────────────────────────────────────────────

/** Summary statistics broken down by status */
export type StatusBreakdown = Record<InitiativeStatus, number>;

/**
 * The Initiative Register — top-level registry of all initiatives.
 * Acts as the single source of truth for the engineering improvement backlog.
 */
export interface InitiativeRegister {
  /** All initiatives, ordered by finalScore descending */
  initiatives: Initiative[];
  /** Aggregate statistics */
  stats: {
    total: number;
    byStatus: StatusBreakdown;
  };
  /** When this register snapshot was last persisted */
  lastUpdated: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE MACHINE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A valid state transition pair */
export interface StateTransition {
  from: InitiativeStatus;
  to: InitiativeStatus;
  /** Conditions that MUST be true before this transition is allowed */
  conditions: string[];
  /** Guards — fields/invariants that block this transition */
  guards: string[];
  /** Side effects triggered on successful transition */
  sideEffects: string[];
}

/** The complete state machine definition */
export interface StateMachineDefinition {
  /** All valid status values in lifecycle order */
  states: InitiativeStatus[];
  /** All valid transitions */
  transitions: StateTransition[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Structured validation error — zero ambiguity about what failed and why */
export interface ValidationErrorDetail {
  /** Dot-path to the failing field, e.g. "scoring.breakdown.impact" */
  field: string;
  /** Expected type or constraint, e.g. "integer 1–5" */
  expected: string;
  /** Actual value received (unknown so we can handle anything safely) */
  received: unknown;
  /** Optional corrective suggestion */
  suggestion: string | null;
}

/** Thrown when Zod validation fails */
export class ValidationError extends Error {
  public readonly details: ValidationErrorDetail[];

  constructor(message: string, details: ValidationErrorDetail[]) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPOSSIBLE STATE SENTINEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Use in exhaustiveness checks so TypeScript catches unhandled cases at compile time.
 *
 * @example
 * ```ts
 * function handleStatus(s: InitiativeStatus): string {
 *   switch (s) {
 *     case "Proposed": return "...";
 *     // ... all cases
 *     default: return assertNever(s);
 *   }
 * }
 * ```
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`);
}
