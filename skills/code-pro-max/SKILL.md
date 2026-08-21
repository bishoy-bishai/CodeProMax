---
name: code-pro-max
description: "Use this skill to turn a codebase into prioritized, evidence-backed engineering Initiatives and drive them through planning to implementation-ready tickets. Triggers: 'analyze this repository', 'show me improvement opportunities', 'find technical initiatives worth doing', 'create the initiative for #3', 'expand <initiative name>', 'generate the implementation plan', 'review the initiative', 'check for drift', 'update the tickets based on the tech spec', 'regenerate the release ticket', 'implement initiative #2', 'I already have an epic, generate the tech spec and tickets from it', 'epic-to-dev', 'turn this ticket into a build prompt', 'ticket-to-prompt', 'onboard me on this branch', 'review this branch'. The agent itself reads files, greps, and runs git/test/dependency commands using its normal tools, classifies evidence, runs 5-Whys root cause analysis, scores initiatives, and writes/maintains a living initiative-register.md plus per-initiative planning documents (initiative, epic, tech spec, ADR, tickets, release ticket, stakeholder report). No fabricated claims — missing information is always [PLACEHOLDER], [UNKNOWN], [ASSUMPTION], or [HYPOTHESIS]."
disable-model-invocation: false
---

# Engineering Improvement Initiative Skill

## Vision

**From Codebase → Engineering Initiatives → Executable Work.**
Find what's worth improving. Then turn it into work.

This skill analyzes an existing repository, identifies high-value engineering
improvement opportunities, helps the user choose one, and turns the selected
initiative into a complete set of implementation-ready engineering artifacts.

Every step here is something you (the agent) do with your own file-read,
search, and shell tools (`git log`, running tests, reading manifests).

## Core Principle — Evidence Before Initiative

Never recommend a generic improvement without evidence from the repository.

**Don't:** "Improve performance."
**Do:** "`DashboardPage.tsx` renders 47 child components on every filter
change and triggers 6 API requests for a single interaction
(`src/pages/DashboardPage.tsx:112-140`)."

Reasoning chain: **Problem → Evidence → Impact → Initiative → Cost →
Recommendation.**

Every important statement is classified as one of:
- **FACT** — directly observed in the repo or supplied context.
- **INFERENCE** — a conclusion supported by multiple independent observations.
- **HYPOTHESIS** — plausible but unverified.
- **UNKNOWN** — cannot be established from available evidence.

Unknowns required for planning become explicit `[PLACEHOLDER]` items — never
silently converted into assumptions. See
[references/evidence-and-analysis.md](references/evidence-and-analysis.md)
for the full reconnaissance → evidence → root-cause protocol.

---

## Phase 1 — Discover

Enter the repository and build a mental model before recommending anything:
architecture, tech stack, folder structure, dependencies, testing strategy,
CI/CD, observability, performance, security, developer experience, code
quality, maintainability, technical debt, documentation, scalability.

Follow the reconnaissance pipeline in
[references/evidence-and-analysis.md](references/evidence-and-analysis.md)
(§01 Reconnaissance) — repository identification, structural mapping, entry
points, architecture discovery, data-flow tracing, dependency mapping,
quality/CI/CD/observability/documentation discovery. **Understand before
judging** — do not change code in this phase.

Evaluate opportunities across: Architecture, Code Quality, Maintainability,
Testing, Performance, Security, Observability, Developer Experience,
Dependencies, CI/CD, Documentation, Scalability.

### Output: Top 5 Opportunities

Each recommendation states: **Initiative, Problem, Evidence, Value, Effort,
Risk.** Rank using Impact + Confidence + Urgency + Developer Pain relative to
Effort + Risk — see
[references/prioritization.md](references/prioritization.md) for the full
scoring model, priority tiers, and decision-trace format.

### Initiative Contract

Every initiative must contain: Problem, Evidence, Why It Matters, Expected
Outcome, Scope, Out of Scope, Estimated Effort, Risk, Dependencies, Success
Metrics, Assumptions, Open Questions. Missing information is
`[PLACEHOLDER]` — never invented.

### Repository Structure

Maintain `initiative-register.md` at the repo root (or wherever the user's
planning docs live) as the central index and living engineering backlog.
Template: [templates/initiative-register.md](templates/initiative-register.md).
Structure and lifecycle rules:
[references/initiative-lifecycle.md](references/initiative-lifecycle.md).

