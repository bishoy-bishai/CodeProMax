/**
 * @file schemas.ts
 * @description Zod runtime validation schemas mirroring every type in types.ts.
 * All schemas are strict (no unknown keys pass through).
 * Zero `any` — z.unknown() used where values are genuinely opaque.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES & BRANDS
// ─────────────────────────────────────────────────────────────────────────────

export const InitiativeIdSchema = z
  .string()
  .regex(/^INIT-\d{3,}$/, "InitiativeId must match INIT-NNN format (e.g. INIT-001)");

export const FindingIdSchema = z
  .string()
  .regex(/^FIND-\d{3,}$/, "FindingId must match FIND-NNN format (e.g. FIND-001)");

export const ISOTimestampSchema = z
  .string()
  .datetime({ message: "Must be a valid ISO-8601 datetime string" });

export const AxisScoreSchema = z
  .number()
  .int("AxisScore must be an integer")
  .min(1, "AxisScore minimum is 1")
  .max(5, "AxisScore maximum is 5");

export const FinalScoreSchema = z
  .number()
  .int("FinalScore must be an integer")
  .min(0, "FinalScore minimum is 0")
  .max(100, "FinalScore maximum is 100");

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const InitiativeStatusSchema = z.enum([
  "Proposed",
  "Selected",
  "Planned",
  "In Progress",
  "Released",
  "Validated",
  "Completed",
]);

export const FindingClassificationSchema = z.enum([
  "FACT",
  "INFERENCE",
  "HYPOTHESIS",
  "UNKNOWN",
]);

export const FindingConfidenceSchema = z
  .number()
  .int("FindingConfidence must be an integer")
  .min(1, "FindingConfidence minimum is 1")
  .max(5, "FindingConfidence maximum is 5") as z.ZodType<1 | 2 | 3 | 4 | 5>;

export const EvidenceTypeSchema = z.enum([
  "code",
  "test",
  "git",
  "config",
  "runtime",
  "dependency",
  "documentation",
]);

export const ScoreConfidenceSchema = z.enum(["High", "Medium", "Low"]);

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE
// ─────────────────────────────────────────────────────────────────────────────

export const EvidenceLocationSchema = z
  .object({
    file: z.string().nullable(),
    line: z.number().int().positive().nullable(),
    functionName: z.string().nullable(),
    symbol: z.string().nullable(),
  })
  .strict();

export const EvidenceRecordSchema = z
  .object({
    source: z.string().min(1, "Evidence source must not be empty"),
    type: EvidenceTypeSchema,
    location: EvidenceLocationSchema.nullable(),
    content: z.string().min(1, "Evidence content must not be empty"),
    timestamp: ISOTimestampSchema,
    validated: z.boolean(),
    validatedAt: ISOTimestampSchema.nullable(),
  })
  .strict()
  .refine(
    (rec) => {
      // If validated=true, validatedAt must be set
      if (rec.validated && rec.validatedAt === null) return false;
      return true;
    },
    {
      message: "validatedAt must be set when validated is true",
      path: ["validatedAt"],
    }
  );

/** Non-empty tuple: at least one evidence record is required */
export const NonEmptyEvidenceArraySchema = z
  .array(EvidenceRecordSchema)
  .min(1, "Evidence array must contain at least one record");

// ─────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────

export const ScoringBreakdownSchema = z
  .object({
    impact: AxisScoreSchema,
    confidence: AxisScoreSchema,
    urgency: AxisScoreSchema,
    leverage: AxisScoreSchema,
    cost: AxisScoreSchema,
    risk: AxisScoreSchema,
  })
  .strict();

