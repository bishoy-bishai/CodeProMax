/**
 * @file validators.ts
 * @description Type guards, serializers, deserializers, and ValidationError-throwing
 * wrappers around the Zod schemas. One complete set per major type.
 *
 * Conventions:
 *  - is*()      → type guard (boolean, never throws)
 *  - parse*()   → throws ValidationError on bad data
 *  - serialize* → converts typed value → plain JSON-safe object
 *  - deserialize* → parses raw unknown → typed value (throws on failure)
 */

import { ZodError, ZodSchema } from "zod";
import type {
  EvidenceRecord,
  Finding,
  Initiative,
  InitiativeRegister,
  ScoringResult,
  StateMachineDefinition,
} from "./types.ts";
import { ValidationError, type ValidationErrorDetail } from "./types.ts";
import {
  EvidenceRecordSchema,
  FindingSchema,
  InitiativeSchema,
  InitiativeRegisterSchema,
  ScoringResultSchema,
  StateMachineDefinitionSchema,
} from "./schemas.ts";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a ZodError into our structured ValidationError.
 * Preserves field paths, expected types, and received values.
 */
function zodToValidationError(err: ZodError, context: string): ValidationError {
  const details: ValidationErrorDetail[] = err.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    expected: issue.message,
    received: "received" in issue ? issue.received : undefined,
    suggestion: buildSuggestion(issue.code, issue.path.join(".")),
  }));

  return new ValidationError(
    `Validation failed for ${context}: ${err.issues.length} issue(s)`,
    details
  );
}

/**
 * Generates corrective suggestions for common Zod error codes.
 */
function buildSuggestion(code: string, field: string): string | null {
  switch (code) {
    case "invalid_type":
      return `Check the type of "${field}" — ensure it matches the expected schema.`;
    case "too_small":
      return `"${field}" is below the minimum allowed value or length.`;
    case "too_big":
      return `"${field}" exceeds the maximum allowed value or length.`;
    case "invalid_string":
      return `"${field}" failed string validation — check format constraints (regex, datetime, etc).`;
    case "invalid_enum_value":
      return `"${field}" must be one of the allowed enum values.`;
    case "custom":
      return `"${field}" failed a cross-field refinement — check related fields.`;
    default:
      return null;
  }
}

/**
 * Generic safe parser. Wraps Zod .safeParse() and converts failures to ValidationError.
 */
function safeParse<T>(schema: ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw zodToValidationError(result.error, context);
  }
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE RECORD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard — does not throw.
 */
export function isEvidenceRecord(value: unknown): value is EvidenceRecord {
  return EvidenceRecordSchema.safeParse(value).success;
}

/**
 * Parse and validate an EvidenceRecord. Throws ValidationError on failure.
 */
export function parseEvidenceRecord(data: unknown): EvidenceRecord {
  return safeParse(EvidenceRecordSchema, data, "EvidenceRecord");
}

/**
 * Serialize an EvidenceRecord to a plain JSON-safe object.
 * All fields are preserved as-is (EvidenceRecord is already JSON-safe).
 */
export function serializeEvidenceRecord(record: EvidenceRecord): Record<string, unknown> {
  return { ...record };
}

/**
 * Deserialize an unknown value into an EvidenceRecord. Throws on failure.
 */
