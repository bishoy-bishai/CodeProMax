# Contributing to Code Pro Max

## Before You Start

Read [docs/DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md) for the layering rules
and the "no fabrication" convention that shapes every generator and analyzer
in this codebase. Code that invents plausible-looking data instead of marking
it `[UNKNOWN]`/`[PLACEHOLDER]` will not be merged, regardless of how complete
it looks.

## Workflow

1. Fork or branch from `main`.
2. Make your change, following the conventions in the Developer Guide
   (explicit `.ts` import extensions, `T | null` over `T?`, no `any`).
3. Add or update tests under the relevant `__tests__/` directory. New
   generator sections, analyzers, or commands need tests, not just an
   implementation.
4. Run `npm test` and `npm run typecheck` locally. Note the typecheck caveat
   in the Developer Guide — it currently reports pre-existing `.ts`-extension
   errors project-wide; don't let that block you, but don't introduce *new*
   categories of type error either (missing exports, wrong types, etc.).
5. Open a PR describing what changed and why. If you're adding a document
   generator, ticket type, or command, link the relevant section of the
   Developer Guide you followed.

## Commit Style

This repo has been using short, imperative commit subjects prefixed with
`feat:`/`fix:`/`docs:`/`test:` (see `git log` for examples). Keep the body
focused on *why*, not a restatement of the diff.

## Code Review Checklist

- Does new generator/analyzer output ever assert something not backed by real
  data? If so, it needs a `[PLACEHOLDER]`/`[UNKNOWN]`/`[ASSUMPTION]` marker
  instead.
- Are Zod schemas in `src/schemas/schemas.ts` updated in lockstep with any
  type change in `src/schemas/types.ts`? They are hand-kept in sync, not
  generated from each other.
- Does a new state transition or guard get added to
  `src/core/state-machine.ts` (executable guards) *and* documented in
  `src/schemas/state-machine.ts` (the string-based schema-layer definition)?
- Do new commands or file paths go through `src/commands/paths.ts` rather than
  constructing paths ad hoc?

## Reporting Issues

There is no public tracker yet — see [RELEASE-NOTES.md](../RELEASE-NOTES.md)
for current known gaps before filing something that may already be a known,
scoped-out limitation.
