# Branch Operations — Onboarding & Review

Supports [SKILL.md](../SKILL.md)'s `onboarding <branch>` and
`review <branch>` operations. Both are read-only analysis of an actual git
branch's code — distinct from the planning-package operations elsewhere in
this skill, and from bare `/code-pro-max review` (Phase 4 consistency
check on a planning package, not a branch).

**Core principle: the branch is the subject of the analysis, not the
author's presumed intent.** Review what actually exists. Code, tests,
repository configuration, and git history are authoritative for
implementation evidence. Commit messages, TODOs, comments, ticket titles,
branch names, and PR descriptions are context for understanding intent —
never proof that the intent was correctly implemented. Never turn an
assumption into a fact.

This file orchestrates the workflow. Finding-quality rules (confidence
tiers, validation, deduplication) live in
[evidence-and-analysis.md](evidence-and-analysis.md) §04; Recommendation
Strength and Severity live in
[documentation-framework.md](documentation-framework.md) — both operations
below use those directly rather than restating them.

---

## Shared: Branch Evidence Gathering

Run this full pipeline before either operation produces output.

**Step 0 — Repository state.** Check `git status --short`,
`git branch --show-current`, `git rev-parse --show-toplevel`. Determine
whether the working tree has staged/unstaged changes, untracked files, or
merge conflicts. **The target is the git ref, not the user's current
uncommitted work** — don't silently mix working-tree changes into branch
evidence. If working-tree changes exist and could affect interpretation,
report them explicitly and exclude them unless the user explicitly asks to
review the working tree instead of a branch.

**Step 1 — Resolve the base branch.** Preferred order:
`refs/remotes/origin/HEAD` → `main` → `master` → `develop`. Prefer the
resolved remote-tracking canonical branch over assuming a local branch is
current. If more than one plausible base exists and it's unclear which the
target forked from, **ask the user rather than guessing**. Record the base
branch and how it was resolved — this goes in the final output. All
comparisons use `merge-base(base, branch) → branch` (i.e.
`git diff <base>...<branch>`, three-dot) — never compare against the
working tree.

**Step 2 — Confirm the target branch exists.**
`git rev-parse --verify --quiet <branch>`. If it doesn't resolve locally,
try `git fetch origin <branch>` once and re-check. If it still doesn't
resolve: **stop and report** — don't guess what the user meant. No
onboarding or review work happens before this passes.

**Step 3 — Gather git evidence.** `git merge-base <base> <branch>`,
`git log <base>..<branch> --format="%H|%aI|%s|%an"`,
`git diff <base>...<branch> --stat`,
`git diff --name-status <base>...<branch>`, and the full diff. Also check
for renames, deletions, binary files, file-mode changes, and submodule
changes — note them even if they're skipped from behavioral reasoning
(lockfiles, build artifacts, vendored code). For large diffs: inspect all
changed-file metadata, all architectural/contract changes, all runtime
behavior changes, representative hunks of repetitive changes, and
prioritize shared/central modules, changed public APIs, and deleted/
renamed files. **Never silently skip large sections of a diff** — if true
full coverage wasn't feasible, say so explicitly in the output.

**Step 4 — Trace planning/intent artifacts.** Search, in order: branch
name → commit messages → PR title/body (if available) → changed-file
references → `initiative-register.md` → `tickets/` → related planning
docs, for identifiers like `{{slug}}-NNN` or `INIT-NNN`. If found, retrieve
that Initiative/Ticket's Problem Statement, Acceptance Criteria, Scope, and
Non-Goals. **Planning artifacts are contextual evidence, not proof the
branch implements the requested behavior** — verify the actual code and
tests correspond to it. If nothing traces, state explicitly:
`[UNKNOWN: no linked ticket/initiative found — inferred from diff only]`.

**Step 5 — Scope & intent alignment.** Before detailed review: what problem
was this branch supposed to solve, what acceptance criteria exist, what was
actually implemented, is anything required missing, are there unrelated
changes, did scope expand unnecessarily, did unrelated refactors sneak in?
If a ticket/Initiative was traced, map every Acceptance Criterion to
`Satisfied` / `Partially satisfied` / `Not satisfied` / `Not verifiable`,
each with repository evidence — never infer satisfaction from naming or
stated intent alone.

**Step 6 — Shared component / consumer analysis.** When a changed module is
shared or exported (UI components, public utilities, API clients, hooks,
config, domain services, shared types), inspect its actual consumers where
practical for concrete compatibility/regression risk. Use repository
evidence for what the consumers are — don't invent hypothetical ones.

Neither operation modifies code. Both are analysis only.

---

## Operation: Onboarding

`/code-pro-max onboarding <branch>` — a handoff document for a new
engineer, a reviewer, or future-you picking up this branch months later.
Explains behavior, doesn't narrate the diff.

