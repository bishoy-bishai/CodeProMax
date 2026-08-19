# Code Pro Max Operator Guide

Code Pro Max analyzes a repository, turns what it finds into scored, evidence-backed
**Initiatives**, and generates the planning documents (initiative brief, epic, tech
spec, tickets) needed to act on them.

This guide covers the `/codepro` commands as they exist today. It does not describe
aspirational features — if something isn't listed here, it isn't implemented yet
(see [RELEASE-NOTES.md](../RELEASE-NOTES.md) for the current scope).

## Installation

The package is not yet published. Run it from a local checkout:

```bash
git clone <repo-url>
cd CodeProMax
npm install
```

## Quick Start

```bash
# From the repo you want to analyze, or pass a path as the second argument
npx tsx src/cli/entry-point.ts find 5 /path/to/target/repo
```

This scans the target repository, scores the opportunities it finds, writes
`documents/initiatives/register.json` + `initiative-register.md`, and generates a
Markdown brief for each of the top 5 initiatives under
`documents/initiatives/{slug}/initiative.md`.

> The CLI is TypeScript run via NodeNext-style `.ts` imports. Until the package
> ships a compiled build, invoke it with a TypeScript runner (`tsx`, `ts-node --esm`,
> or equivalent) rather than plain `node`.

## Commands

### `codepro find <N> [repoPath]`

Analyzes the repository (default: current directory) and generates initiative
documents for the top `N` opportunities, `N` between 1 and 10.

```bash
codepro find 5 .
```

Writes:
- `documents/initiatives/register.json` — every initiative found, not just the top N
- `documents/initiatives/initiative-register.md` — human-readable summary table
- `documents/initiatives/{slug}/initiative.md` — one per top-N initiative

> **`documents/` is written relative to where you *run* the command, not
> `repoPath`.** `codepro find 5 /some/other/repo` analyzes
> `/some/other/repo` but writes `documents/initiatives/` under your current
> directory. Run the command from inside the repo you want documents written
> into (`cd /some/other/repo && codepro find 5 .`), or pass `.` as shown
> above, if you want analysis target and output location to be the same
> place.

### `codepro build <INIT-ID>`

Generates the full document package for one initiative already in the register:
`initiative.md`, `epic.md`, `tech-spec.md`, and one ticket file per scope item
under `tickets/`. Runs a cross-document consistency check and reports any
violations. Attempts to advance the initiative's status through the guarded
state machine (`Proposed → Selected → Planned`); it stops and reports why at
the first guard that doesn't pass — for example, an unanswered open question
blocks `Selected → Planned`.

```bash
codepro build INIT-001
```

### `codepro review`

Audits every initiative in the register:
- **Stale evidence** — not updated in over 90 days
- **Potential duplicates** — identical problem statement text
- **Missing tech spec** — status is `Planned`/`In Progress` but no tech-spec file exists on disk

```bash
codepro review
```

### `codepro re-analyze [repoPath]`

Re-runs the full analysis and reconciles it against the existing register by
matching on problem statement text: reports new opportunities, resolved ones
(no longer detected), and initiatives whose score changed. Updates the
register in place, preserving each surviving initiative's `id`, `status`, and
`owner`.

```bash
codepro re-analyze .
```

### `codepro update <INIT-ID> [repoPath]`

Re-runs the analysis and refreshes just one initiative's evidence and score,
matched by problem statement. Throws if the underlying finding no longer
appears — that usually means the problem was resolved; run `re-analyze` to
reconcile the whole register instead.

```bash
codepro update INIT-001 .
```

### `codepro status`

Prints register totals by status and the highest-scored `Proposed` initiative.

```bash
codepro status
```

### `codepro help`

Lists all commands with a one-line description and example.

## MCP Server

Code Pro Max also runs as an MCP server, exposing six of the seven commands
above as tools over stdio (`help` is skipped — MCP clients already get a tool
list with descriptions, so it's redundant).

```bash
npm run start:mcp
```

This starts `bin/mcp-server.js`, which registers `find_initiatives`,
`build_initiative`, `review_initiatives`, `re_analyze`, `update_initiative`,
and `get_status`, then blocks on stdio waiting for a client. It's meant to be
launched by an MCP client, not run interactively — a bare terminal will look
like it's hanging, which is normal (check stderr for
`Code Pro Max MCP server running on stdio (6 tools registered).`).

