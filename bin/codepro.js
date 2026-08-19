#!/usr/bin/env node
/**
 * @file bin/codepro.js
 * @description Launches the Code Pro Max CLI.
 *
 * Same rationale as bin/mcp-server.js: there is no compiled build in this
 * project, so this spawns `tsx` on `src/cli/entry-point.ts` directly and
 * forwards argv/stdio unmodified.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsxBin = join(__dirname, "..", "node_modules", ".bin", "tsx");
const entry = join(__dirname, "..", "src", "cli", "entry-point.ts");

const child = spawn(tsxBin, [entry, ...process.argv.slice(2)], { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error(`Failed to start Code Pro Max CLI: ${err.message}`);
  process.exit(1);
});