Fill [templates/onboarding.md](../templates/onboarding.md):

- **What Changed** — plain-language behavior description. Not "Modified
  Foo.tsx, added Bar.ts" — instead "the shared DataTable now supports
  opt-in column anchoring while preserving existing behavior for consumers
  that don't enable it." Use commit history and diff evidence to
  understand the change, but describe the resulting behavior.
- **Why** — tied to the linked ticket/Initiative's Problem Statement (Step
  4). Otherwise `[UNKNOWN: no linked ticket/initiative found — inferred
  from diff only]`. Never present inferred motivation as fact.
- **Before → After** — the behavioral change in those exact terms, not a
  reproduced diff.
- **How It Works** — a short runtime/data-flow mental model, ~3–7 steps,
  using only relationships supported by repository evidence. Don't invent
  architecture.
- **Key Files to Read First** — ranked: central implementation → shared/
  public contract → primary consumer → tests defining behavior →
  configuration/integration → supporting implementation. One sentence each
  on why it matters. Not just `git diff --stat` order. Don't omit large or
  complex files because they're hard to summarize.
- **How to Run / Test Locally** — only commands discoverable from the
  repo's actual `package.json`, `Makefile`, CI config, README, or test
  config. Never invented from general framework knowledge.
  `[UNKNOWN: no repository-defined run/test convention found]` if none
  exists.
- **Acceptance Criteria** — the Step 5 mapping (`Satisfied`/`Partially
  satisfied`/`Not satisfied`/`Not verifiable`) if any were traced;
  `[UNKNOWN: no linked acceptance criteria found]` otherwise.
- **Non-Goals / Assumptions** — only when supported by the ticket,
  Initiative, Tech Spec, ADR, or clear implementation constraints. Don't
  manufacture them; mark uncertain ones explicitly.
- **Open Questions / Risks** — anything the diff alone leaves unclear.
- **Related Docs** — links to Initiative/Epic/Tech Spec/ADR/ticket if
  traced.

Write to `onboarding/{{branch-slug}}.md` and print the complete document
inline — the user shouldn't have to open a file to read it.

### Final Validation Checklist — Onboarding

- [ ] Repository state was checked (Step 0); working-tree changes weren't
      mixed into branch evidence.
- [ ] Base branch was actually resolved and recorded, not assumed.
- [ ] Merge base was identified.
- [ ] Target branch was confirmed to resolve to a real git ref.
- [ ] What Changed describes behavior, not a diff narration.
- [ ] Why is evidence-linked or explicitly `[UNKNOWN: ...]`.
- [ ] Before → After and How It Works are evidence-based, not invented.
- [ ] Acceptance Criteria were mapped when available.
- [ ] Key Files are ranked, not raw diff-stat order.
- [ ] Run/test commands came from real repository configuration — none
      invented.
- [ ] Open Questions/Risks contain only evidence-backed uncertainty.
- [ ] The branch itself was not modified.

---

## Operation: Review

`/code-pro-max review <branch>` — an evidence-based review of the branch's
actual code diff. (Bare `/code-pro-max review`, no branch argument, is the
unrelated Phase 4 planning-package check — see `SKILL.md`.)

Review in this exact order:

1. **Scope & Intent Alignment** — the Step 5 result: does the implementation
   match the linked ticket/Initiative and its Acceptance Criteria?
2. **Architecture & Boundaries** — module boundaries, layering, ownership,
   dependency direction, abstraction leakage, shared-component contracts.
3. **Domain & Business Invariants** — business rules, state transitions,
   domain constraints, invalid states, edge conditions.
4. **Correctness & Error Handling** — normal paths, edge cases, failure
   paths, race conditions, async behavior, concurrency, stale state,
   null/undefined handling, retries, partial failures.
5. **Security** — input validation, authZ/authN boundaries, injection
   risk, unsafe data handling, secrets, sensitive-data exposure. Don't
   invent issues where the changed code creates no relevant security
   surface.
6. **Performance** — N+1s, unbounded loops/allocations, unnecessary
   re-renders, expensive recalculation, duplicated requests, new
   hotspots. No speculative performance concerns.
7. **Readability & Simplicity** — unnecessary abstractions, duplicated
   logic, dead code, confusing control flow, behavior hidden behind
   excessive indirection. Never classify subjective style as `MUST`.
8. **Testing** — distinguish new behavior with adequate new tests, new
   behavior covered by existing tests, changed behavior with insufficient
   coverage, tests exercising the wrong path, tests asserting
   implementation details instead of behavior, and missing regression
   coverage for affected shared behavior. Ask: *if this implementation
   were wrong, what test would actually fail?* Absence of a new test file
   is not automatically a finding if existing tests demonstrably cover the
   behavior — see the Testing Philosophy note below.
