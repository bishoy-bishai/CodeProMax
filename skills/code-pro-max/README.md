# Engineering Improvement Initiative Skill

Rules and roles for a coding agent to follow. It takes a repository through
five phases — **Discover → Select → Plan → Validate → Maintain** — turning
technical debt into prioritized, evidence-backed engineering Initiatives,
then driving a selected Initiative through a full planning package
(Initiative brief, Epic, Tech Spec, ADR, INVEST-validated tickets, Release
Ticket, Stakeholder Report), kept consistent over time via a living
`initiative-register.md` and drift checks. The agent performs every step
itself with its own file-read/grep/`git` tools.

- [`SKILL.md`](SKILL.md) — the phase-by-phase orchestrator (the canonical
  source; every client-specific file below just points an agent at this
  file).
- [`references/`](references/) — the detailed rules each phase draws on:
  - [`evidence-and-analysis.md`](references/evidence-and-analysis.md) —
    reconnaissance protocol, evidence tiers, root cause analysis (5 Whys),
    observability evidence model.
  - [`prioritization.md`](references/prioritization.md) — opportunity
    scoring, priority tiers, decision trace, drift & reassessment.
  - [`invest.md`](references/invest.md) /
    [`story-decomposition.md`](references/story-decomposition.md) — the
    INVEST gate and vertical-slicing rules for tickets.
  - [`tech-spec-standard.md`](references/tech-spec-standard.md) — Tech Spec
    quality bar, anatomy, and review gate.
  - [`initiative-lifecycle.md`](references/initiative-lifecycle.md) —
    Initiative identity, folder structure, register, duplicate detection,
    quality gate, selection flow.
  - [`documentation-framework.md`](references/documentation-framework.md) —
    per-document audience/purpose/structure and the writing constitution.
- [`templates/`](templates/) — `initiative.md`, `epic.md`, `tech-spec.md`,
  `adr.md`, `ticket.md`, `release-ticket.md`, `stakeholder-report.md`, and
  `initiative-register.md`.
