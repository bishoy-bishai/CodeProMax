# Merge Request Generation

Supports [SKILL.md](../SKILL.md)'s `mr <ticket-id>` operation. Produces a
complete, ready-to-paste Merge/Pull Request description for the
implementation of a given ticket — read-only, like the other branch
operations in [branch-operations.md](branch-operations.md), but oriented
around the ticket rather than an arbitrary branch, and around an MR
description rather than a review or handoff doc.

## When to Use

The user has (or believes they have) already implemented a ticket on a
branch and wants the MR write-up: summary, changes, acceptance-criteria
mapping, test plan, risk/rollback, and checklist — generated from the
actual diff and the ticket's own spec, not typed by hand.

## Inputs Required

- **The ticket ID** (`{{slug}}-NNN`). Locate `tickets/{{slug}}-NNN.md` by
  ID. If ambiguous (not found, or matches multiple initiatives), ask which
  one rather than guessing.
- **The implementation branch.** If the user names one, use it. Otherwise
  use the current branch (`git branch --show-current`) if it isn't the
  base branch; if it is the base branch and none was named, ask which
  branch holds the implementation rather than guessing.
- The ticket's parent Initiative, Epic, and Tech Spec/ADR if present — read
  all of them; several MR fields draw from them (see mapping below).

## Evidence Gathering

Run the same pipeline as [branch-operations.md](branch-operations.md)'s
"Shared: Branch Evidence Gathering" (Steps 0–6) against the implementation
branch, with one addition: **Step 4 (trace planning/intent artifacts) is
already resolved** — the ticket ID is given, not discovered — but still
verify the branch's actual diff corresponds to that ticket rather than
assuming it from the ID alone. If the diff shows no plausible relationship
to the ticket's Scope/Technical Details, say so explicitly instead of
writing an MR that overclaims what was built.

## Field Mapping

Fill [templates/mr.md](../templates/mr.md) using this mapping. Never
invent a field's content when the source doesn't support it — use
`[UNKNOWN: ...]` / `[PLACEHOLDER: ...]` exactly as elsewhere in this skill.

| MR field | Source |
|---|---|
| Summary | Ticket's Summary line, rewritten in outcome terms + confirmed against what the diff actually contains |
| Problem | Ticket's Story block / Initiative Problem Statement, condensed |
| Changes | `git diff --stat` + `git diff --name-status` + representative hunks — grouped by behavioral change, not raw file list |
| Out of Scope | Ticket's Non-Scope / the Initiative's Out of Scope, filtered to items relevant to this diff |
| Acceptance Criteria | Ticket's Gherkin block, each row mapped to `Satisfied`/`Partially satisfied`/`Not satisfied`/`Not verifiable` against the actual diff and tests — same mapping discipline as branch-operations.md's Step 5, never inferred from ticket text alone |
| How to Test | Ticket's Testing section + repository's actual test/run commands (`package.json`, `Makefile`, CI config) — never invented from framework conventions |
| Risk & Rollback | Diff's blast radius (shared/exported code touched — see branch-operations.md Step 6) + any feature-flag/migration/rollback convention evident in the repo |
| Screenshots | Included only if the diff touches UI-rendering files; otherwise the section is omitted entirely, not left as an empty placeholder |
| Checklist | Fixed items in the template, mapped against the Acceptance Criteria table above |
| Related | Ticket, Initiative, Epic, Tech Spec/ADR links, only for docs that actually exist |

## Acceptance Criteria Discipline

The Acceptance Criteria table is the most load-bearing part of the MR —
it's what a reviewer checks the diff against. Never mark a criterion
`Satisfied` without pointing at the specific file/line or test that
satisfies it. If the branch doesn't fully implement the ticket, report
that plainly (`Partially satisfied` or `Not satisfied`) rather than
softening it for a more presentable MR description.

## Output

Write to `tickets/{{slug}}-NNN.mr.md`, alongside the ticket, and also
print the complete MR description inline so the user can paste it directly
into their MR/PR tool without opening a file.

## Read-Only Guarantee

This operation never modifies code, never creates or pushes a branch,
never opens an MR/PR against any remote, and never stages or commits
anything. It produces the description text only — actually opening the
MR/PR is the user's action, using whatever tool (`gh`, `glab`, a web UI)
they choose.

## Quality Gate

Before presenting the MR description, confirm:

- Every `{{placeholder}}` in the template was replaced with real content
  or an explicit `[PLACEHOLDER]`/`[UNKNOWN]` — none left as literal
  `{{...}}`.
- The Changes section reflects the actual diff, not the ticket's planned
  scope re-stated as if already done.
- Acceptance Criteria statuses were checked against real evidence, not
  assumed satisfied because the ticket describes them.
- Screenshots section is present only when UI-rendering files changed.
- No code was modified, staged, committed, or pushed; no MR/PR was
  created.
