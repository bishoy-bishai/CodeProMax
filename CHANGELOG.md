# Changelog

All notable changes to Code Pro Max are documented here. Dates reflect when
work was completed in this repository.

## [0.1.1] — 2026-08-19

### Fixed
- `bin/codepro.js` and `bin/mcp-server.js` resolved `tsx` via a hardcoded
  `node_modules/.bin/tsx` path, which only works when this package is the
  root package. Installed as a dependency (e.g. via `npx`), npm hoists
  `tsx`'s binary elsewhere, so both launchers failed with `ENOENT`. Both now
  resolve `tsx`'s CLI via `import.meta.resolve("tsx/cli")`.
- Test files (`**/__tests__/**`, `*.test.ts`) are now excluded from the
  published npm package.

## [0.1.0] — Unreleased

### Phase 0 — Core Schemas & Algorithms
- `src/schemas/`: `Initiative`, `Finding`, `EvidenceRecord`, `ScoringResult`,
  `InitiativeRegister` types with matching Zod schemas, type guards,
  parse/serialize/deserialize helpers, and a schema-layer state machine
  definition.
- `src/core/`: guarded, function-based state machine (`transition()`) with a
  structured audit log (`TransitionRecord`); `RepositoryMapper` (async repo
  scanner: language stats, framework/entry-point detection, dependency graph);
  `EvidenceClassifier` (FACT/INFERENCE/HYPOTHESIS/UNKNOWN classification with
  contradiction/gap detection); `ScoringEngine` (the 6-axis ICE-extended
  formula, ranking with tiebreak explanations).

### Phase 1 — Evidence, Root Cause, and the Analysis Pipeline
- `src/analyzers/evidence-collector.ts`: code, git, test, and dependency
  evidence collection over a `RepositoryMap`.
- `src/analyzers/root-cause-analyzer.ts`: 5-Whys root cause analysis with
  systemic/actionable classification and explicit termination reasons.
- `src/services/opportunity-generator.ts`: template-driven, outcome-oriented
  Opportunity generation from Findings + RCAs.
- `src/services/initiative-factory.ts`: derives the 6-axis scoring breakdown
  from finding/RCA evidence and assembles the full `Initiative`.
- `src/core/analysis-pipeline.ts`: the 7-stage `AnalysisPipeline`
  (`runFullAnalysis`) orchestrating all of the above with parallel evidence
  collection, per-source failure isolation, and timeout handling.

### Phase 2 — Document Generators
- `src/generators/initiative-generator.ts`, `epic-generator.ts`: strategic and
  product-facing Markdown documents generated from an `Initiative`, with
  `[PLACEHOLDER]`/`[UNKNOWN]`/`[ASSUMPTION]` markers for anything not backed
  by real data instead of fabricated content.
- `src/generators/tech-spec-generator.ts`: 12-section technical specification,
  including a Mermaid architecture diagram derived from declared scope and
  NFR sections auto-populated by keyword-matching recorded risks.
- `src/generators/ticket-generator.ts` + `src/validators/invest-validator.ts`:
  vertical-slice ticket generation (one ticket per scope item, effort derived
  from the real `cost` scoring axis, automatic splitting of oversized
  tickets) and INVEST validation with per-criterion pass/fail reasons.

### Phase 3 — Workflow Commands
- `src/commands/command-handler.ts`: all seven `/codepro` commands (`find`,
  `build`, `review`, `re-analyze`, `update`, `status`, `help`) built on the
  real pipeline, generators, and guarded state machine — not a mock of them.
- `src/commands/register-manager.ts`: `register.json` as the lossless source
  of truth (round-trips through the existing Zod validators), with a
  regenerated (never parsed back) `initiative-register.md` summary.
- `src/commands/consistency-checker.ts`: structural cross-document checks
  (scope coverage, ticket-to-scope mapping, INVEST readiness, dependency
  referential integrity).
- `src/cli/entry-point.ts`: CLI dispatch over `CommandHandler`.

### MCP Adapter
- `src/adapters/mcp-server.ts`: MCP server (via `@modelcontextprotocol/sdk`'s
  `McpServer`) exposing six of the seven `/codepro` commands as tools over
  stdio (`help` omitted — MCP clients already receive a described tool
  list). `bin/mcp-server.js` / `npm run start:mcp` launches it.
- `src/adapters/mcp-tools.ts`: zod input schemas exposing only parameters
  `CommandHandler` actually implements — `analysis_depth`,
  `include_runtime_signals`, `export_format`, and similar fields from an
  earlier draft spec were deliberately left out rather than accepted and
  silently ignored.
- `src/adapters/mcp-handlers.ts`: routes validated input to `CommandHandler`,
  mapping `ValidationError` (and generic errors) into a
  `{success:false, error}` envelope rather than inventing an error-code
  enum.
- Tested end-to-end over the real MCP protocol via `InMemoryTransport` and a
  real `Client`, not just by calling the handler functions directly.

### Known Gaps (tracked, not silently dropped — see RELEASE-NOTES.md)
- `release.md` and `stakeholder-report.md` document generators are not built;
  `codepro build` generates the four document types that exist.
- `codepro update` re-runs the full analysis pipeline rather than collecting
  evidence scoped to a single finding (no such targeted API exists yet).
- Coverage thresholds in `vitest.config.ts` are scoped to `src/schemas/` only
  and are not fully met for branches/functions (see RELEASE-NOTES.md for
  exact numbers).
- `npm run typecheck` reports errors from the project's `.ts`-extension import
  style, which predates this changelog and spans the whole codebase.
