/**
 * @file mcp-tools.ts
 * @description Input schemas and descriptions for the 6 MCP tools exposed by
 * Code Pro Max, one per `/codepro` command except `help` (MCP already gives
 * the client a tool list, so a `help` tool is redundant here).
 *
 * Departure from an earlier draft spec: fields like `analysis_depth`,
 * `include_runtime_signals`, `include_git_history`, `export_format`,
 * `compare_to_previous`, `recalculate_score`, and the `check_*` review flags
 * are intentionally omitted. None of them are implemented by
 * `CommandHandler` (`src/commands/command-handler.ts`) — accepting them and
 * silently ignoring the value would let a model believe it configured
 * behavior that never changed. Only parameters that actually affect the
 * underlying command are exposed.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// find_initiatives
// ─────────────────────────────────────────────────────────────────────────────

export const FindInitiativesInputSchema = z.object({
  repository_path: z
    .string()
    .min(1)
    .optional()
    .describe("Path to the repository to analyze. Defaults to the server's working directory."),
  num_initiatives: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe("Number of top-scored opportunities to discover and generate initiative briefs for (1-10)."),
});
export type FindInitiativesInput = z.infer<typeof FindInitiativesInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// build_initiative
// ─────────────────────────────────────────────────────────────────────────────

export const BuildInitiativeInputSchema = z.object({
  initiative_id: z
    .string()
    .regex(/^INIT-\d{3,}$/, "Must match INIT-NNN, e.g. INIT-001")
    .describe("ID of an initiative already in the register (see get_status or find_initiatives output)."),
});
export type BuildInitiativeInput = z.infer<typeof BuildInitiativeInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// review_initiatives
// ─────────────────────────────────────────────────────────────────────────────

export const ReviewInitiativesInputSchema = z.object({});
export type ReviewInitiativesInput = z.infer<typeof ReviewInitiativesInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// re_analyze
// ─────────────────────────────────────────────────────────────────────────────

export const ReAnalyzeInputSchema = z.object({
  repository_path: z
    .string()
    .min(1)
    .optional()
    .describe("Path to the repository to re-analyze. Defaults to the server's working directory."),
});
export type ReAnalyzeInput = z.infer<typeof ReAnalyzeInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// update_initiative
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateInitiativeInputSchema = z.object({
  initiative_id: z
    .string()
    .regex(/^INIT-\d{3,}$/, "Must match INIT-NNN, e.g. INIT-001")
    .describe("ID of an initiative already in the register."),
  repository_path: z
    .string()
    .min(1)
    .optional()
    .describe("Path to the repository to re-analyze for fresh evidence. Defaults to the server's working directory."),
});
export type UpdateInitiativeInput = z.infer<typeof UpdateInitiativeInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// get_status
// ─────────────────────────────────────────────────────────────────────────────

export const GetStatusInputSchema = z.object({});
export type GetStatusInput = z.infer<typeof GetStatusInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// TOOL METADATA (name + description shown to the calling model)
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_DESCRIPTIONS = {
  find_initiatives:
    "Analyze a repository and discover the top N improvement opportunities " +
    "(1-10), scored on a 6-axis formula and backed by code, git, test, and " +
    "dependency evidence. Writes the initiative register and one initiative " +
    "brief per discovered opportunity to disk. Evidence collection (code, " +
    "git history, tests, dependencies) always runs in full — there is no " +
    "depth/scope toggle.",
  build_initiative:
    "Generate the full document package for one initiative already in the " +
    "register: an initiative brief, a product epic, a technical " +
    "specification, and one INVEST-validated ticket per scope item. Also " +
    "attempts to advance the initiative's status through the guarded state " +
    "machine, reporting exactly which guard blocked further progress if it " +
    "didn't reach 'Planned'.",
  review_initiatives:
    "Audit every initiative in the register for stale evidence (>90 days " +
    "since last update), potential duplicates (identical problem statement " +
    "text), and initiatives marked Planned/In Progress with no tech spec on " +
    "disk.",
  re_analyze:
    "Re-run the full analysis pipeline and reconcile it against the " +
    "existing register (matched by problem-statement text): reports new " +
    "opportunities, resolved ones, and initiatives whose score changed. " +
    "Updates the register in place.",
  update_initiative:
    "Re-run analysis and refresh one initiative's evidence and score, " +
    "matched by problem-statement text. This re-runs the full pipeline " +
    "(there is no evidence collection scoped to a single finding) and fails " +
    "if the underlying problem is no longer detected — use re_analyze " +
    "instead to reconcile the whole register in that case.",
  get_status:
    "Get an overview of the initiative register: totals by status and the " +
    "highest-scored Proposed opportunity.",
} as const;
