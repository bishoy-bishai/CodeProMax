# Technical Specification: {{Initiative Name}}

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Generated | {{ISO-8601 timestamp}} |
| Owner | {{owner}} |
| Reviewers | {{reviewer1, reviewer2}} |

## 1. Context & Goals

### Goals
In-scope items from the initiative's opportunity definition.

### Non-Goals
Explicit non-scope items.

### Success Metrics
The ICE-extended scoring breakdown plus the functional success criteria.

## 2. Current State

### Architecture
Known touchpoints derived from code/config evidence attached to the
initiative; `[UNKNOWN: ...]` when no such evidence exists.

### Constraints
Open risks/blockers that constrain the design.

## 3. Proposed Solution

### Architecture Diagram
A Mermaid `graph TB` diagram derived from the declared scope items —
illustrative, not a verified topology.

### Design Overview
The opportunity description.

## 4. Detailed Design

### Components
One subsection per scope item, with `[PLACEHOLDER: ...]` for responsibilities,
inputs/outputs, and ownership.

### Data Models
`[PLACEHOLDER: ...]` — schema/migration details are filled in during design review.

### API Contracts
`[PLACEHOLDER: ...]` — endpoint/contract details are filled in during design review.

### Error Handling
`[PLACEHOLDER: ...]` — error boundaries, retries, fallbacks.

## 5. Security & Non-Functional Requirements

### Security / Performance / Scalability / Reliability
Each section surfaces risks whose description matches the category's
keywords (e.g. "auth", "latency", "scale", "availability"); falls back to
`[PLACEHOLDER: ...]` when none are recorded.

## 6. Failure Modes & Edge Cases

### Failure Scenarios
One entry per recorded risk/blocker: likelihood, impact, detection
(`[PLACEHOLDER: ...]`), recovery (the risk's mitigation), owner, status.

### Edge Cases
`[PLACEHOLDER: ...]` — enumerated during implementation review.

## 7. Alternatives Considered
`[PLACEHOLDER: ...]` — not persisted on the Initiative record.

## 8. Testing Strategy

### Unit Tests
One line per scope item.

### Integration Tests
One line per success criterion.

### End-to-End Tests
`[PLACEHOLDER: ...]` — the primary end-to-end flow to exercise.

## 9. Rollout & Observability

### Phased Rollout
Standard dogfood → canary → progressive → full rollout structure, with
`[PLACEHOLDER: ...]` for percentages/durations (never fabricated).

### Feature Flags
`[PLACEHOLDER: ...]` — flag name(s) and kill-switch owner.

### Monitoring & Alerting
One alert/metric per success criterion.

### Dashboards
`[PLACEHOLDER: ...]` — link once created.

## 10. Rollback Plan
Feature-flag disablement plus `[PLACEHOLDER: ...]` for migration reversibility.

## 11. Open Questions
The initiative's open questions, or `[UNKNOWN: ...]` if none recorded.

## 12. Related Artifacts

- Initiative: [link](./initiative.md)
- Epic: [link](./epic.md)
- ADR: [link](./adr.md)
- Jira Tickets: [link](./tickets/)
- Release Ticket: [link](./release-ticket.md)
