# {{Ticket ID}}: {{Title}}

**Branch:** `{{branch}}` → `{{base branch}}` **Ticket:** [{{Ticket ID}}]({{ticket path}}) · **Initiative:** [{{Initiative name}}]({{initiative path}})

## Summary

One to three sentences: what this MR does and why, in outcome terms — not
a restatement of the ticket title.

## Problem

The ticket's Problem/Story context, condensed to what a reviewer needs to
judge whether the change is the right one.

## Changes

- One bullet per behaviorally significant change, grounded in the actual
  diff (`git diff --stat`, `git diff --name-status`) — not a file listing.
  Group related file changes under one bullet when they implement one
  change.
- `[UNKNOWN: ...]` for any changed area whose purpose isn't evident from
  the diff, commit messages, or ticket.

## Out of Scope

Anything the ticket's Non-Scope/Out of Scope covers that this MR
deliberately does not touch, so reviewers don't flag it as missing.

## Acceptance Criteria

| Criterion | Status | Evidence |
|---|---|---|
| {{criterion, from the ticket's Gherkin block}} | {{Satisfied \| Partially satisfied \| Not satisfied \| Not verifiable}} | {{file:line or test name}} |

`[UNKNOWN: no linked acceptance criteria found]` if the ticket had none.

## How to Test

Only commands/steps discoverable from the repo's actual test config,
README, or CI — never invented. Include the specific test(s) that cover
this change if identifiable.

## Risk & Rollback

- **Risk:** {{concrete risk this change introduces, or "Low — additive
  change with no consumers of the modified path" if evidence supports it}}
- **Rollback:** {{revert-the-commit, feature-flag-off, or other repo-
  evidenced rollback path; `[UNKNOWN: no rollback convention found]` if
  none is evident}}

## Screenshots / Recordings

`[PLACEHOLDER: attach before/after screenshots or a recording]` — only
include this section when the diff touches UI-rendering code.

## Checklist

- [ ] Acceptance criteria above are satisfied
- [ ] Tests added/updated for the behavior changed
- [ ] No unrelated changes included
- [ ] Documentation updated where the changed behavior is documented
      elsewhere (`[UNKNOWN: none found]` if not applicable)

## Related

- Ticket: [{{Ticket ID}}]({{ticket path}})
- Initiative: [{{Initiative name}}]({{initiative path}})
- Epic: [{{Epic name}}]({{epic path}})
- Tech Spec: [{{Tech Spec name}}]({{tech spec path}}) (if a design decision
  in this MR traces to it)
