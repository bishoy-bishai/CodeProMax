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
 *
 * `tsx`'s CLI is resolved via `import.meta.resolve` rather than a relative
 * `node_modules/.bin/tsx` path — when this package is installed as a
 * dependency (e.g. via `npx codepromax`), npm hoists `tsx`'s binary to the
 * *consumer's* top-level node_modules, not into codepromax's own.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
const entry = join(__dirname, "..", "src", "adapters", "mcp-server.ts");

const child = spawn(process.execPath, [tsxCli, entry], { stdio: "inherit" });
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
