# §07 — Initiative Definition & Register

Supports [SKILL.md](../SKILL.md) Phase 1 (creation) and Phase 5 (maintenance).
Continues from [prioritization.md](prioritization.md) §06.

**Objective:** turn ranked opportunities into persistent, traceable
Initiative artifacts that later drive Epic, Tech Spec, ADR, tickets,
release planning, and stakeholder communication.

**Principle: an Initiative is a work concept; documents are representations
of that concept.** All downstream documents must remain traceable to the
canonical Initiative and must not independently invent a different problem,
scope, outcome, or decision.

## Initiative Identity

**ID** — a stable, immutable identifier, e.g. `INIT-001`. Categories may
change; identity should not.

**Naming** — outcome-oriented, not implementation-oriented.

- Avoid: "Refactor API", "Add OpenTelemetry", "Improve Code"
- Prefer: "Improve Production Error Visibility", "Reduce API Error
  Inconsistency", "Improve Test Reliability"
- Pattern: **Verb + Outcome** (Improve, Reduce, Establish, Standardize +
  meaningful outcome).

**Slug** — stable lowercase kebab-case, e.g. `improve-production-error-visibility`.
Rules: lowercase, kebab-case, no dates, no random IDs, avoid implementation
technology in the name unless essential.

## Initiative Folder Structure

**During discovery**, create only the canonical Initiative artifact per
candidate:
```
initiatives/<slug>/initiative.md
```

**After selection**, generate the full package:
```
initiatives/<slug>/
  initiative.md
  epic.md
  tech-spec.md
  adr.md
  tickets/
    <slug>-001.md
    <slug>-002.md
    ...
  release-ticket.md
  stakeholder-report.md
```

Adjust the root location to wherever the user's project keeps planning docs
— don't assume silently if unclear.

## Initiative Metadata

Canonical metadata (in `initiative.md`'s front-matter table): ID, Name,
Slug, Status, Priority, Owner, Reviewers, Score, Score Confidence, Created,
Last Updated. Never invent owners, dates, stakeholders, approvals, or
targets — use `[PLACEHOLDER]` when required information is missing.

## Initiative Status Lifecycle

```
Proposed → Selected → Planned → In Progress → Released → Validated → Completed
```

Side states: `Deferred`, `Rejected`, `Cancelled`, `Blocked`.

**Status ≠ Priority.** Don't confuse lifecycle state with importance —
`Status: Deferred` and `Priority: High` can both be true simultaneously.

## Canonical Initiative Document

`initiative.md` is the decision-level source of truth. It captures **why**
the initiative exists and why it's worth considering — it is not the Tech
Spec. See [templates/initiative.md](../templates/initiative.md) for the
full structure.

## Traceability

**Backward** — every Initiative traces to the signal/finding/root cause/
opportunity that produced it (§01–§05 in
[evidence-and-analysis.md](evidence-and-analysis.md) and
[prioritization.md](prioritization.md)).

**Forward** — every downstream document (Epic, Tech Spec, ADR, tickets,
release ticket, stakeholder report) traces back to this Initiative and does
not introduce a different problem, scope, or outcome.

## Duplicate Detection

Before creating a new Initiative, check `initiative-register.md` and
existing `initiatives/*/initiative.md` files for: same problem, similar
root cause, same expected outcome, an existing active/completed/deferred
Initiative. If a potential duplicate is found, **report it and explain the
overlap** — never silently create a duplicate.

## Initiative Quality Gate

An Initiative is eligible for the ranked list only when it has: a validated
finding (evidence-and-analysis.md §02), a root cause (§03), a scoped
opportunity (prioritization.md §04), at least one alternative considered
(§05), and a decision trace with score (§06).

## User Selection Flow

The user is the final decision-maker:
1. Agent presents the ranked Top 5 (or full list on request).
2. User selects by number or name.
3. Agent checks for duplicates against the register.
4. Agent confirms the selected Initiative's problem/scope back to the user
   before generating the full documentation package.

## Documentation Generation Order

**Never generate implementation tickets before the design direction is
understood.**
```
Initiative → Epic → Tech Spec → ADR (if needed) → Tickets → Release Ticket → Stakeholder Report
```
This preserves Problem → Design → Implementation rather than letting
implementation details drive the design.

## Definition of Ready for Full Documentation

A selected Initiative is ready for the full package when: the problem
statement is evidence-backed, scope/non-scope are defined, at least one
success criterion (or explicit `[PLACEHOLDER]`) exists, and critical
unknowns are either explicit `[PLACEHOLDER]` items or named validation
tasks — not silently skipped.

## Initiative Register

Maintain a root `initiative-register.md`
([templates/initiative-register.md](../templates/initiative-register.md))
as the index of all Initiative artifacts — ID, name, status, priority,
score, owner, link to `initiative.md`.

**Keep it synchronized** whenever an Initiative is created, selected,
changes priority/status/score/scope, is completed, or is rejected. **Do not
silently rewrite decision history** — material score or scope changes
record what changed and why, e.g.:

```
2026-08-21 — INIT-004 score revised 72 → 58: original churn evidence was
from a file since deleted in a prior refactor (git log shows no commits in
90 days). Re-scored with current evidence.
```

## Placeholder Policy

Use explicit placeholders whenever required information is unavailable:
`[PLACEHOLDER: ...]`, `[UNKNOWN: ...]`, `[ASSUMPTION: ...]`,
`[HYPOTHESIS: ...]`. **Never invent facts to make a document appear
complete.**
