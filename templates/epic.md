# Epic: {{Initiative Name}}

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Generated | {{ISO-8601 timestamp}} |
| Owner | {{owner}} |
| Reviewers | {{reviewer1, reviewer2}} |

**Related documents:** [Initiative](./{{slug}}-initiative.md)

## Summary

The opportunity description, in one paragraph.

## Business Value

Why this matters to the business, tied to the underlying problem severity.

## Engineering Value

Why this matters to engineering, tied to the leverage/cost/risk axes of the
initiative's scoring breakdown.

## Goals

The in-scope items from the initiative's opportunity definition.

## Non-Goals

The explicit non-scope items, to prevent scope creep.

## Acceptance Criteria

Each success criterion rendered as a Gherkin Given/When/Then block:

```gherkin
Given the initiative "{{name}}" is implemented
When the change is deployed
Then {{success criterion}}
```

## Success Metrics

The measurable success criteria from the initiative.

## Dependencies

Other initiatives this epic depends on, linked to their initiative documents.

## Timeline Estimate

Always rendered as `[PLACEHOLDER: hours estimate ...]` — sizing happens during
technical spec, not document generation. Never fabricated.

## Definition of Done

The success criteria plus standard completion gates: acceptance criteria
verified in staging, tech spec reviewed, documentation updated.
