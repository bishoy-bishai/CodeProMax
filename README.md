# Code Pro Max

**From Codebase → Engineering Initiatives → Executable Work.**
Find what's worth improving. Then turn it into work.

Code Pro Max is a skill for coding agents (Claude Code, Cursor, Codex CLI,
Antigravity, or similar) that turns "the codebase feels risky" into a
ranked, evidence-backed list of specific problems — each with a scored
priority, a traced root cause, and a ready-to-build implementation plan.

> **Using an AI coding agent?** Paste this into it:
> ```
> Install the Code Pro Max skill (https://github.com/bishoy-bishai/CodeProMax) into this project.
> ```
> Any agent with shell access can do this unassisted — see
> [For AI Agents](#for-ai-agents) below.

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
Release Ticket → Stakeholder Report) and Validate. See
`/code-pro-max epic-to-dev` below.

**Approval stays explicit.** The skill never implements an initiative
merely because it discovered one — "implement initiative #2" triggers an
explicit implementation workflow, not silent code changes.

Full detail: [skills/code-pro-max/SKILL.md](skills/code-pro-max/SKILL.md).

---

## Commands

Once installed (see [Install](#install) below), each client gets one slash
command, `/code-pro-max`, which reads its argument to decide which phase to
run. It also auto-triggers from natural language, even without typing the
command — the table below is for the explicit form.

| Command | What it does |
|---|---|
| `/code-pro-max` | Runs **Discover**: scans the current repository and presents a ranked Top 5 opportunities. Generates no documents yet. |
| `/code-pro-max <path>` | Same as above, scoped to one path (e.g. `/code-pro-max src/api`) instead of the whole repo. |
| `/code-pro-max select <n or name>` | Runs **Select**: picks an initiative from the last Discover pass (or by name) as the planning target, checking the register for duplicates first. |
| `/code-pro-max "<initiative name>" --build` | Runs **Plan** end to end for that initiative: Initiative brief, Epic, Tech Spec, ADR, tickets, Release Ticket, Stakeholder Report. |
| `/code-pro-max review` or `/code-pro-max "check drift"` | Runs **Validate**/**Maintain**: a consistency check across the existing package, or a drift check against the register. |
| `/code-pro-max "update tickets"` / `"update stakeholder report"` / `"regenerate release ticket"` | Runs **Maintain**: resynchronizes one artifact against the current Tech Spec/Initiative. |
| `/code-pro-max epic-to-dev {{epic content}}` | The alternate entry point: skips Discover/Select and plans the rest of the package (Tech Spec → ADR → Tickets → Release Ticket → Stakeholder Report) from an epic you already wrote. Accepts pasted content or a file path. |

---

## For AI Agents

If a user asks you to install this skill — by pasting this repo's URL, or
saying something like "install Code Pro Max" — do the following yourself,
without asking the user to run anything manually:

1. **Identify which client you are.** You already know this — you're
   running as Claude Code, Cursor, Codex CLI, or Antigravity right now.
2. **Clone the repo** (skip if it's already cloned somewhere and the user
   tells you where): `git clone https://github.com/bishoy-bishai/CodeProMax.git`
   to a temp or tools directory.
3. **Run the one-liner for your client** from the [Install](#install)
   section below, substituting `$CPM` with the path you cloned into, from
   the root of whatever project the user wants the skill installed into
   (ask if it isn't clear from context — don't assume the clone directory
   itself is the target).
4. **Confirm what you did**: which files landed where, and how to invoke
   the skill (`/code-pro-max`, or just describing what you want in plain
   language).

Don't fabricate a different install mechanism — the commands below are the
only supported path. If your client isn't one of the four listed, look at
the Cursor/Codex sections in
[skills/code-pro-max/README.md](skills/code-pro-max/README.md) as
reference points and adapt: copy `SKILL.md` + `references/` + `templates/`
into wherever your client reads rules/instructions from, and copy the
matching command file into wherever it reads slash commands from, if it has
that concept.

---

## Install

The skill lives in [`skills/code-pro-max/`](skills/code-pro-max/) in *this*
repo — you install it *into whatever project you want the skill available
in*, which is normally a different directory. Two steps:

**1. Clone this repo once**, anywhere convenient (it's just the source of
the skill files, not something you work in day to day):

```bash
git clone https://github.com/bishoy-bishai/CodeProMax.git ~/tools/CodeProMax
```

**2. From your target project's root**, run the command for your client.
Every command below installs both the skill and the explicit
`/code-pro-max` command in one step. Set `CPM` once per shell to wherever
you cloned it:

```bash
CPM=~/tools/CodeProMax
```

**Claude Code** (project-scoped — installs into the current project only):

```bash
mkdir -p .claude/skills .claude/commands && cp -r "$CPM/skills/code-pro-max" .claude/skills/code-pro-max && cp "$CPM/skills/code-pro-max/commands/code-pro-max.md" .claude/commands/
```

<details>
<summary>User-scoped instead (all projects, run from anywhere)</summary>

```bash
mkdir -p ~/.claude/skills ~/.claude/commands && cp -r "$CPM/skills/code-pro-max" ~/.claude/skills/code-pro-max && cp "$CPM/skills/code-pro-max/commands/code-pro-max.md" ~/.claude/commands/
```
</details>

**Cursor:**

```bash
mkdir -p .cursor/rules/code-pro-max .cursor/commands && cp "$CPM/skills/code-pro-max/cursor-rule/code-pro-max.mdc" .cursor/rules/ && cp -r "$CPM/skills/code-pro-max/SKILL.md" "$CPM/skills/code-pro-max/references" "$CPM/skills/code-pro-max/templates" .cursor/rules/code-pro-max/ && cp "$CPM/skills/code-pro-max/cursor-rule/commands/code-pro-max.md" .cursor/commands/
```

**Codex CLI:**

```bash
mkdir -p ~/.codex/prompts && cp "$CPM/skills/code-pro-max/codex-prompt/code-pro-max.md" ~/.codex/prompts/ && printf '\n## Engineering Improvement Initiative skill\n\nWhen asked to find engineering initiatives, audit tech debt, select/plan/validate/maintain an initiative, plan from an already-written epic, or generate an initiative/epic/tech-spec/ADR/tickets/release-ticket/stakeholder-report, follow the instructions in `%s/skills/code-pro-max/SKILL.md`, its `%s/skills/code-pro-max/references/` directory, and the templates in `%s/skills/code-pro-max/templates/`.\n' "$CPM" "$CPM" "$CPM" >> AGENTS.md
```

**Antigravity:** rule/instruction file paths vary by release — copy
`$CPM/skills/code-pro-max/cursor-rule/code-pro-max.mdc`'s content into
whatever rule file your version uses, alongside `SKILL.md`, `references/`,
and `templates/` from the same `skills/code-pro-max/` directory.

Full breakdown of what each command does, plus how to adjust paths:
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
