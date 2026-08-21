# Branch Review: {{branch name}}

## Review Context

| Field | Value |
|---|---|
| Branch | {{branch}} |
| Base | {{base branch}} (resolved via {{how it was resolved}}) |
| Merge base | {{commit sha}} |
| Commit count | {{count}} |
| Changed files | {{count}} |
| Linked Initiative | {{link, or "none"}} |
| Linked Ticket | {{link, or "none"}} |

## Executive Summary

One paragraph: what this branch does and the overall shape of the review
(e.g. "3 MUST-fix issues, 2 SHOULD, no security findings").

## Acceptance Criteria

| Criterion | Status | Evidence |
|---|---|---|
| {{criterion}} | {{Satisfied \| Partially satisfied \| Not satisfied \| Not verifiable}} | {{file:line or note}} |

`[UNKNOWN: no linked acceptance criteria found]` if none were traced.

## Findings

Ordered `MUST` → `SHOULD` → `COULD`; within a strength, most severe first.
A category with nothing wrong gets no entry — this list is never padded to
look thorough, though every category in the review order was considered.

### {{MUST | SHOULD | COULD}} — {{short finding title}}

**Severity:** {{Critical | High | Medium | Low}}
**Category:** {{Scope & Intent | Architecture | Domain | Correctness |
Security | Performance | Readability | Testing | Documentation}}
**Confidence:** {{Confirmed | Likely | Potential}}
**Evidence:** `{{file}}:{{line}}`

```
{{relevant diff or code snippet}}
```

**Failure scenario:** {{concrete input/state that triggers it — required
for MUST/SHOULD findings that claim a bug; omit for style/readability
findings}}
**Recommendation:** {{what to change — a recommendation only, never an
applied fix}}

*(repeat one block per finding)*

## Strengths

Optional, up to three, only when evidence-backed and materially useful
(e.g. "preserves backward compatibility for existing `DataTable`
consumers"). Omit this section entirely rather than padding it with
generic praise.

## Review Coverage

```
Scope & Intent    {{✓ | not feasible: reason}}
Architecture      {{✓ | not feasible: reason}}
Domain            {{✓ | not feasible: reason}}
Correctness       {{✓ | not feasible: reason}}
Security          {{✓ | not feasible: reason}}
Performance       {{✓ | not feasible: reason}}
Readability       {{✓ | not feasible: reason}}
Testing           {{✓ | not feasible: reason}}
Documentation     {{✓ | not feasible: reason}}
```

This is a coverage confirmation, not a place to invent "no issues"
findings for categories that were simply clean.
