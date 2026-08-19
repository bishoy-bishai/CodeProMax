#!/usr/bin/env node
/**
 * @file entry-point.ts
 * @description CLI entry point for the /codepro commands.
 *
 * Usage:
 *   codepro find <N> [repoPath]
 *   codepro build <INIT-ID>
 *   codepro review
 *   codepro re-analyze [repoPath]
 *   codepro update <INIT-ID> [repoPath]
 *   codepro status
 *   codepro help
 */

import { CommandHandler } from "../commands/command-handler.ts";
import { ValidationError } from "../schemas/types.ts";
import type { InitiativeId } from "../schemas/types.ts";

function requireArg(args: string[], index: number, usage: string): string {
  const value = args[index];
  if (value === undefined) {
    throw new Error(`Missing argument. Usage: ${usage}`);
  }
  return value;
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  const baseDir = process.cwd();
  const handler = new CommandHandler(baseDir);

  switch (command) {
    case "find": {
      const n = Number(requireArg(args, 0, "codepro find <N> [repoPath]"));
      const repoPath = args[1] ?? baseDir;
      const result = await handler.find(n, repoPath, {
        onProgress: (step, detail) => console.log(`[${step}] ${detail}`),
      });
      console.log(`\nGenerated ${result.filesCreated.length} file(s) for ${result.initiatives.length} initiative(s).`);
      for (const init of result.initiatives) {
        console.log(`  ${init.id} — ${init.name} (${init.scoring.finalScore}/100)`);
      }
      break;
    }

    case "build": {
      const id = requireArg(args, 0, "codepro build <INIT-ID>") as InitiativeId;
      const result = await handler.build(id);
      console.log(`Built ${result.ticketCount} ticket(s) across ${result.filesCreated.length} file(s).`);
      console.log(`Status: ${result.finalStatus} — Consistency: ${result.consistencyValid ? "OK" : "ISSUES FOUND"}`);
      for (const e of result.consistencyErrors) console.log(`  ✗ ${e}`);
      for (const w of result.transitionWarnings) console.log(`  ! ${w}`);
      break;
    }

    case "review": {
      const result = await handler.review();
      console.log(`${result.issuesFound} issue(s) across ${result.initiativeCount} initiative(s).`);
      for (const issue of result.issues) {
        console.log(`  [${issue.severity}] ${issue.initiativeId}: ${issue.issue} — ${issue.recommendation}`);
      }
      break;
    }

    case "re-analyze": {
      const repoPath = args[0] ?? baseDir;
      const result = await handler.reAnalyze(repoPath, {
        onProgress: (step, detail) => console.log(`[${step}] ${detail}`),
      });
      console.log(result.summary);
      break;
    }

    case "update": {
      const id = requireArg(args, 0, "codepro update <INIT-ID> [repoPath]") as InitiativeId;
      const repoPath = args[1] ?? baseDir;
      const result = await handler.update(id, repoPath);
      console.log(
        `${result.initiativeId}: score ${result.previousScore} → ${result.newScore} ` +
          `(${result.scoreChanged ? "changed" : "unchanged"}), ${result.evidenceCount} evidence record(s).`
      );
      break;
    }

    case "status": {
      const result = await handler.status();
      console.log(`Total initiatives: ${result.totalInitiatives}`);
      for (const [status, count] of Object.entries(result.byStatus)) {
        console.log(`  ${status}: ${count}`);
      }
      if (result.topOpportunity !== null) {
        console.log(`Top opportunity: ${result.topOpportunity.id} — ${result.topOpportunity.name} (${result.topOpportunity.score}/100)`);
      }
      console.log(`Last analyzed: ${result.lastAnalyzed}`);
      break;
    }

    case "help":
    case undefined: {
      const result = handler.help();
      for (const c of result.commands) {
        console.log(`${c.name}\n  ${c.description}\n  e.g. ${c.example}\n`);
      }
      break;
    }

    default:
      console.error(`Unknown command: "${command}". Run "codepro help" for usage.`);
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  if (err instanceof ValidationError) {
    console.error(`Error: ${err.message}`);
    for (const d of err.details) {
      console.error(`  - ${d.field}: expected ${d.expected}, got ${JSON.stringify(d.received)}${d.suggestion !== null ? ` (${d.suggestion})` : ""}`);
    }
  } else {
    console.error(err instanceof Error ? err.message : String(err));
  }
  process.exitCode = 1;
});
