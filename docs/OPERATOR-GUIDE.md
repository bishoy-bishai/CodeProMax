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
