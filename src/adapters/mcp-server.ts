/**
 * @file mcp-server.ts
 * @description MCP server exposing Code Pro Max's six analysis/planning
 * commands as tools over stdio, for Claude Code, the Claude API, or any
 * other MCP-speaking client.
 *
 * `help` is deliberately not registered as a tool — MCP already gives the
 * client a tool list with descriptions (see mcp-tools.ts), so a redundant
 * `get_status`-adjacent "list my own tools" tool would just be noise.
 */

import { pathToFileURL } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CommandHandler } from "../commands/command-handler.ts";
import {
  BuildInitiativeInputSchema,
  FindInitiativesInputSchema,
  GetStatusInputSchema,
  ReAnalyzeInputSchema,
  ReviewInitiativesInputSchema,
  TOOL_DESCRIPTIONS,
  UpdateInitiativeInputSchema,
} from "./mcp-tools.ts";
import {
  handleBuildInitiative,
  handleFindInitiatives,
  handleGetStatus,
  handleReAnalyze,
  handleReviewInitiatives,
  handleUpdateInitiative,
} from "./mcp-handlers.ts";
import type { McpToolResponse } from "./mcp-types.ts";

/** Wraps an McpToolResponse in the MCP content envelope, setting isError on failure. */
function toCallToolResult(response: McpToolResponse<unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    isError: !response.success,
  };
}

/**
 * Build a configured McpServer instance without connecting it to a
 * transport — kept separate from `main()` so tests can register tools and
 * call them directly.
 */
export function createServer(baseDir: string, commandHandlerOverride?: CommandHandler): McpServer {
  const commandHandler = commandHandlerOverride ?? new CommandHandler(baseDir);
  const server = new McpServer({ name: "code-pro-max", version: "0.1.0" });

  server.registerTool(
    "find_initiatives",
    { description: TOOL_DESCRIPTIONS.find_initiatives, inputSchema: FindInitiativesInputSchema.shape },
    async (input) => toCallToolResult(await handleFindInitiatives(commandHandler, input, baseDir))
  );

  server.registerTool(
    "build_initiative",
    { description: TOOL_DESCRIPTIONS.build_initiative, inputSchema: BuildInitiativeInputSchema.shape },
    async (input) => toCallToolResult(await handleBuildInitiative(commandHandler, input))
  );

  server.registerTool(
    "review_initiatives",
    { description: TOOL_DESCRIPTIONS.review_initiatives, inputSchema: ReviewInitiativesInputSchema.shape },
    async (input) => toCallToolResult(await handleReviewInitiatives(commandHandler, input))
  );

  server.registerTool(
    "re_analyze",
    { description: TOOL_DESCRIPTIONS.re_analyze, inputSchema: ReAnalyzeInputSchema.shape },
    async (input) => toCallToolResult(await handleReAnalyze(commandHandler, input, baseDir))
  );

  server.registerTool(
    "update_initiative",
    { description: TOOL_DESCRIPTIONS.update_initiative, inputSchema: UpdateInitiativeInputSchema.shape },
    async (input) => toCallToolResult(await handleUpdateInitiative(commandHandler, input, baseDir))
  );

  server.registerTool(
    "get_status",
    { description: TOOL_DESCRIPTIONS.get_status, inputSchema: GetStatusInputSchema.shape },
    async (input) => toCallToolResult(await handleGetStatus(commandHandler, input))
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer(process.cwd());
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Code Pro Max MCP server running on stdio (6 tools registered).");
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err: unknown) => {
    console.error("Code Pro Max MCP server failed to start:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