- [`commands/code-pro-max.md`](commands/code-pro-max.md) — the `/code-pro-max`
  slash command for Claude Code (manual invocation, in addition to
  auto-trigger via `SKILL.md`'s description).
- [`commands/epic-to-dev.md`](commands/epic-to-dev.md) — the
  `/epic-to-dev {{epic content}}` slash command for Claude Code: skip
  Discover/Select and plan the rest of the package from an
  already-written epic.
- [`cursor-rule/code-pro-max.mdc`](cursor-rule/code-pro-max.mdc) — Cursor rule
  (auto-applies based on `description` match).
- [`cursor-rule/commands/code-pro-max.md`](cursor-rule/commands/code-pro-max.md)
  — Cursor's `/code-pro-max` manual command.
- [`cursor-rule/commands/epic-to-dev.md`](cursor-rule/commands/epic-to-dev.md)
  — Cursor's `/epic-to-dev` manual command.
- [`codex-prompt/code-pro-max.md`](codex-prompt/code-pro-max.md) — Codex CLI
  custom prompt, invoked as `/code-pro-max` once placed in `~/.codex/prompts/`.
- [`codex-prompt/epic-to-dev.md`](codex-prompt/epic-to-dev.md) — Codex CLI
  custom prompt, invoked as `/epic-to-dev` once placed in
  `~/.codex/prompts/`.

---

## Install

### Claude Code

Copy (or symlink) this directory into your skills folder:

```bash
# Project-scoped (this repo only)
cp -r skills/code-pro-max /path/to/your-project/.claude/skills/code-pro-max

# User-scoped (all projects)
cp -r skills/code-pro-max ~/.claude/skills/code-pro-max
```

Claude Code discovers `SKILL.md` files under `.claude/skills/*/` (project) or
`~/.claude/skills/*/` (user) automatically — no registration command needed.
It auto-triggers when you ask things like "find initiatives in this repo."

For an explicit `/code-pro-max` slash command (rather than relying on
auto-trigger), also copy the command file into your commands folder:

```bash
mkdir -p /path/to/your-project/.claude/commands
cp skills/code-pro-max/commands/code-pro-max.md skills/code-pro-max/commands/epic-to-dev.md /path/to/your-project/.claude/commands/
# or, user-scoped:
mkdir -p ~/.claude/commands && cp skills/code-pro-max/commands/code-pro-max.md skills/code-pro-max/commands/epic-to-dev.md ~/.claude/commands/
```

Usage: `/code-pro-max` (full scan), `/code-pro-max src/api` (scoped scan),
`/code-pro-max "checkout latency" --build` (build out one initiative's
docs), or `/epic-to-dev {{epic content}}` (already have an epic — skip
straight to tech spec, ADR, tickets, release ticket, and stakeholder
report).

### Cursor

Copy the rule file into your rules folder:

```bash
# Project-scoped
mkdir -p /path/to/your-project/.cursor/rules
cp skills/code-pro-max/cursor-rule/code-pro-max.mdc /path/to/your-project/.cursor/rules/

# Also copy the instructions, references, and templates it points to
cp -r skills/code-pro-max/SKILL.md skills/code-pro-max/references skills/code-pro-max/templates /path/to/your-project/.cursor/rules/code-pro-max/
```

Adjust the relative path inside `code-pro-max.mdc` if you place `SKILL.md`
somewhere other than `skills/code-pro-max/` in the target project. Cursor
applies rules whose `description` matches the request, or always if
`alwaysApply: true`.

For an explicit manual command, also copy the command file:

```bash
mkdir -p /path/to/your-project/.cursor/commands
cp skills/code-pro-max/cursor-rule/commands/code-pro-max.md skills/code-pro-max/cursor-rule/commands/epic-to-dev.md /path/to/your-project/.cursor/commands/
```

Invoke with `/code-pro-max` or `/epic-to-dev {{epic content}}` in Cursor's
chat.

### Codex CLI

Codex reads `AGENTS.md` (repo root or `~/.codex/AGENTS.md` for a global
default). Append a pointer section:

```bash
cat >> AGENTS.md <<'EOF'

## Engineering Improvement Initiative skill

When asked to find engineering initiatives, audit tech debt, select/plan/
validate/maintain an initiative, plan the rest of the package from an
already-written epic, or generate an initiative/epic/tech-spec/ADR/tickets/
release-ticket/stakeholder-report, follow the instructions in
`skills/code-pro-max/SKILL.md`, its `skills/code-pro-max/references/`
directory, and the templates in `skills/code-pro-max/templates/`.
EOF
```

Or copy the whole `skills/code-pro-max/` directory into the target repo
first if `AGENTS.md` needs to live somewhere without direct access to it.

For an explicit reusable command, copy the prompt file into Codex's custom
prompts folder:

```bash
mkdir -p ~/.codex/prompts
cp skills/code-pro-max/codex-prompt/code-pro-max.md skills/code-pro-max/codex-prompt/epic-to-dev.md ~/.codex/prompts/
```

Invoke with `/code-pro-max` or `/epic-to-dev {{epic content}}` in a Codex
CLI session.

### Antigravity

Antigravity's rule/instruction mechanism varies by release — consult your
version's docs for the exact file path (as of this writing it follows a
similar per-project rules-file convention to Cursor). Whatever the file, add
a pointer identical in spirit to the Cursor rule above: load and follow
`skills/code-pro-max/SKILL.md` and its `references/` directory, and use
`skills/code-pro-max/templates/` for document generation.

---

## No Fabrication

Every claim in every generated document traces back to real evidence
(code, git history, test results, dependency manifests) gathered by the
agent, or is explicitly marked `[ASSUMPTION]`, `[UNKNOWN]`,
`[PLACEHOLDER]`, or `[HYPOTHESIS]`. Nothing is invented to make output
look more complete than the evidence supports.
