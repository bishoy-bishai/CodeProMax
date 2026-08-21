Load and follow `skills/code-pro-max/SKILL.md`, specifically the
"Alternate Entry Point — Epic → Dev" section, and its `references/` and
`templates/` directories for the detailed rules each step uses.

Epic content: $ARGUMENTS

- If `$ARGUMENTS` is a file path instead of raw content, read that file
  first.
- Parse the supplied epic as-is — don't second-guess its scope decisions.
- Backfill a minimal `initiative.md` from it (traceability source of
  truth), marking anything not independently verifiable
  `[ASSUMPTION: derived from supplied epic]`.
- Run a scoped evidence pass limited to the areas the epic's Goals
  reference (not a full repository Discover scan) so the Tech Spec and
  tickets aren't entirely placeholders.
- Continue straight into Tech Spec → ADR → Tickets (INVEST-gated) →
  Release Ticket → Stakeholder Report, then the Phase 4 Validate pass.
- Register the initiative with Status `Planned` and note in the
  `initiative-register.md` Change Log that it originated from a supplied
  epic.

Never fabricate — use `[ASSUMPTION: ...]`, `[UNKNOWN: ...]`, or
`[PLACEHOLDER: ...]` exactly as `SKILL.md` specifies. Never implement code
changes from this command alone — that requires explicit approval.