During discovery, create **only** the canonical `initiative.md` for each
candidate (via [templates/initiative.md](templates/initiative.md)) — do not
generate the full documentation package until the user selects one.

---

## Phase 2 — Select

The user selects an initiative by number or name — "Create the initiative
for #3", "Expand Improve Observability", "Work on initiative 2". The
selected initiative becomes the source of truth for planning. Before
creating a new one, check for duplicates against the register (same problem,
root cause, or outcome) — see
[references/initiative-lifecycle.md](references/initiative-lifecycle.md).

---

## Alternate Entry Point — Epic → Dev

Use this when a developer already has a written Epic (their own, not
generated by this skill) and wants to skip straight to the rest of the
planning package — no repository-wide Discover pass, no ranking. Triggered
by supplying epic content directly, e.g.
`/code-pro-max epic-to-dev {{epic content}}`.

1. **Parse the supplied epic** — extract name, summary, business value,
   technical value, scope/goals, non-goals, acceptance criteria,
   dependencies, and Definition of Done as given. Do not second-guess the
   epic's scope decisions; they're the developer's input, not something
   this skill re-derives.
2. **Backfill a minimal Initiative record**
   ([templates/initiative.md](templates/initiative.md)) from the epic so
   downstream documents have a single source of truth to trace to. Because
   this Initiative wasn't produced by the normal evidence pipeline, mark
   its Problem/Why-It-Matters content `[ASSUMPTION: derived from supplied
   epic, not independently gathered evidence]` unless you also do step 3.
3. **Run a scoped evidence pass** (recommended, not optional if the repo is
   accessible) — apply
   [references/evidence-and-analysis.md](references/evidence-and-analysis.md)
   §01/§02, limited to the files/areas the epic's Goals reference, so the
   Tech Spec's Current State and the tickets' Technical Details aren't
   entirely `[PLACEHOLDER]`. This does not turn into a full repository
   Discover pass — stay scoped to what the epic touches.
4. **Continue from Phase 3, step 3 onward** (Tech Spec → ADR → Tickets →
   Release Ticket → Stakeholder Report), using the supplied Epic as-is
   (copy it into `epic.md` unchanged, or lightly reformat to match
   [templates/epic.md](templates/epic.md) without changing its content).
5. **Register it** — add an entry to `initiative-register.md` with Status
   `Planned` (the epic already represents an implicit Select decision) and
   note in the Change Log that it originated from a supplied epic rather
   than Discover.
6. Run the normal Phase 4 Validate pass before considering the package
   done.

---

## Phase 3 — Plan

For the selected initiative, generate the full documentation package. Use
the templates in [templates/](templates/) and the per-document audience/
purpose rules in
[references/documentation-framework.md](references/documentation-framework.md).
Generate in this order — **never jump to tickets before the design
direction is understood** (Problem → Design → Implementation):

1. **Initiative** ([templates/initiative.md](templates/initiative.md)) —
   high-level engineering + business case: problem, evidence, value, scope,
   cost, risk, outcomes, success metrics.
2. **Epic** ([templates/epic.md](templates/epic.md)) — Jira/Confluence-
   oriented: summary, business value, technical value, scope, acceptance
   criteria, dependencies, Definition of Done.
3. **Tech Spec** ([templates/tech-spec.md](templates/tech-spec.md)) —
   detailed engineering design. Quality bar and full anatomy:
   [references/tech-spec-standard.md](references/tech-spec-standard.md).
4. **ADR** ([templates/adr.md](templates/adr.md)) — Architecture Decision
   Record for any architecturally significant or likely-to-be-revisited
   choice: alternatives, rationale, trade-offs, consequences.
5. **Tickets** (`tickets/` directory, from
   [templates/ticket.md](templates/ticket.md)) — **generate the full list,
   not a single example.** Enumerate one ticket per Scope item on the
   Initiative (sliced per
   [references/story-decomposition.md](references/story-decomposition.md)
   when a scope item is really several vertical slices), as separate files
   `tickets/{{slug}}-001.md`, `tickets/{{slug}}-002.md`, etc. — every scope
   item must map to at least one ticket, and every ticket must map back to
   a scope item. Each ticket is validated against the INVEST gate
   ([references/invest.md](references/invest.md)) before being marked
   implementation-ready. This step is not optional and does not collapse
   into the Release Ticket — the Release Ticket is a rollout plan for the
   tickets, not a substitute for them.