### Configuring a Client

Point your MCP client at the launcher script. For Claude Desktop / Claude
Code style JSON config:

```json
{
  "mcpServers": {
    "code-pro-max": {
      "command": "node",
      "args": ["/absolute/path/to/CodeProMax/bin/mcp-server.js"]
    }
  }
}
```

The server's working directory is what `repository_path` and
`initiative_id`-relative document paths resolve against by default — start
it from (or point it at) the repository you want analyzed, or pass an
explicit `repository_path` in the tool call.

### Tool ↔ Command Mapping

| MCP tool | CLI equivalent | Real parameters exposed |
|---|---|---|
| `find_initiatives` | `codepro find <N> [repoPath]` | `num_initiatives` (1-10, default 5), `repository_path` (optional) |
| `build_initiative` | `codepro build <INIT-ID>` | `initiative_id` (required, `INIT-NNN`) |
| `review_initiatives` | `codepro review` | none |
| `re_analyze` | `codepro re-analyze [repoPath]` | `repository_path` (optional) |
| `update_initiative` | `codepro update <INIT-ID> [repoPath]` | `initiative_id` (required), `repository_path` (optional) |
| `get_status` | `codepro status` | none |

No tool accepts `analysis_depth`, `include_runtime_signals`,
`include_git_history`, `export_format`, `compare_to_previous`,
`recalculate_score`, or `check_*` flags — none of those affect real behavior
in `CommandHandler`, so they aren't offered as knobs a model could believe it
was turning.

### Response Shape

Every tool returns one text content block containing JSON:
`{ "success": true, "data": ... }` (the same shape the CLI's underlying
`CommandHandler` method returns) or
`{ "success": false, "error": { "message": ..., "details": [...] | null } }`,
with `isError: true` set on the MCP result. `details` is populated when the
failure was a structured `ValidationError` (see the README's
[Error Handling](../README.md#error-handling--limitations) section) and
`null` for a generic error.

Malformed tool *arguments* (e.g. an `initiative_id` that doesn't match
`INIT-NNN`) are rejected by the MCP SDK's own schema validation before the
handler runs at all — the client gets an MCP protocol error, not this
`{success:false}` envelope.

## Troubleshooting

### "Initiative INIT-XXX not found"

The ID isn't in `documents/initiatives/register.json`. Run `codepro status` or
open `initiative-register.md` to see valid IDs, or run `codepro find` first.

### "No matching finding for INIT-XXX in the current repository state"

`update` re-runs the analyzer and matches the target initiative by its problem
statement text. If nothing matches, the underlying problem is likely already
fixed (or its description changed enough that the exact-text match failed).
Run `codepro re-analyze` to reconcile the whole register instead of one
initiative.

### Consistency check reports issues after `build`

The consistency checker verifies that every scope item is represented in the
epic, the tech spec, and by at least one INVEST-ready ticket. Since all
documents are generated from the same `Initiative` object, a failure here
usually points to a generator bug rather than something you did — file it with
the full `consistencyErrors` list from the command output.

### Status doesn't reach "Planned" after `build`

This is expected, not a bug: `build` only advances status as far as the real
guards allow (see `src/core/state-machine.ts`). A freshly-discovered
initiative from `find` typically has an unanswered open question (e.g. "who
owns this?"), which blocks `Selected → Planned` until it's answered. The
`transitionWarnings` field in the command output says exactly which guard
stopped it.

## Performance Notes

There is no built-in timeout flag or exclude-list flag on the CLI today.
`AnalysisPipeline.runFullAnalysis` accepts a `timeoutMs` option and an
`onProgress` callback programmatically (see
[DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md)); the CLI does not currently expose
either as a flag. Large repositories with many files will take longer,
proportional to file/commit count — no fixed performance numbers are published
here because none have been benchmarked against real repositories of scale yet
(see [RELEASE-NOTES.md](../RELEASE-NOTES.md)).

## Support

This project has no public issue tracker yet. Coordinate with whoever gave you
this checkout.
