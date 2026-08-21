# INVEST Quality Gate

Supports [SKILL.md](../SKILL.md) Phase 3, ticket generation
([templates/ticket.md](../templates/ticket.md)). Continues into
[story-decomposition.md](story-decomposition.md).

Apply the INVEST model to every user story / implementation ticket before
it is considered implementation-ready. **No ticket is "Ready for
Development" until it passes this gate.**

| Letter | Meaning | Check |
|---|---|---|
| **I** — Independent | Can be developed, tested, and ideally delivered without unnecessary dependency on other stories | Does this ticket require another unmerged ticket to be meaningfully testable? |
| **N** — Negotiable | Describes the problem/outcome/constraints without unnecessarily prescribing implementation, unless the Tech Spec already decided it | Could two engineers implement this differently and both satisfy it? |
| **V** — Valuable | Delivers clear user, customer, operational, or business value | Can you state the value in one sentence without saying "as part of the initiative"? |
| **E** — Estimable | Contains enough context/clarity for the team to estimate effort | Would an engineer need to ask a clarifying question before sizing this? |
| **S** — Small | Fits within one delivery cycle, focused on one coherent outcome | Could this be split into two independently valuable pieces? |
| **T** — Testable | Has unambiguous acceptance criteria verifiable as pass/fail | Are the acceptance criteria Given/When/Then or otherwise observable? |

When a story fails INVEST, **refine, split, or clarify it** — don't just
flag the failure and move on.

## Validation Output

Surface validation when useful, e.g.:

```
TICKET-003: "Add caching layer"
  I ✅  N ✅  V ⚠️ (value stated as an activity, not an outcome)  E ✅  S ❌ (bundles cache + invalidation + monitoring)  T ✅

Action: split into TICKET-003a "Cache product lookups to cut p99 latency
below 200ms" and TICKET-003b "Add cache invalidation on product update".
```

## Dependency Handling

If a dependency is unavoidable, document it explicitly rather than
pretending the story is independent:

```
[PLACEHOLDER] Depends on <ticket / decision / external dependency>.
```

## Estimation Rules

Never invent Story Points, time estimates, or capacity assumptions. An
effort range (S/M/L, or a range derived from the initiative's cost signal)
is fine; team-specific estimation remains a team decision.

## Small ≠ Artificially Tiny

Balance **Small** with **Valuable**. Splitting a story into meaningless
fragments solely to satisfy INVEST is a decomposition failure, not success.

**Goal: small enough to deliver + large enough to provide meaningful
value.**
