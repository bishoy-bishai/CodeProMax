/**
 * @file mcp-handlers.ts
 * @description Routes validated MCP tool input to the real CommandHandler
 * methods and wraps the result (or error) in the McpToolResponse envelope.
 * Kept separate from mcp-server.ts so these can be unit tested without
 * spinning up a transport.
 */

import type { CommandHandler } from "../commands/command-handler.ts";
import type { InitiativeId } from "../schemas/types.ts";
import { ValidationError } from "../schemas/types.ts";
import type {
  BuildResult,
  FindResult,
  HelpResult,
  ReAnalysisResult,
  ReviewResult,
  StatusResult,
  UpdateResult,
} from "../commands/types.ts";
import type { McpToolResponse } from "./mcp-types.ts";
import type {
  BuildInitiativeInput,
  FindInitiativesInput,
  GetStatusInput,
  ReAnalyzeInput,
  ReviewInitiativesInput,
  UpdateInitiativeInput,
} from "./mcp-tools.ts";

/** Runs a command, converting any thrown error into a structured McpToolFailure. */
async function runTool<T>(fn: () => Promise<T> | T): Promise<McpToolResponse<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { success: false, error: { message: err.message, details: err.details } };
    }
    return {
      success: false,
      error: { message: err instanceof Error ? err.message : String(err), details: null },
    };
  }
}

export async function handleFindInitiatives(
  handler: CommandHandler,
  input: FindInitiativesInput,
  defaultRepoPath: string
): Promise<McpToolResponse<FindResult>> {
  return runTool(() => handler.find(input.num_initiatives, input.repository_path ?? defaultRepoPath));
}

export async function handleBuildInitiative(
  handler: CommandHandler,
  input: BuildInitiativeInput
): Promise<McpToolResponse<BuildResult>> {
  return runTool(() => handler.build(input.initiative_id as InitiativeId));
}

export async function handleReviewInitiatives(
  handler: CommandHandler,
  _input: ReviewInitiativesInput
): Promise<McpToolResponse<ReviewResult>> {
  return runTool(() => handler.review());
}

export async function handleReAnalyze(
  handler: CommandHandler,
  input: ReAnalyzeInput,
  defaultRepoPath: string
): Promise<McpToolResponse<ReAnalysisResult>> {
  return runTool(() => handler.reAnalyze(input.repository_path ?? defaultRepoPath));
}

export async function handleUpdateInitiative(
  handler: CommandHandler,
  input: UpdateInitiativeInput,
  defaultRepoPath: string
): Promise<McpToolResponse<UpdateResult>> {
  return runTool(() => handler.update(input.initiative_id as InitiativeId, input.repository_path ?? defaultRepoPath));
}

export async function handleGetStatus(
  handler: CommandHandler,
  _input: GetStatusInput
): Promise<McpToolResponse<StatusResult>> {
  return runTool(() => handler.status());
}

/** Not one of the 6 registered tools (see mcp-tools.ts for why) — exposed for completeness/testing. */
export function handleHelp(handler: CommandHandler): McpToolResponse<HelpResult> {
  return { success: true, data: handler.help() };
}