9. **Documentation** — do README, API docs, component docs, comments,
   architecture docs, ADRs, or usage examples still accurately describe
   the changed behavior? Don't require documentation where repository
   conventions clearly don't.

**Regression & compatibility** — explicitly consider whether the branch
changes behavior relied on by existing consumers (shared components,
exported APIs, public types, contracts, DB schemas, migrations,
configuration, env vars, reusable hooks/utilities). For migrations/
contracts, check whether the repo shows evidence of a safe compatibility/
upgrade strategy where applicable. Report only concrete, evidence-backed
risk.

**Testing philosophy** — findings focus on behavior, not test-file count.
A branch doesn't automatically fail review for lacking a new test file,
and adding tests doesn't automatically mean the behavior is adequately
covered. If the existing suite would catch a regression, say so. If no
test would catch an important changed behavior, that's a legitimate
finding.

**Every finding** gets validated per
[evidence-and-analysis.md](evidence-and-analysis.md) §04 before inclusion,
carries a Recommendation Strength and, where the underlying problem
matters, a Severity per
[documentation-framework.md](documentation-framework.md), and — for `MUST`/
`SHOULD` findings — a concrete failure scenario (what input/state triggers
it, what the code does, what goes wrong, what the user/system experiences;
never "this could cause problems").

Fill [templates/branch-review.md](../templates/branch-review.md):

- **Review Context** — branch, base, merge base, commit count, changed
  files, linked Initiative/ticket.
- **Executive Summary** — one paragraph.
- **Acceptance Criteria table** — from Step 5, if any were traced.
- **Findings** — `MUST` first, then `SHOULD`, then `COULD`; within a
  strength, most severe first. **No padding** — a category with nothing
  wrong gets no entry (never "No Security issues found" written just to
  look thorough), though every category above must still have actually
  been considered.
- **Review coverage** — a concise closing statement confirming all 9
  categories were considered (a checklist-style line, not fabricated "no
  issues" findings), and an explicit note if full coverage wasn't feasible
  given repo size or unavailable evidence.
- **Strengths (optional, ≤3)** — only when evidence-backed and materially
  useful to the reader (e.g. "preserves backward compatibility," "reuses
  an existing abstraction"). Not praise for completeness.

Write to `reviews/{{branch-slug}}-review.md` and print the complete report
inline.

This produces a report, not a fix, and not an approve/reject verdict. If
the user wants findings applied, that requires the same explicit-approval
step as any other implementation work (see `SKILL.md`'s Lifecycle
section).

### Final Validation Checklist — Review

- [ ] Repository state was checked; target branch was confirmed before
      review began; base branch was resolved, not assumed; merge base was
      recorded.
- [ ] Branch diff evidence was fully gathered (or the gap explicitly
      noted).
- [ ] Planning artifacts were traced where possible; scope and Acceptance
      Criteria were checked.
- [ ] All 9 review categories were considered, in order.
- [ ] Shared consumers and regression/compatibility risk were considered
      where relevant.
- [ ] Every finding has an exact `file:line`, a relevant snippet, an
      evidence-backed confidence tier, and a Recommendation Strength.
- [ ] `MUST`/`SHOULD` findings have concrete failure scenarios.
- [ ] Duplicate findings were merged, not repeated across categories.
- [ ] Findings are ordered by strength then severity.
- [ ] Weak/speculative findings were discarded, not downgraded-and-kept
      just to pad the report.
- [ ] No fix was implemented; no approve/reject decision was made; the
      branch was not modified.

---

## Read-Only Guarantee

Neither operation may modify implementation files, edit source code, stage
or commit changes, checkout another branch, reset files, rebase, merge, or
amend commits. The only permitted write is the generated onboarding/review
document itself. The branch under analysis stays untouched.

## Output Files

- Onboarding: `onboarding/{{branch-slug}}.md`
- Review: `reviews/{{branch-slug}}-review.md`

Always also print the complete generated document inline — the user must
not have to open the file to see the result.

## Behavioral Rules — Both Operations

Never:
- Guess the base branch, the target branch, or a ticket's purpose — resolve
  or ask, per Steps 1, 2, and 4 above.
- Invent run/test commands, acceptance criteria, security risks, or
  performance problems not supported by repository evidence.
- Mix uncommitted working-tree changes into branch evidence without the
  user explicitly asking for that.
- Modify, stage, commit, checkout, reset, rebase, merge, or amend anything
  on the branch under analysis.
- Approve or reject the branch — reporting findings is this skill's job;
  merge decisions belong to the user and their team's process.

The goal is the smallest set of high-confidence, actionable findings and
the clearest possible understanding of what the branch actually changes —
**evidence → clarity → confidence → actionability**, not finding count as
a proxy for thoroughness.