export function deserializeEvidenceRecord(raw: unknown): EvidenceRecord {
  return parseEvidenceRecord(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING RESULT
// ─────────────────────────────────────────────────────────────────────────────

export function isScoringResult(value: unknown): value is ScoringResult {
  return ScoringResultSchema.safeParse(value).success;
}

export function parseScoringResult(data: unknown): ScoringResult {
  return safeParse(ScoringResultSchema, data, "ScoringResult");
}

export function serializeScoringResult(result: ScoringResult): Record<string, unknown> {
  return { ...result, breakdown: { ...result.breakdown } };
}

export function deserializeScoringResult(raw: unknown): ScoringResult {
  return parseScoringResult(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// FINDING
// ─────────────────────────────────────────────────────────────────────────────

export function isFinding(value: unknown): value is Finding {
  return FindingSchema.safeParse(value).success;
}

export function parseFinding(data: unknown): Finding {
  return safeParse(FindingSchema, data, "Finding");
}

export function serializeFinding(finding: Finding): Record<string, unknown> {
  return {
    ...finding,
    evidence: finding.evidence.map(serializeEvidenceRecord),
  };
}

export function deserializeFinding(raw: unknown): Finding {
  return parseFinding(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE
// ─────────────────────────────────────────────────────────────────────────────

export function isInitiative(value: unknown): value is Initiative {
  return InitiativeSchema.safeParse(value).success;
}

export function parseInitiative(data: unknown): Initiative {
  return safeParse(InitiativeSchema, data, "Initiative");
}

export function serializeInitiative(initiative: Initiative): Record<string, unknown> {
  return {
    ...initiative,
    evidence: initiative.evidence.map(serializeEvidenceRecord),
    scoring: serializeScoringResult(initiative.scoring),
    problemStatement: { ...initiative.problemStatement },
    opportunity: { ...initiative.opportunity },
    blockers: initiative.blockers.map((b) => ({ ...b })),
    risks: initiative.risks.map((r) => ({ ...r })),
    openQuestions: initiative.openQuestions.map((q) => ({ ...q })),
  };
}

export function deserializeInitiative(raw: unknown): Initiative {
  return parseInitiative(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE REGISTER
// ─────────────────────────────────────────────────────────────────────────────

export function isInitiativeRegister(value: unknown): value is InitiativeRegister {
  return InitiativeRegisterSchema.safeParse(value).success;
}

export function parseInitiativeRegister(data: unknown): InitiativeRegister {
  return safeParse(InitiativeRegisterSchema, data, "InitiativeRegister");
}

export function serializeInitiativeRegister(
  register: InitiativeRegister
): Record<string, unknown> {
  return {
    ...register,
    initiatives: register.initiatives.map(serializeInitiative),
    stats: {
      total: register.stats.total,
      byStatus: { ...register.stats.byStatus },
    },
  };
}

export function deserializeInitiativeRegister(raw: unknown): InitiativeRegister {
  return parseInitiativeRegister(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE MACHINE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

export function isStateMachineDefinition(
  value: unknown
): value is StateMachineDefinition {
  return StateMachineDefinitionSchema.safeParse(value).success;
}

export function parseStateMachineDefinition(data: unknown): StateMachineDefinition {
  return safeParse(StateMachineDefinitionSchema, data, "StateMachineDefinition");
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER UTILITIES (search / filter helpers)
// ─────────────────────────────────────────────────────────────────────────────

import type { InitiativeStatus, ScoreConfidence } from "./types.ts";

/**
 * Filter options for the initiative register.
 * All fields are optional; omit to return all initiatives.
 */
export interface RegisterFilterOptions {
  status?: InitiativeStatus;
  owner?: string;
  minScore?: number;
  maxScore?: number;
  scoreConfidence?: ScoreConfidence;
  hasOpenBlockers?: boolean;
  hasDependencies?: boolean;
}

/**
 * Filter and optionally sort initiatives from a register.
 * Returns a new array (does not mutate the register).
 */
export function filterInitiatives(
  register: InitiativeRegister,
  options: RegisterFilterOptions = {},
  sortBy: "finalScore" | "updatedAt" | "createdAt" = "finalScore",
  sortOrder: "asc" | "desc" = "desc"
): Initiative[] {
  let results = register.initiatives.filter((init) => {
    if (options.status !== undefined && init.status !== options.status) return false;
    if (options.owner !== undefined && init.owner !== options.owner) return false;
    if (
      options.minScore !== undefined &&
      init.scoring.finalScore < options.minScore
    )
      return false;
    if (
      options.maxScore !== undefined &&
      init.scoring.finalScore > options.maxScore
    )
      return false;
    if (
      options.scoreConfidence !== undefined &&
      init.scoring.scoreConfidence !== options.scoreConfidence
    )
      return false;
    if (
      options.hasOpenBlockers === true &&
      !init.blockers.some((b) => b.status === "Open")
    )
      return false;
    if (
      options.hasDependencies === true &&
      init.dependencies.length === 0
    )
      return false;
    return true;
  });

  results = results.slice().sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    if (sortBy === "finalScore") {
      aVal = a.scoring.finalScore;
      bVal = b.scoring.finalScore;
    } else {
      aVal = a[sortBy];
      bVal = b[sortBy];
    }

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return results;
}

/**
 * Recompute register stats from its initiatives array.
 * Use after any mutation to keep stats consistent.
 */
export function recomputeStats(
  initiatives: Initiative[]
): InitiativeRegister["stats"] {
  const byStatus: Partial<Record<InitiativeStatus, number>> = {};

  for (const init of initiatives) {
    byStatus[init.status] = (byStatus[init.status] ?? 0) + 1;
  }

  return {
    total: initiatives.length,
    byStatus: {
      Proposed: byStatus["Proposed"] ?? 0,
      Selected: byStatus["Selected"] ?? 0,
      Planned: byStatus["Planned"] ?? 0,
      "In Progress": byStatus["In Progress"] ?? 0,
      Released: byStatus["Released"] ?? 0,
      Validated: byStatus["Validated"] ?? 0,
      Completed: byStatus["Completed"] ?? 0,
    },
  };
}
