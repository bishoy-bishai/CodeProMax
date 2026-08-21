# Story Decomposition & Vertical Slicing

Supports [SKILL.md](../SKILL.md) Phase 3 (Epic → tickets). Continues from
[invest.md](invest.md).

**Core reference:** *User Stories Applied: For Agile Software Development*
(Mike Cohn) — story decomposition, vertical slicing, user-centered stories,
avoiding technical-task-only stories, acceptance criteria, sizing,
dependency handling, thin vertical slices.

**Core principle: prefer small, valuable vertical slices over large
technical chunks.**

## Vertical Slicing

When decomposing an Epic into tickets, ask: **can this work be sliced
vertically?** Prefer a slice that delivers a meaningful outcome across all
the layers it touches (UI + API + data, or whatever the epic spans) over
splitting automatically by technical layer.

**Avoid** default decomposition like:
```
Ticket 1: Add database column
Ticket 2: Add API endpoint
Ticket 3: Add UI form
```
when none of these independently provides meaningful value on its own.

**Prefer** slices such as:
```
Ticket 1: Users can set a display name (schema + API + UI, end to end)
Ticket 2: Display name shows in the activity feed
```

**Technical layering is still valid** when it reflects real architectural
boundaries, dependencies, risk reduction, or independently valuable work
(e.g. a migration that must ship and bake before the feature that depends
on it). Don't force artificial vertical slicing where a layered approach is
the honest shape of the work.

## Story Quality Gate

Before a ticket is considered ready, validate:
- User or business value is clear.
- The story can be understood without reading the entire Epic.
- It is independently deliverable where practical.
- Implementation remains negotiable unless already decided by the Tech Spec.
- It is estimable, small enough, and testable.
- Acceptance criteria are clear.
- Dependencies and assumptions are explicit.
- It is not merely a technical task with no identifiable outcome.
- It is not an artificial split that destroys meaningful value.
