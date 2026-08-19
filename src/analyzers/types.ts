/**
 * @file types.ts (analyzers layer)
 * @description Type definitions specific to Phase 1 analyzers.
 * Distinct from schema-layer types (persisted entities) and core-layer types (algorithms).
 */

import type {
  FindingId,
  EvidenceRecord,
  FindingConfidence,
  ScoreConfidence,
  EvidenceType,
} from "../schemas/types.ts";
import type { LanguageId } from "../core/types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL CODE ANALYSIS TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A file entry extracted from a RepositoryMap directory tree */
export interface FileEntry {
  /** Absolute path on disk */
  absolutePath: string;
  /** Repo-relative path */
  relativePath: string;
  language: LanguageId;
  sizeBytes: number;
}

/** A detected function or method span within a source file */
export interface FunctionSpan {
  /** Function/method name; "<anonymous>" for unnamed functions */
  name: string;
  startLine: number;
  endLine: number;
  /** endLine - startLine + 1 */
  lineCount: number;
  /**
   * Cyclomatic complexity estimate.
   * Counted as: 1 (base) + number of branching keywords
   * (if, else if, for, while, case, catch, &&, ||, ?:)
   */
  complexity: number;
  isAsync: boolean;
  /** Does the function body contain at least one try-catch block? */
  hasTryCatch: boolean;
  filePath: string;
}

/** A detected code issue found during static analysis */
export interface CodeIssue {
  type:
    | "large-function"
    | "missing-error-handling"
    | "high-coupling"
    | "code-smell"
    | "duplicated-code";
  filePath: string;
  lineStart: number | null;
  lineEnd: number | null;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  /** Structured additional data (no any — all fields documented) */
  details: CodeIssueDetails;
}

/** Union of all detail shapes for CodeIssue */
export type CodeIssueDetails =
  | LargeFunctionDetails
  | MissingErrorHandlingDetails
  | HighCouplingDetails
  | CodeSmellDetails
  | DuplicatedCodeDetails;

export interface LargeFunctionDetails {
  kind: "large-function";
  functionName: string;
  lineCount: number;
  complexity: number;
  complexityThreshold: number;
  lineCountThreshold: number;
}

export interface MissingErrorHandlingDetails {
  kind: "missing-error-handling";
  functionName: string;
  isAsync: boolean;
  hasPromiseChain: boolean;
  uncaughtPattern: string;
}

export interface HighCouplingDetails {
  kind: "high-coupling";
  importCount: number;
  importThreshold: number;
  topImports: string[];
}

export interface CodeSmellDetails {
  kind: "code-smell";
  smellType: "god-file" | "long-method" | "many-parameters";
  metric: string;
  value: number;
  threshold: number;
}

export interface DuplicatedCodeDetails {
  kind: "duplicated-code";
  duplicateFilePath: string;
  duplicateStartLine: number;
  similarityScore: number;
  blockLineCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GIT ANALYSIS TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A single parsed git commit */
export interface GitCommit {
  hash: string;
  /** ISO-8601 author date */
  date: string;
  subject: string;
  author: string;
}

/** Aggregate statistics for a single file's git history */
export interface GitFileStats {
  /** Repo-relative path */
  path: string;
  commitCount: number;
  /** ISO-8601 of the most recent commit touching this file */
  lastModified: string;
  /** ISO-8601 of the earliest commit touching this file */
  firstCommit: string;
  uniqueAuthors: string[];
  /**
   * True if the file is changed frequently alongside many other files,
   * indicating temporal coupling.
   */
  isTemporalHotspot: boolean;
  /** Number of commits with fix/bug/patch keywords in the last 6 months */
  fixCommitCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCY ANALYSIS TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Analysis result for a single dependency */
export interface DependencyIssue {
  name: string;
  /** Version string from package.json (e.g. "^1.0.0") */
  declaredVersion: string;
  /** Parsed major version number; null if unparseable */
  majorVersion: number | null;
  isOutdated: boolean;
  /** True if another package in the graph provides the same function */
  isDuplicate: boolean;
  /** True if the package is on the known-deprecated list */
  isDeprecated: boolean;
  /** Severity: Critical for deprecated+vulnerable, High for very outdated */
  severity: "Critical" | "High" | "Medium" | "Low";
  /** Human-readable reason for flagging */
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE ANALYSIS TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** One level in a 5 Whys chain */
export interface CauseEntry {
  /** 1-indexed depth (1 = direct cause, N = root cause) */
  level: number;
  /** "Why does [previous cause] happen?" → this reason */
  reason: string;
  /** Evidence records supporting this cause */
  evidence: EvidenceRecord[];
  confidence: FindingConfidence;
  /**
   * True if this cause is structural/process-level rather than a one-off mistake.
   * Systemic causes are prioritised as root causes.
   */
  isSystemic: boolean;
  /**
   * True if engineering action can address this cause.
   * Non-actionable causes (e.g., external constraints) are noted but not root causes.
   */
  isActionable: boolean;
}

/** Reason the 5 Whys chain was terminated */
export type RCATerminationReason =
  | "systemic-actionable"   // Found a systemic AND actionable root cause ✓ (ideal)
  | "evidence-gap"          // Cannot drill deeper without additional evidence
  | "max-depth-reached"     // Hit the 7-level limit
  | "too-speculative"       // Next level would be HYPOTHESIS with confidence ≤ 1
  | "self-evident";         // Cause requires no further explanation (tautology resolved)

/** Full root cause analysis output */
export interface RootCauseAnalysis {
  /** The original finding's description */
  symptom: string;
  findingId: FindingId;
  causes: CauseEntry[];
  /** The final cause in the chain (= causes[causes.length - 1]) */
  rootCause: CauseEntry;
  /** Number of Why levels traversed */
  depth: number;
  /** Overall confidence in the RCA */
  confidence: ScoreConfidence;
  terminationReason: RCATerminationReason;
  analysisTimestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAUSE CHAIN KNOWLEDGE BASE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Template for one cause level in the knowledge base */
export interface CauseLevelTemplate {
  /** Template string; {finding} is replaced with the finding's title */
  reason: string;
  evidenceType: EvidenceType;
  confidence: FindingConfidence;
  isSystemic: boolean;
  isActionable: boolean;
}

/** A complete cause chain template for a category of finding */
export interface CauseChainTemplate {
  /** Matches findings whose description contains any of these keywords */
  matchKeywords: string[];
  /** Ordered from direct cause → root cause */
  causes: CauseLevelTemplate[];
}
