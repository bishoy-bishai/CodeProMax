#!/usr/bin/env node
/**
 * @file bin/mcp-server.js
 * @description Launches the Code Pro Max MCP server.
 *
 * There is no compiled build in this project (`npm run build` only runs
 * `tsc --noEmit`) — every entry point, including the existing CLI, is run
 * directly against TypeScript source via `tsx`. This launcher spawns `tsx`
 * on `src/adapters/mcp-server.ts` and inherits stdio unmodified, since the
 * MCP stdio transport requires an untouched stdin/stdout pipe to the client.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsxBin = join(__dirname, "..", "node_modules", ".bin", "tsx");
const entry = join(__dirname, "..", "src", "adapters", "mcp-server.ts");

const child = spawn(tsxBin, [entry], { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error(`Failed to start Code Pro Max MCP server: ${err.message}`);
  process.exit(1);
});
