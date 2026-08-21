---
description: Discover, select, plan, validate, or maintain engineering initiatives
argument-hint: [scan-path | "select <n or name>" | "<initiative name> --build" | "review" | "check drift" | "epic-to-dev {{epic content}}" | "ticket-to-prompt <ticket-id>" | "onboarding <branch>" | "review <branch>"]
disable-model-invocation: false
---

Load and follow the full instructions in [`../SKILL.md`](../SKILL.md) — the
Engineering Improvement Initiative Skill (Discover → Select → Plan →
Validate → Maintain) — and its `references/` and `templates/` directories
for the detailed rules and document structures each phase uses.

Arguments: $ARGUMENTS

- **No argument** — Phase 1 (Discover): scan the current repository and
  present a ranked Top 5 opportunities. Do not generate any documents yet.
- **A path** — scope the Phase 1 scan to that path.
- **"select <number or name>"**, or a bare initiative name/number — Phase 2:
  select that initiative as the planning target, checking the register for
  duplicates first.
- **"<initiative name> --build"** — skip to Phase 3: generate the full
  documentation package (initiative, epic, tech spec, ADR, tickets, release
  ticket, stakeholder report) for that initiative.
- **"review"** or **"check drift"** — Phase 4/5: run the consistency review
  or drift check against the existing package and register.
- **"update tickets"**, **"update stakeholder report"**, **"regenerate
  release ticket"** — Phase 5: resynchronize the named artifact against the
  current tech spec / initiative.
- **"epic-to-dev {{epic content}}"** — the alternate entry point in
  `SKILL.md`'s "Alternate Entry Point — Epic → Dev" section: skip
  Discover/Select and plan the rest of the package (tech spec, ADR,
  tickets, release ticket, stakeholder report) from an epic you already
  wrote. `{{epic content}}` may be pasted text or a file path — if it's a
  path, read that file first.
- **"ticket-to-prompt <ticket-id>"** — the "Utility — Ticket → Build
  Prompt" section in `SKILL.md`: convert an existing ticket into a
  self-contained build prompt formatted to the AICraft prompt schema
  (CONTEXT/GOAL/CONSTRAINTS/INPUTS/EXPECTED OUTPUT/ACCEPTANCE CRITERIA/
  DEFINITION OF DONE). Read
  [`../references/ticket-to-prompt.md`](../references/ticket-to-prompt.md)
  for the field mapping before generating it. This produces a prompt — it
  does not implement anything itself.
- **"onboarding \<branch\>"** — the "Utility — Branch Onboarding & Review"
  section in `SKILL.md`: generate an onboarding doc for that git branch's
  change (what changed, why, key files, how to run/test it locally). Read
  [`../references/branch-operations.md`](../references/branch-operations.md)
  first. Read-only — never modifies code.
- **"review \<branch\>"** — same section, the other operation: an
  evidence-based code review of that branch's diff, ranked
  MUST/SHOULD/COULD. **Only applies when `<branch>` resolves to a real git
  ref** — resolve it (fetching if needed) before proceeding; if it doesn't
  exist, report that rather than falling back to bare "review"'s
  Phase 4 package check, which is a different operation with no branch
  argument.

Never fabricate — use `[ASSUMPTION: ...]`, `[UNKNOWN: ...]`, or
`[PLACEHOLDER: ...]` exactly as `SKILL.md` specifies whenever evidence is
missing. Never implement code changes from this command alone — an
"implement" request must trigger explicit approval, not silent
implementation.
