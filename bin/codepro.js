#!/usr/bin/env node
/**
 * @file bin/codepro.js
 * @description Launches the Code Pro Max CLI.
 *
 * Same rationale as bin/mcp-server.js: there is no compiled build in this
 * project, so this spawns `tsx` on `src/cli/entry-point.ts` directly and
 * forwards argv/stdio unmodified.
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
const entry = join(__dirname, "..", "src", "cli", "entry-point.ts");

const child = spawn(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], { stdio: "inherit" });
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
