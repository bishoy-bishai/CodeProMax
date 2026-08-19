# Release Notes — v0.1.0

## What's Included

Code Pro Max v0.1.0 is an end-to-end pipeline from "scan a repository" to
"generate actionable, evidence-backed planning documents":

1. **Analysis** — scans a repository, collects evidence from code, git
   history, tests, and dependencies, runs 5-Whys root cause analysis, and
   scores the resulting opportunities on a 6-axis formula
   (impact/confidence/urgency/leverage/cost/risk).
2. **Documents** — generates an initiative brief, a product-facing epic, a
   12-section technical specification, and INVEST-validated implementation
   tickets, all derived from the same `Initiative` record so they can't drift
   from each other by construction.
3. **Workflow** — seven `/codepro` commands (`find`, `build`, `review`,
   `re-analyze`, `update`, `status`, `help`) persist findings to a register,
   drive documents to disk, and advance initiative status through a guarded
   state machine.
4. **MCP server** — six of the seven commands (all but `help`) are exposed as
   MCP tools over stdio (`npm run start:mcp`), for Claude Code, Claude
   Desktop, or any other MCP client, returning the exact same data the CLI
   prints, wrapped in a `{success, data}`/`{success:false, error}` envelope.

See [docs/OPERATOR-GUIDE.md](docs/OPERATOR-GUIDE.md) for usage and
[docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) for the architecture.

## Test Suite

357 tests passing across 20 test files (`npm test`), covering schemas, the
core algorithms, evidence collection, root cause analysis, the full pipeline,
all four document generators, INVEST validation, every command, and the MCP
adapter (including an end-to-end protocol test over a real MCP `Client`).

## Known Gaps

Read this section before treating v0.1.0 as feature-complete — it isn't, and
this list is the honest boundary of what's here versus what an earlier draft
spec described:

- **`release.md` and `stakeholder-report.md` are not implemented.** The
  original Phase 3 spec described `codepro build` generating six documents;
  only four generators exist (initiative, epic, tech-spec, tickets).
  `codepro build` generates those four and does not pretend to generate the
  other two.
- **`codepro update` re-runs the full analysis pipeline**, then matches the
  result back to the target initiative by problem-statement text. There is no
  API for collecting evidence scoped to a single finding — evidence
  collection always operates over a full `RepositoryMap`. This makes `update`
  as slow as `re-analyze` for a single initiative; it is correct, not fast.
- **Initiative matching across analysis runs is text-based** (normalized
  problem-statement string equality), used by both `re-analyze` and `update`.
  A problem whose description changes materially between runs will be treated
  as new/resolved rather than matched — there is no semantic or fuzzy
  matching.
- **No performance benchmarks exist yet.** Nothing in this release has been
  measured against a 100K-file repository or given a time budget; the CLI
  does not expose a `--timeout` or `--exclude` flag (the underlying pipeline
  supports a `timeoutMs` option programmatically, but it isn't wired to the
  CLI). Don't assume specific timing numbers hold — none have been published
  because none have been measured.
- **Coverage gate is partial.** `vitest.config.ts` scopes coverage collection
  to `src/schemas/` only. Within that scope: 100% statements/lines, 85.71%
  branches, 100% functions for `schemas.ts`; the layer average is 94.21%
  statements/lines but only ~77% branches and ~79% functions against
  configured thresholds of 85%/90%. Coverage outside `src/schemas/` (core,
  analyzers, generators, commands) is not measured by the configured gate,
  though those layers do have substantial test suites of their own (see test
  counts in `CHANGELOG.md`'s Phase 1-3 entries).
- **`npm run typecheck` reports errors.** The codebase imports sibling
  modules with an explicit `.ts` extension throughout (NodeNext-style); the
  installed TypeScript version rejects that without
  `allowImportingTsExtensions`, which is off in `tsconfig.json`. This is
  repo-wide and predates this release — it is not a defect introduced by any
  specific phase, but it does mean "no TypeScript errors" is not currently
  true and shouldn't be claimed as a met gate.
- **No LangChain/Semantic Kernel/OpenAI-function-calling adapter.** MCP
  itself is implemented (`src/adapters/`); wrappers for frameworks that don't
  speak MCP directly are not.
- **No security review has been performed** as part of this release,
  including of the new MCP server surface (untrusted tool-call arguments are
  validated by zod schemas before reaching `CommandHandler`, but that
  validation has not had a dedicated security pass).
- **Not published to a registry.** There is no `npm install code-pro-max` yet
  — run it from a local checkout (see the Operator Guide's Installation
  section).

## Upgrading

N/A — this is the first release.

## Contributors

See `git log` for the commit history this release is built from.
