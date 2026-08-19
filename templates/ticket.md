# {{Ticket ID}}: {{Title}}

**Effort:** {{S|M|L}} ({{day range}}) — **Dependencies:** {{ticket IDs, at most one}}

## Story

```
As an engineer
I want {{scope item, lowercased}}
So that {{first sentence of the opportunity description, lowercased}}
```

## Acceptance Criteria

```gherkin
Feature: {{scope item}}

Scenario: {{scope item}} is delivered
  Given the initiative "{{initiative name}}" is being implemented
  When "{{scope item}}" is completed
  Then {{matching success criterion, or a generic acceptance-review clause}}
```

## Technical Notes

- One bullet per piece of code/config evidence whose content or file path
  shares a keyword with the scope item; `[PLACEHOLDER: ...]` when none match.

## Definition of Done

- The matched success criterion (or a generic completion clause)
- Code reviewed and merged
- Tests passing in CI

---

Tickets whose derived effort resolves to **L** are automatically split into
two **M** tickets ("Part 1: Design & Foundation" / "Part 2: Implementation &
Rollout") so no ticket exceeds a few days of work. Effort is derived from the
initiative's scoring `cost` axis (1-2 → S, 3 → M, 4-5 → L) — never guessed
per ticket.
