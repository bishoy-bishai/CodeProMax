Load and follow the full instructions in `skills/code-pro-max/SKILL.md` —
the Engineering Improvement Initiative Skill (Discover → Select → Plan →
Validate → Maintain) — and its `references/` and `templates/` directories
for the detailed rules and document structures each phase uses.

Arguments: $ARGUMENTS

- No argument → Phase 1 (Discover): scan the repository, present a ranked
  Top 5 opportunities. Don't generate documents yet.
- A path → scope the scan to that path.
- "select <n or name>" → Phase 2: select that initiative, checking the
  register for duplicates first.
- "<initiative name> --build" → Phase 3: generate the full documentation
  package (initiative, epic, tech spec, ADR, tickets, release ticket,
  stakeholder report).
- "review" / "check drift" → Phase 4/5 consistency or drift check.
- "update tickets" / "update stakeholder report" / "regenerate release
  ticket" → Phase 5 resync against the current tech spec/initiative.
- "epic-to-dev {{epic content}}" → the "Alternate Entry Point — Epic →
  Dev" flow in `SKILL.md`: skip Discover/Select and plan the rest of the
  package (tech spec, ADR, tickets, release ticket, stakeholder report)
  from an epic you already wrote. `{{epic content}}` may be pasted text or
  a file path — if it's a path, read that file first.
- "ticket-to-prompt <ticket-id>" → the "Utility — Ticket → Build Prompt"
  section in `SKILL.md`: convert an existing ticket into a self-contained
  build prompt formatted to the AICraft prompt schema (CONTEXT/GOAL/
  CONSTRAINTS/INPUTS/EXPECTED OUTPUT/ACCEPTANCE CRITERIA/DEFINITION OF
  DONE). Read `references/ticket-to-prompt.md` for the field mapping
  first. Produces a prompt — does not implement anything itself.

Never fabricate — use `[ASSUMPTION: ...]`, `[UNKNOWN: ...]`, or
`[PLACEHOLDER: ...]` exactly as `SKILL.md` specifies. Never implement code
changes from this command alone — that requires explicit approval.