6. **Release Ticket** ([templates/release-ticket.md](templates/release-ticket.md))
   — release objective, changes included (linking every ticket file
   generated in step 5), pre-release checklist, rollout plan, rollback
   plan, post-release validation, success metrics.
7. **Stakeholder / Product Owner Report**
   ([templates/stakeholder-report.md](templates/stakeholder-report.md)) —
   translate the technical change into business language: what changed, why
   it matters, expected impact, user/customer impact, operational impact,
   risks, rollout status, success metrics.

Missing information at any step is `[PLACEHOLDER]`, never invented.

---

## Utility — Ticket → Build Prompt

Once a ticket exists, convert it into a self-contained build prompt with
`/code-pro-max ticket-to-prompt <ticket-id>`. This does not implement
anything — it produces the prompt a coding agent (this one, another
session, or another tool) would use to actually build the ticket,
formatted to the AICraft prompt schema
(https://github.com/bishoy-bishai/AICraft/tree/main/skill): CONTEXT, GOAL,
CONSTRAINTS, INPUTS, EXPECTED OUTPUT, ACCEPTANCE CRITERIA, DEFINITION OF
DONE. Full field-mapping rules and the AICraft-awareness convention:
[references/ticket-to-prompt.md](references/ticket-to-prompt.md). Template:
[templates/ticket-prompt.md](templates/ticket-prompt.md).

---

## Utility — Branch Onboarding & Review

Two read-only operations against an actual git branch (not a planning
document) — full mechanics in
[references/branch-operations.md](references/branch-operations.md):

Both start from the same evidence-gathering pipeline (repo state → resolve
base branch → confirm the target branch is a real ref → gather the diff →
trace it to a ticket/Initiative → check scope/intent alignment → inspect
shared-component consumers) before producing anything.

- **`/code-pro-max onboarding <branch>`** — produces a handoff document
  for someone unfamiliar with the branch's change: what changed and why,
  before/after behavior, a short how-it-works model, ranked key files,
  how to run/test it locally, and Acceptance Criteria mapped to evidence
  when a ticket/Initiative was traced. Template:
  [templates/onboarding.md](templates/onboarding.md).
- **`/code-pro-max review <branch>`** — an evidence-based code review of
  the branch's diff against its base, in a fixed 9-category order (Scope
  & Intent Alignment → Architecture → Domain → Correctness → Security →
  Performance → Readability → Testing → Documentation), each finding
  validated per
  [references/evidence-and-analysis.md](references/evidence-and-analysis.md)
  §04 and tagged `MUST`/`SHOULD`/`COULD` per
  [references/documentation-framework.md](references/documentation-framework.md).
  Template: [templates/branch-review.md](templates/branch-review.md). This
  is distinct from bare `/code-pro-max review` (no branch argument), which
  runs the Phase 4 planning-package consistency check instead — resolve
  `<branch>` against real git refs first; if it doesn't exist, that's a
  branch-review request that failed, not a signal to fall back to Phase 4.

Neither operation modifies code, and neither is a substitute for the
explicit-approval step required before implementing any fix they surface.

---

## Phase 4 — Validate

Before considering an initiative complete, run a consistency review:

- Initiative aligns with Tech Spec.
- Epic covers the Initiative.
- Tech Spec has implementation coverage in tickets.
- **Every Initiative Scope item has at least one ticket in `tickets/`, and
  every ticket maps back to a Scope item.** A package with a Release Ticket
  but zero or one ticket file for a multi-item scope is incomplete — go
  back to Phase 3 step 5, not forward.
- Tickets have clear, testable acceptance criteria and pass INVEST.
- Release ticket covers the planned changes.
- Stakeholder report reflects actual scope.
- Assumptions are clearly identified.
- No unsupported or invented information exists anywhere in the package.

Report gaps explicitly, e.g. "⚠️ Tech spec changed but 3 Jira tickets are no
longer aligned." Full gates for each artifact type are in
[references/documentation-framework.md](references/documentation-framework.md)
and [references/tech-spec-standard.md](references/tech-spec-standard.md).

