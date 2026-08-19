/**
 * @file mcp-types.ts
 * @description Shared types for the MCP adapter layer.
 *
 * Every tool response follows the same envelope: `{ success: true, data }`
 * or `{ success: false, error }`. There is no fabricated `error_code` enum
 * (e.g. `REPO_NOT_FOUND`) — the real error surface is `ValidationError`
 * (`field`/`expected`/`received`/`suggestion` per detail) or a generic
 * `Error` message, both from `src/commands/command-handler.ts`. This mirrors
 * that surface exactly rather than inventing a parallel one.
 */

import type { ValidationErrorDetail } from "../schemas/types.ts";

export interface McpToolSuccess<T> {
  success: true;
  data: T;
}

export interface McpToolFailure {
  success: false;
  error: {
    message: string;
    /** Structured detail, present only when the failure was a ValidationError */
    details: ValidationErrorDetail[] | null;
  };
}

export type McpToolResponse<T> = McpToolSuccess<T> | McpToolFailure;
