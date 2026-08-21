# Ticket → Build Prompt

Supports [SKILL.md](../SKILL.md)'s `ticket-to-prompt <ticket-id>`
operation. Converts an existing implementation ticket into a detailed,
ready-to-hand-off build prompt, formatted to the AICraft prompt schema
(https://github.com/bishoy-bishai/AICraft/tree/main/skill —
`prompt-library.md`'s Standard Prompt Structure and Feature Implementation
Prompt Template).

## When to Use

The user already has a scored, INVEST-validated ticket (from Phase 3 or
`epic-to-dev`) and wants a self-contained prompt they can hand to a coding
agent — this one, a different session, or a different tool entirely — to
actually build it. This operation does not implement anything itself; it
produces the prompt that would drive implementation. Implementation still
requires the explicit approval step described in `SKILL.md`'s Phase 5.

## Inputs Required

- The ticket file (`tickets/{{slug}}-NNN.md`) — locate by ticket ID. If
  ambiguous (ID not found, or matches multiple initiatives), ask which one
  before proceeding rather than guessing.
- The ticket's parent Initiative, Epic, Tech Spec, and ADR (if one exists)
  — read all of them; the prompt draws context from each.

## Field Mapping

Fill [templates/ticket-prompt.md](../templates/ticket-prompt.md) using
this mapping — never invent a field's content when the source document
doesn't have it; use the same `[PLACEHOLDER: ...]` /
`[UNKNOWN: ...]` conventions as everywhere else in this skill.

| Prompt field | Source |
|---|---|
| CONTEXT | Initiative's Problem Statement + Epic's Summary, condensed to one paragraph |
| GOAL | The ticket's Story block, restated as a single objective sentence |
| CONSTRAINTS #1 (scope) | The Initiative Scope item this ticket maps to (see `references/documentation-framework.md` §08.5's scope-item mapping rule) |
| CONSTRAINTS #2 (architecture) | Tech Spec §3 Proposed Solution / §4 Detailed Design |
| CONSTRAINTS #3 (non-scope) | Initiative's Non-Scope section |
| CONSTRAINTS #5 (ADR) | Any binding decision from `adr.md`, if the initiative has one — omit the line entirely if there's no ADR |
| INPUTS | Ticket's Technical Details bullets + Expected Files/Areas + relevant Tech Spec section anchors |
| EXPECTED OUTPUT | Ticket's Testing section + Tech Spec's Testing Strategy |
| ACCEPTANCE CRITERIA | The ticket's Gherkin block, copied verbatim — never paraphrased, since paraphrasing can silently change what's testable |
| DEFINITION OF DONE | The ticket's own Definition of Done items, plus the fixed AICraft-style checklist items already in the template |

## AICraft Awareness

The generated prompt opens by telling the executing agent to operate under
the AICraft Constitution/Workflow if the target repository has AICraft
installed, and to apply the same discipline (understand-first, atomic
changes, no invented requirements) if it doesn't. This skill does not
bundle or reproduce AICraft's Constitution/Workflow/Playbook content — it
only points to it, since AICraft governs *how* code gets written and this
skill governs *what* gets planned. If the target repo's AICraft
installation lives somewhere other than `skills/aicraft/`, note the actual
path in the prompt's opening line instead of guessing.

## Output

Write the filled prompt to `tickets/{{slug}}-NNN.prompt.md`, alongside the
ticket it was generated from, and also print it in the response so the
user can copy it immediately without opening a file.

## Quality Gate

Before presenting the prompt, confirm:
- Every `{{placeholder}}` in the template was replaced with real content or
  an explicit `[PLACEHOLDER]`/`[UNKNOWN]` — none left as literal `{{...}}`.
- The Acceptance Criteria section matches the ticket's Gherkin block
  exactly (no silent rewording).
- The Constraints section doesn't contradict the Tech Spec or ADR.
- If the ticket itself hasn't passed the INVEST gate yet, say so and offer
  to run that first — a prompt built from a non-INVEST-ready ticket will
  produce ambiguous or oversized work.