---

## Phase 5 — Maintain

An initiative is a living planning artifact, not a one-time document dump.
Support:

- **Review the initiative** — validate completeness and quality (Phase 4
  gate).
- **Update the tickets based on the tech spec** — synchronize implementation
  work with the latest technical design.
- **Review initiative drift** — detect when artifacts no longer agree with
  each other or with the evidence that justified them (evidence resolved,
  usage changed, cost/risk changed, new constraints appeared). Report as
  "⚠️ Initiative assumptions may no longer be valid. Reassessment
  recommended." Full drift model:
  [references/prioritization.md](references/prioritization.md)
  (Initiative Drift & Reassessment).

Keep `initiative-register.md` synchronized whenever an initiative is
created, selected, changes priority/status/score/scope, is completed, or is
rejected. Never silently rewrite decision history — record what changed and
why.

---

## Lifecycle

```
DISCOVER → PLAN → APPROVE → IMPLEMENT → VALIDATE → RELEASE
```

**Never implement an initiative merely because it was discovered — approval
stays explicit.** "Implement initiative #2" should trigger an explicit
implementation workflow, not silent code changes.

---

## Example Commands / Intents

| Phase | Example phrasing |
|---|---|
| Discovery | "Analyze this repository", "Show me improvement opportunities", "Find technical initiatives worth doing" |
| Planning | "Create the initiative for #3", "Expand Improve Observability", "Generate the implementation plan" |
| Epic → Dev | `/code-pro-max epic-to-dev {{epic content}}` — skip Discover/Select, plan the rest from a developer-supplied epic |
| Ticket → Prompt | `/code-pro-max ticket-to-prompt <ticket-id>` — convert an existing ticket into a self-contained, AICraft-schema build prompt |
| Branch Onboarding | `/code-pro-max onboarding <branch>` — generate an onboarding doc for a branch's change |
| Branch Review | `/code-pro-max review <branch>` — evidence-based code review of a branch's diff |
| Validation | "Review the initiative", "Check for drift", "Are the tickets aligned with the tech spec?" |
| Synchronization | "Update the tickets based on the tech spec", "Update the stakeholder report", "Regenerate the release ticket" |
| Future execution | "Implement initiative #2" (must trigger explicit approval, never silent implementation) |

---

## Differentiator

Not just a generic code reviewer, and not merely a Markdown generator.
Branch review and onboarding are utilities in service of the same
evidence-first discipline — the core purpose is to turn
technical debt and engineering observations into prioritized, evidence-
backed, executable engineering initiatives — combining evidence-based
discovery, prioritization, structured planning, implementation-ready
tickets, release planning, stakeholder communication, and consistency/drift
detection.

---

## Reference Index

| File | Covers |
|---|---|
| [references/evidence-and-analysis.md](references/evidence-and-analysis.md) | Reconnaissance protocol, evidence types/tiers, triangulation, root cause analysis (5 Whys), observability evidence model |
| [references/prioritization.md](references/prioritization.md) | Opportunity scoring, signals, priority tiers, decision trace, reason codes, drift & reassessment |
| [references/invest.md](references/invest.md) | INVEST quality gate for tickets/stories, validation output, dependency handling, estimation rules |
| [references/story-decomposition.md](references/story-decomposition.md) | Epic → story decomposition, vertical slicing |
| [references/tech-spec-standard.md](references/tech-spec-standard.md) | Tech Spec quality criteria, full anatomy, review gate |
| [references/initiative-lifecycle.md](references/initiative-lifecycle.md) | Initiative identity/naming/folders, register, traceability, duplicate detection, quality gate, selection flow |
| [references/documentation-framework.md](references/documentation-framework.md) | Per-document audience/purpose/structure, writing constitution, diagramming standard, reference hierarchy |
| [references/ticket-to-prompt.md](references/ticket-to-prompt.md) | Field mapping and rules for converting a ticket into an AICraft-schema build prompt |
| [references/branch-operations.md](references/branch-operations.md) | Branch evidence gathering, onboarding doc generation, and the 8-category evidence-based branch review |

These are mental models and reference structure, not rigid checklists. **The
repository's actual evidence and conventions always take precedence.**
