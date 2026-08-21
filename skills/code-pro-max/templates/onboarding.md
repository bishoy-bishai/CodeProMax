# Branch Onboarding: {{branch name}}

| Field | Value |
|---|---|
| Generated | {{ISO-8601 timestamp}} |
| Base branch | {{base branch}} (resolved via {{how it was resolved}}) |
| Merge base | {{commit sha}} |
| Commits | {{count}} |
| Linked | {{Initiative/Ticket link, or "none found"}} |

## At a Glance

One or two sentences: what this branch does, for someone with 10 seconds.

## What Changed

Plain-language behavior description — what the system does differently,
not a restated diff.

## Why

The problem this addresses, tied to the linked ticket/Initiative's Problem
statement if one was found via branch name or commit messages.
`[UNKNOWN: no linked ticket/initiative found — inferred from diff only]`
if none was found.

## Before → After

```
Before:
{{repository-supported behavior}}

After:
{{repository-supported behavior}}
```

## How It Works

A short runtime/data-flow mental model (~3–7 steps), using only
relationships supported by repository evidence.

```
{{step}}
    ↓
{{step}}
    ↓
{{step}}
```

## Key Files to Read First

1. `{{file}}` — {{one-line reason: central implementation, shared/public
   contract, primary consumer, tests defining behavior, configuration/
   integration, supporting implementation}}
2. `{{file}}` — {{reason}}

## How to Run / Test Locally

Pulled from the repo's actual scripts/config — never invented.
`[UNKNOWN: no repository-defined run/test convention found]` if the repo
has none.

## Acceptance Criteria

| Criterion | Status | Evidence |
|---|---|---|
| {{criterion}} | {{Satisfied \| Partially satisfied \| Not satisfied \| Not verifiable}} | {{file:line or note}} |

`[UNKNOWN: no linked acceptance criteria found]` if none were traced.

## Non-Goals / Assumptions

Only listed when supported by the ticket, Initiative, Tech Spec, ADR, or a
clear implementation constraint — never manufactured.

## Open Questions / Risks

Anything the diff alone leaves unclear.

## Related Docs

- Initiative: {{link, or "none"}}
- Epic: {{link, or "none"}}
- Tech Spec: {{link, or "none"}}
- ADR: {{link, or "none"}}
- Ticket(s): {{link(s), or "none"}}

## Suggested Reading Order

1. {{file or doc}}
2. {{file or doc}}
3. {{file or doc}}
