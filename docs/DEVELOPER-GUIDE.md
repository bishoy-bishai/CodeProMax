# Code Pro Max Developer Guide

## Architecture

Code Pro Max is layered strictly bottom-up; each layer only imports from the
ones below it.

```
schemas/     Types, Zod schemas, validators, state machine definition (source of truth)
core/        Repository mapping, evidence classification, scoring, guarded state machine, pipeline
analyzers/   Evidence collection (code/git/test/dependency) + root cause analysis (5 Whys)
services/    Opportunity generation, Initiative assembly/scoring
generators/  Markdown document generators (initiative, epic, tech-spec, tickets) + helpers
validators/  Cross-cutting validators not tied to persistence (currently: INVEST)
commands/    /codepro command orchestration, file I/O, register persistence, consistency checks
cli/         Thin CLI entry point over commands/
adapters/    MCP server exposing commands/ as tools over stdio
```

Deep dives on individual layers:
- [docs/algorithms.md](./algorithms.md) — state machine, repository mapper, evidence classifier, scoring engine
- [docs/evidence-types.md](./evidence-types.md) — evidence type taxonomy
- [docs/pipeline.md](./pipeline.md) — end-to-end `AnalysisPipeline` architecture

Every layer has its own `types.ts` — do not reach into a layer's internals from
two levels up; go through its public exports.

## Conventions

- **No fabrication.** Generators and analyzers never invent numbers, dates, or
  claims. Anything not derivable from real data is rendered as
  `[PLACEHOLDER: ...]`, `[UNKNOWN: ...]`, or `[ASSUMPTION: ...]` (see
  `src/generators/helpers/markdown-utils.ts`). Preserve this when adding new
  sections — resist the urge to make output "look more complete."
- **Zero `any`.** `unknown` only for genuinely opaque input (e.g. freshly
  `JSON.parse`d data), narrowed immediately via a type guard or Zod schema.
- **Explicit nullability.** Use `field: T | null`, not `field?: T`.
  `exactOptionalPropertyTypes` is on.
- **Pure functions where possible.** `transition()`, the scoring formula, and
  every document-section helper take input and return output — no hidden
  mutation, no reaching for ambient state.
- **Imports use an explicit `.ts` extension** (NodeNext-style), matching every
  existing file. Known caveat: the project's current TypeScript version
  rejects this without `allowImportingTsExtensions`, which is off in
  `tsconfig.json` — so `npm run typecheck` reports these as errors everywhere,
  not just in new code. This is a pre-existing, repo-wide condition. Follow
  the existing convention rather than switching styles in new files; fixing it
  project-wide is a separate, deliberate change, not something to do
  incidentally inside a feature PR.

## Adding a New Evidence Source / Analyzer

1. Add the collection method to `src/analyzers/evidence-collector.ts` (or a new
   analyzer class if it's a genuinely new source, not a variant of an existing
   one), returning `Finding[]`.
2. Add fixtures under `fixtures/test-repo/` if the source needs real files to
   scan (see `fixtures/test-repo/` for the existing layout used by
   `evidence-collector.test.ts` and `pipeline.test.ts`).
3. Write tests in `src/analyzers/__tests__/`.
4. Wire it into `AnalysisPipeline.runFullAnalysis` in
   `src/core/analysis-pipeline.ts` — add it to the `Promise.allSettled` fan-out
   alongside the existing four sources, and extend `PipelineSourceResult["source"]`
   in `src/services/types.ts`.

## Adding a New Document Generator

The existing four (`InitiativeGenerator`, `EpicGenerator`, `TechSpecGenerator`,
`TicketGenerator`) all follow the same shape:

1. Add section-builder functions to a new file in `src/generators/helpers/`
   (e.g. `release-sections.ts`), each taking an `Initiative` (and any other
   real data you have) and returning a Markdown string for one section body.
   Use `bulletList`/`placeholder`/`unknownMarker`/`metadataBlock` from
   `src/generators/helpers/markdown-utils.ts` — don't reinvent them.
2. Add the generator class in `src/generators/{name}-generator.ts`, assembling
   the section functions into the full document and calling
   `insertTocIfLong()` at the end.
3. Add a reference template to `templates/{name}.md` describing what each
   section contains (see `templates/initiative.md` for the pattern — it
   documents behavior, it does not contain literal fill-in-the-blank prose).
4. Add tests in `src/generators/__tests__/`.
5. If the new document should be part of `codepro build`, wire it into
   `CommandHandler.build()` in `src/commands/command-handler.ts` and extend
   `ConsistencyChecker` if there's a real cross-document invariant to check.

Note: `release.md` and `stakeholder-report.md` generators do not exist yet.
`CommandHandler.build()` only calls the four generators that are actually
built — see the comment at the top of `command-handler.ts` for why.

## MCP Adapter

`src/adapters/` wraps `CommandHandler` (`src/commands/command-handler.ts`) as
an MCP server, one layer above `commands/` — it does not duplicate command
logic, only translates between the MCP wire format and the same typed
results the CLI prints.

```
mcp-types.ts     McpToolResponse<T> envelope ({success:true,data} | {success:false,error})
mcp-tools.ts     Per-tool zod input schemas + descriptions shown to the calling model
mcp-handlers.ts  Routes validated input to CommandHandler, catches errors into the envelope
mcp-server.ts    createServer(baseDir, commandHandlerOverride?) + stdio entry point
```

`createServer()` takes an optional `CommandHandler` override specifically so
tests can inject a stubbed pipeline (see
`src/adapters/__tests__/mcp-server.test.ts`, which drives the server through
a real `Client` over `InMemoryTransport` — not just calling the handler
functions directly) without running a real repository analysis.

**Adding a 7th tool** (e.g. if a `release` document generator gets built and
you want to expose it): add its zod input schema + description to
`mcp-tools.ts`, add a routing function to `mcp-handlers.ts` that calls the
corresponding `CommandHandler` method through the same `runTool()` wrapper,
then `server.registerTool(...)` it in `mcp-server.ts`. Only expose parameters
that actually change behavior — seen already in this file's history: a
prior draft spec included `analysis_depth`/`include_runtime_signals`/etc.
that `CommandHandler` doesn't implement, and they were deliberately left out
rather than accepted and silently ignored.

`bin/mcp-server.js` spawns `tsx` on `src/adapters/mcp-server.ts` with
`stdio: "inherit"` because there's no compiled build in this project (see the
`.ts`-import-extension note above) and the stdio transport needs an
unmodified pipe to the client.

## Running Tests

```bash
npm test              # full suite, single run
npm run test:watch    # watch mode
npm run test:coverage # coverage (scoped to src/schemas — see vitest.config.ts)
./scripts/run-tests.sh # typecheck (informational) + test + coverage in one pass
```

Test fixtures live inline as temporary directories created/torn down per test
(`mkdir`/`rm` in `beforeEach`/`afterEach`), plus the shared, checked-in
`fixtures/test-repo/` used by the evidence collector and pipeline tests. There
is no separate `fixtures/simple-spa`, `fixtures/monorepo`, etc. — a single
representative fixture repo has been sufficient so far to exercise every
evidence source; add a new fixture directory only when a test genuinely needs
a repo shape the current one can't represent (e.g. a specific monorepo
workspace layout), not preemptively.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md).
