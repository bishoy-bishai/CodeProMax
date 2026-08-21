# Code Pro Max

**From Codebase → Engineering Initiatives → Executable Work.**
Find what's worth improving. Then turn it into work.

Code Pro Max is a skill for coding agents (Claude Code, Cursor, Codex CLI,
Antigravity, or similar) that turns "the codebase feels risky" into a
ranked, evidence-backed list of specific problems — each with a scored
priority, a traced root cause, and a ready-to-build implementation plan.

---

## Core Principle — Evidence Before Initiative

The agent must never recommend a generic improvement without evidence from
the repository.

**Don't:** "Improve performance."
**Do:** "`DashboardPage.tsx` renders 47 child components on every filter
change and triggers 6 API requests for a single interaction
(`src/pages/DashboardPage.tsx:112-140`)."

Reasoning chain: **Problem → Evidence → Impact → Initiative → Cost →
Recommendation.** Every claim is classified `FACT`, `INFERENCE`,
`HYPOTHESIS`, or `UNKNOWN` — and anything required for planning that can't
be established from evidence becomes an explicit `[PLACEHOLDER]`, never a
guess.

---

## The Planning Cycle

```
 Discover ──▶ Select ──▶ Plan ──▶ Validate ──▶ Maintain
    │                      ▲                      │
    │                      │                      │
    └──────── (loops back when drift is found) ────┘

                     ▲
                     │  (skip straight in with a ready epic)
              "I already have an epic"
```

Five phases, run by the agent against your repository:

1. **Discover** — reconnaissance across architecture, code quality,
   testing, performance, security, observability, developer experience,
   dependencies, CI/CD, documentation, and scalability. Produces a ranked
   Top 5 opportunities, each with Problem / Evidence / Value / Effort /
   Risk — not code changes. Nothing is written to disk yet except each
   candidate's own `initiative.md`.
2. **Select** — the user picks an initiative by number or name (or names
   one directly instead of running Discover at all); it becomes the source
   of truth for planning, and the agent checks the register for duplicates
   before proceeding.
3. **Plan** — generates the full documentation package for the selected
   initiative, in order (never tickets before the design is settled):
   Initiative brief → Epic → Tech Spec → ADR → INVEST-validated
   implementation tickets → Release Ticket → Stakeholder Report. All seven
   documents trace back to the same Initiative, so they can't drift from
   each other or invent a different problem/scope on their own.
4. **Validate** — a consistency review before considering the package
   complete: does the Epic cover the Initiative, does the Tech Spec have
   ticket coverage, do the tickets pass the INVEST gate, does the Release
   Ticket match what's actually planned, is every assumption explicitly
   marked. Reports gaps directly, e.g. "⚠️ Tech spec changed but 3 tickets
   are no longer aligned."
5. **Maintain** — keeps `initiative-register.md` in sync as initiatives are
   created, selected, or change status/priority/score/scope; resynchronizes
   tickets when the tech spec changes; and flags initiative drift when the
   evidence that justified a decision no longer holds — feeding back into
   Validate or a fresh Plan pass as needed.

**Alternate entry point — already have an epic?** Skip Discover and Select
entirely: give the agent a written epic and it backfills a minimal
Initiative for traceability, runs a scoped evidence pass limited to what
the epic touches, and goes straight into Plan (Tech Spec → ADR → Tickets →
Release Ticket → Stakeholder Report) and Validate. See the `/epic-to-dev`
command below.

**Approval stays explicit.** The skill never implements an initiative
merely because it discovered one — "implement initiative #2" triggers an
explicit implementation workflow, not silent code changes.

Full detail: [skills/code-pro-max/SKILL.md](skills/code-pro-max/SKILL.md).

---

## Commands

Once installed (see [Install](#install) below), each client gets two slash
commands. Both also auto-trigger from natural language, even without
typing the command — the table below is for the explicit form.

| Command | What it does |
|---|---|
| `/code-pro-max` | Runs **Discover**: scans the current repository and presents a ranked Top 5 opportunities. Generates no documents yet. |
| `/code-pro-max <path>` | Same as above, scoped to one path (e.g. `/code-pro-max src/api`) instead of the whole repo. |
| `/code-pro-max select <n or name>` | Runs **Select**: picks an initiative from the last Discover pass (or by name) as the planning target, checking the register for duplicates first. |
| `/code-pro-max "<initiative name>" --build` | Runs **Plan** end to end for that initiative: Initiative brief, Epic, Tech Spec, ADR, tickets, Release Ticket, Stakeholder Report. |
| `/code-pro-max review` or `/code-pro-max "check drift"` | Runs **Validate**/**Maintain**: a consistency check across the existing package, or a drift check against the register. |
| `/code-pro-max "update tickets"` / `"update stakeholder report"` / `"regenerate release ticket"` | Runs **Maintain**: resynchronizes one artifact against the current Tech Spec/Initiative. |
| `/epic-to-dev {{epic content}}` | The alternate entry point: skips Discover/Select and plans the rest of the package (Tech Spec → ADR → Tickets → Release Ticket → Stakeholder Report) from an epic you already wrote. Accepts pasted content or a file path. |

---

## Install

The skill lives in [`skills/code-pro-max/`](skills/code-pro-max/). Install
it into Claude Code, Cursor, Codex CLI, or Antigravity by copying it into
that client's skills/rules/commands folder — full per-client steps
(including both slash commands above) are in
[skills/code-pro-max/README.md](skills/code-pro-max/README.md).

---

## Differentiator

Not a generic code reviewer, not merely a Markdown generator. Purpose: turn
technical debt and engineering observations into prioritized, evidence-
backed, executable engineering initiatives — combining evidence-based
discovery, prioritization, structured planning, implementation-ready
tickets, release planning, stakeholder communication, and consistency/drift
detection.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[LICENSE](LICENSE)
