# Release Notes

## 1.1.0

Adds two new reference capabilities to the Plan and Discover/branch-
operations phases; no breaking changes to the existing workflow, templates,
or commands.

### What's new

**Humanization pass** — a new editorial pass
(`references/humanization.md`) applied to generated prose after the
Writing Constitution and before a document is finalized. Removes
recognizable AI-writing patterns (fake contrasts, generic framing/
conclusions, inflated language, forced triads, excessive em dashes,
repetitive structure) at a per-artifact intervention level, while never
touching facts, technical terms, evidence markers, or Markdown/table/code
structure. Minimal-intervention by design — sentences that already read
naturally are left untouched.

**Evidence Index** — a disposable, commit-SHA-keyed cache
(`references/evidence-index.md`, stored at `evidence/index.json` in the
analyzed repository) so reconnaissance (Discover) and branch evidence
(Onboarding, Review, MR Generation) aren't re-gathered when the underlying
git state hasn't changed. Reuse requires an exact SHA match — any mismatch
is a full cache miss, and the index never overrides live git state or
caches findings/conclusions, only the underlying diff and reconnaissance
evidence.

### Validation

- `validation/validate.py --strict` — 0 errors, 0 warnings.
- `tests/test_behavior.py` — 37/37 passing, including 10 new tests
  covering both additions (existence, wiring into `SKILL.md` and the
  pipelines they extend, and their safety constraints).

---

## 1.0.0 — Draft

First stable release of **Code Pro Max** as a markdown-only Agent Skill and
Claude Code plugin.

Earlier `0.1.x` versions shipped an MCP server with TypeScript generators.
That runtime was removed during development in favour of a prompt-only
skill: the agent does the reading, grepping, and git work with its own
tools, and the skill supplies the discipline. `1.0.0` is the first release
of that design.

### What's in it

**Five-phase planning cycle** — Discover → Select → Plan → Validate →
Maintain, run by the agent against a real repository. Discover produces a
ranked Top 5 of evidence-backed opportunities and no code changes; Plan
produces the full documentation package; Validate checks it for coverage
and consistency; Maintain keeps `initiative-register.md` and the tickets in
sync and flags drift.

**Evidence-first discipline** — the Problem → Evidence → Impact →
Initiative → Cost → Recommendation chain, claims classified
FACT/INFERENCE/HYPOTHESIS/UNKNOWN, and explicit `[PLACEHOLDER]`,
`[UNKNOWN]`, `[ASSUMPTION]`, `[HYPOTHESIS]` markers so that missing
information is never quietly invented.

**Full planning chain with traceability** — Initiative → Epic → Tech Spec →
ADR → INVEST-validated tickets → Release Ticket → Stakeholder Report, with
templates for each and a Validate gate requiring every scope item to map to
at least one ticket and every ticket back to a scope item.

**Alternate entry point: Epic → Dev** — hand the skill an epic you already
wrote and it backfills a minimal Initiative for traceability, runs a scoped
evidence pass, and plans the rest of the package without a repo-wide
discovery run.

**Ticket → Build Prompt** — converts an existing ticket, plus its Tech Spec
and ADR context, into a self-contained build prompt in the AICraft schema.
It generates the prompt; it does not implement the ticket.

**Branch onboarding and branch review** — read-only operations against a
real git branch. Onboarding produces a "what changed and why" handoff doc;
review runs a 9-category, MUST/SHOULD/COULD, evidence-tagged code review.
Neither modifies code.

**Merge request generation** — produces a complete MR/PR description from a
ticket's implementation branch: summary, changes from the actual diff,
Acceptance Criteria mapped to evidence, out-of-scope, test plan,
risk/rollback, and checklist. It never creates a branch, commits, pushes,
or opens an MR/PR.

**Approval model** — discovering a problem never authorizes fixing it.
Implementation is a separate workflow requiring explicit user approval.

### Packaging

- Installable as an Agent Skill (`npx skills add …`), as a Claude Code
  plugin (`.claude-plugin/plugin.json` + `marketplace.json`), or by copying
  the markdown files for Cursor, Codex CLI, and Antigravity.
- `validation/validate.py` — stdlib-only packaging validation with a
  `--strict` mode: structure, both manifests, relative-link integrity,
  secret and local-path scanning, and cross-file name/version/license
  consistency.
- `tests/test_behavior.py` — deterministic `unittest` suite asserting the
  skill's documented invariants (evidence rules, placeholder conventions,
  planning chain, read-only and approval boundaries).
- CI runs validation, strict validation, the behavioral tests, and
  `claude plugin validate . --strict` on every push to `main` and every
  pull request.
- ISC licensed.

### Notes

- No telemetry, no network calls, and no code execution originate from the
  skill itself.
- This release is prepared for submission to the Claude Community
  Marketplace; submission and acceptance are separate steps and are not
  claimed here.
