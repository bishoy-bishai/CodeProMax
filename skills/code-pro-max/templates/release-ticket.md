# Release: {{Initiative Name}}

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Generated | {{ISO-8601 timestamp}} |
| Owner | {{owner}} |
| Related | [Initiative](../initiative.md) · [Epic](../epic.md) · [Tech Spec](../tech-spec.md) |

## Release Objective

One or two sentences: what this release accomplishes and why, tied to the
initiative's expected outcome.

## Changes Included

- One line per ticket shipped in this release, linked to its ticket file.
  `[PLACEHOLDER: ...]` for tickets not yet merged.

## Pre-Release Checklist

- [ ] All included tickets merged and passing CI
- [ ] Tech Spec's testing strategy fully executed
- [ ] Security/NFR items from the Tech Spec addressed or explicitly deferred
- [ ] Feature flag(s) configured: `[PLACEHOLDER: ...]`
- [ ] Stakeholder report reviewed

## Rollout Plan

Phased rollout structure — `[PLACEHOLDER: ...]` for percentages/durations,
never fabricated:
1. Dogfood / internal — `[PLACEHOLDER: duration]`
2. Canary — `[PLACEHOLDER: percentage, duration]`
3. Progressive rollout — `[PLACEHOLDER: percentage, duration]`
4. Full rollout

## Rollback Plan

Feature-flag disablement steps, plus `[PLACEHOLDER: ...]` for migration
reversibility if this release includes a data migration.

## Post-Release Validation

The checks to run after each rollout phase before proceeding to the next —
tied to the success metrics below.

## Success Metrics

The Initiative's success criteria, restated as concrete checks to observe
post-release (metric name, expected direction, `[PLACEHOLDER: baseline]` if
not yet measured).

## Monitoring & Alerting

One alert/metric per success criterion — link to dashboards once created
(`[PLACEHOLDER: ...]` until they exist).