export const ScoringResultSchema = z
  .object({
    breakdown: ScoringBreakdownSchema,
    finalScore: FinalScoreSchema,
    scoreConfidence: ScoreConfidenceSchema,
    decisionTrace: z.string().min(1, "decisionTrace must not be empty"),
    derivationRules: z.string().min(1, "derivationRules must not be empty"),
  })
  .strict()
  .refine(
    (sr) => {
      // Cross-check: re-compute expected score from breakdown
      const { impact, confidence, urgency, leverage, cost, risk } = sr.breakdown;
      const expected = Math.round(
        ((impact + confidence + urgency + leverage + (6 - cost) + (6 - risk)) / 30) * 100
      );
      return Math.abs(sr.finalScore - expected) <= 1; // ±1 for rounding tolerance
    },
    {
      message:
        "finalScore does not match the computed value from the scoring breakdown. " +
        "Formula: round((impact + confidence + urgency + leverage + (6-cost) + (6-risk)) / 30 * 100)",
      path: ["finalScore"],
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// FINDING
// ─────────────────────────────────────────────────────────────────────────────

export const FindingSchema = z
  .object({
    id: FindingIdSchema,
    title: z.string().min(1, "Finding title must not be empty"),
    description: z.string().min(1, "Finding description must not be empty"),
    classification: FindingClassificationSchema,
    confidence: FindingConfidenceSchema,
    evidence: NonEmptyEvidenceArraySchema,
    linkedFindings: z.array(FindingIdSchema),
    initiativeRef: InitiativeIdSchema.nullable(),
    createdAt: ISOTimestampSchema,
    updatedAt: ISOTimestampSchema,
  })
  .strict()
  .refine(
    (f) => new Date(f.updatedAt) >= new Date(f.createdAt),
    {
      message: "updatedAt must be >= createdAt",
      path: ["updatedAt"],
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE
// ─────────────────────────────────────────────────────────────────────────────

export const SeveritySchema = z.enum(["Critical", "High", "Medium", "Low"]);

export const ProblemStatementSchema = z
  .object({
    description: z.string().min(1, "Problem description must not be empty"),
    severity: SeveritySchema,
    evidenceRefs: z.array(z.string().min(1)),
  })
  .strict();

export const OpportunityDefinitionSchema = z
  .object({
    description: z.string().min(1, "Opportunity description must not be empty"),
    successCriteria: z
      .array(z.string().min(1))
      .min(1, "At least one success criterion is required"),
    scope: z.array(z.string().min(1)).min(1, "Scope must define at least one item"),
    nonScope: z
      .array(z.string().min(1))
      .min(1, "Non-scope must be explicitly defined (prevents scope creep)"),
  })
  .strict();

export const RiskStatusSchema = z.enum(["Open", "Mitigated", "Accepted", "Closed"]);

export const RiskItemSchema = z
  .object({
    description: z.string().min(1),
    likelihood: AxisScoreSchema,
    impact: AxisScoreSchema,
    owner: z.string().min(1, "Risk owner must be specified"),
    mitigation: z.string().min(1, "Mitigation plan must be specified"),
    status: RiskStatusSchema,
  })
  .strict();

export const OpenQuestionSchema = z
  .object({
    question: z.string().min(1),
    assignee: z.string().min(1, "Assignee must be specified"),
    dueBy: ISOTimestampSchema.nullable(),
    answer: z.string().nullable(),
    resolvedAt: ISOTimestampSchema.nullable(),
  })
  .strict()
  .refine(
    (q) => {
      // If answered, resolvedAt must be set
      if (q.answer !== null && q.resolvedAt === null) return false;
      return true;
    },
    {
      message: "resolvedAt must be set when answer is provided",
      path: ["resolvedAt"],
    }
  );

export const SlugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Slug must be lowercase kebab-case (e.g. eliminate-n-plus-1-queries)"
  );

export const InitiativeSchema = z
  .object({
    id: InitiativeIdSchema,
    slug: SlugSchema,
    name: z.string().min(1, "Initiative name must not be empty"),
    status: InitiativeStatusSchema,
    problemStatement: ProblemStatementSchema,
    opportunity: OpportunityDefinitionSchema,
    evidence: NonEmptyEvidenceArraySchema,
    scoring: ScoringResultSchema,
    findingRefs: z.array(FindingIdSchema),
    createdAt: ISOTimestampSchema,
    updatedAt: ISOTimestampSchema,
    owner: z.string().min(1, "Owner must be specified"),
    stakeholders: z.array(z.string().min(1)),
    blockers: z.array(RiskItemSchema),
    risks: z.array(RiskItemSchema),
    dependencies: z.array(InitiativeIdSchema),
    openQuestions: z.array(OpenQuestionSchema),
  })
  .strict()
  .refine(
    (i) => new Date(i.updatedAt) >= new Date(i.createdAt),
    {
      message: "updatedAt must be >= createdAt",
      path: ["updatedAt"],
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE REGISTER
// ─────────────────────────────────────────────────────────────────────────────

export const StatusBreakdownSchema = z.object({
  Proposed: z.number().int().min(0),
  Selected: z.number().int().min(0),
  Planned: z.number().int().min(0),
  "In Progress": z.number().int().min(0),
  Released: z.number().int().min(0),
  Validated: z.number().int().min(0),
  Completed: z.number().int().min(0),
});

export const InitiativeRegisterSchema = z
  .object({
    initiatives: z.array(InitiativeSchema),
    stats: z.object({
      total: z.number().int().min(0),
      byStatus: StatusBreakdownSchema,
    }),
    lastUpdated: ISOTimestampSchema,
  })
  .strict()
  .refine(
    (r) => r.stats.total === r.initiatives.length,
    {
      message: "stats.total must equal initiatives.length",
      path: ["stats", "total"],
    }
  )
  .refine(
    (r) => {
      // byStatus counts must sum to total
      const sum = Object.values(r.stats.byStatus).reduce((a, b) => a + b, 0);
      return sum === r.stats.total;
    },
    {
      message: "Sum of stats.byStatus values must equal stats.total",
      path: ["stats", "byStatus"],
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

export const StateTransitionSchema = z
  .object({
    from: InitiativeStatusSchema,
    to: InitiativeStatusSchema,
    conditions: z.array(z.string().min(1)).min(1, "At least one condition required"),
    guards: z.array(z.string().min(1)),
    sideEffects: z.array(z.string().min(1)),
  })
  .strict()
  .refine((t) => t.from !== t.to, {
    message: "Self-transitions are not allowed",
    path: ["to"],
  });

export const StateMachineDefinitionSchema = z
  .object({
    states: z
      .array(InitiativeStatusSchema)
      .min(1, "State machine must define at least one state"),
    transitions: z
      .array(StateTransitionSchema)
      .min(1, "State machine must define at least one transition"),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────────────
// INFERRED TYPES (keep in sync with types.ts)
// ─────────────────────────────────────────────────────────────────────────────
export type EvidenceLocationInput = z.input<typeof EvidenceLocationSchema>;
export type EvidenceRecordInput = z.input<typeof EvidenceRecordSchema>;
export type ScoringBreakdownInput = z.input<typeof ScoringBreakdownSchema>;
export type ScoringResultInput = z.input<typeof ScoringResultSchema>;
export type FindingInput = z.input<typeof FindingSchema>;
export type InitiativeInput = z.input<typeof InitiativeSchema>;
export type InitiativeRegisterInput = z.input<typeof InitiativeRegisterSchema>;
