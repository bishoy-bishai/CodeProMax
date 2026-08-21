# {{Ticket ID}}: {{Title}}

**Effort:** {{S|M|L}} ({{day range}}) — **Dependencies:** {{ticket IDs, or `[PLACEHOLDER] Depends on <ticket/decision/external dependency>`}}

**Related:** [Initiative](../initiative.md) · [Epic](../epic.md) · [Tech Spec](../tech-spec.md)

## Summary

One sentence: what outcome this ticket delivers, not the activity performed.

## Story

```
As a {{role}}
I want {{scope item, outcome-oriented}}
So that {{first sentence of the opportunity description}}
```

## Acceptance Criteria

```gherkin
Feature: {{scope item}}

Scenario: {{scope item}} is delivered
  Given the initiative "{{initiative name}}" is being implemented
  When "{{scope item}}" is completed
  Then {{matching success criterion — observable and testable, not "handles errors gracefully"}}
```

## Technical Details

- One bullet per piece of code/config evidence whose content or file path
  shares a keyword with the scope item; `[PLACEHOLDER: ...]` when none match.

## Expected Files / Areas to Change

- `[PLACEHOLDER: ...]` unless evidence-collection already identified the
  specific files.

## Testing

- The failure-path / edge-case tests this ticket must add or update
  (see the Tech Spec's Testing Strategy and Failure Modes sections).

## Missing Information

- `[PLACEHOLDER: ...]` for anything a reviewer would need to fill in before
  implementation can start.

## Definition of Done

- The matched success criterion (or a generic completion clause)
- Code reviewed and merged
- Tests passing in CI

---

**INVEST check** (see `references/invest.md` in the skill) — Independent /
Negotiable / Valuable / Estimable / Small / Testable. Tickets whose derived
effort resolves to **L** are split into two **M** tickets ("Part 1: Design &
Foundation" / "Part 2: Implementation & Rollout") rather than left oversized.
Effort is derived from the initiative's cost signal (low → S, medium → M,
high → L) — never guessed per ticket.
