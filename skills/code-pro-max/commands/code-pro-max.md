---
description: Discover, select, plan, validate, or maintain engineering initiatives
argument-hint: [scan-path | "select <n or name>" | "<initiative name> --build" | "review" | "check drift" | "epic-to-dev {{epic content}}"]
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

Never fabricate — use `[ASSUMPTION: ...]`, `[UNKNOWN: ...]`, or
`[PLACEHOLDER: ...]` exactly as `SKILL.md` specifies whenever evidence is
missing. Never implement code changes from this command alone — an
"implement" request must trigger explicit approval, not silent
implementation.
