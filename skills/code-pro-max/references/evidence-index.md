# §10 — Evidence Index

Supports [SKILL.md](../SKILL.md) Phase 1 (Discover) and the branch
evidence-gathering pipeline in
[branch-operations.md](branch-operations.md), which
[mr-generation.md](mr-generation.md) also runs. A lightweight, disposable
cache of evidence already gathered against a specific commit, so repeated
work against the *same* code doesn't re-walk git history, re-read the same
diff, or reconstruct the same reconnaissance from scratch.

**This is a performance optimization, not a new evidence source.** It
never replaces the reconnaissance/evidence-gathering pipelines those files
define — it only lets a pipeline skip re-running itself when the
underlying git state hasn't changed since the last time it ran.

---

## Core Rule

> Reuse evidence only when the commit it was gathered against is exactly
> the commit being analyzed now. Any mismatch is a cache miss, not a
> partial hit.

The index is never authoritative over live git state. A cheap
`git rev-parse` check always happens first; cached evidence is used only
when it matches, and the check itself is never skipped to save time.

---

## Storage

A single JSON file at `evidence/index.json` in the repository being
analyzed (sibling to `onboarding/`, `reviews/`, and `tickets/` — not inside
the skill directory, since it caches evidence about the *target* repo, not
about codeProMax itself).

```json
{
  "reconnaissance": {
    "head_sha": "a1b2c3d",
    "gathered_at": "2026-09-07T10:00:00Z",
    "summary": {
      "app_type": "...",
      "languages": ["..."],
      "architecture_boundaries": ["..."],
      "entry_points": ["..."],
      "quality_system": "...",
      "observability": "..."
    }
  },
  "branches": {
    "feature-slug": {
      "base_branch": "main",
      "merge_base_sha": "d4e5f6a",
      "branch_head_sha": "9f8e7d6",
      "gathered_at": "2026-09-07T11:30:00Z",
      "changed_files": ["..."],
      "diff_stat": "...",
      "traced_artifact": "INIT-004",
      "scope_alignment": { "...": "Satisfied | Partially satisfied | Not satisfied | Not verifiable" },
      "shared_consumers": ["..."]
    }
  }
}
```

Only cache what a pipeline already produces as part of its normal output —
don't gather extra evidence solely to populate the index.

If `evidence/index.json` is missing, unreadable, or malformed: treat it as
an empty cache and proceed with the full pipeline. A corrupt or absent
index is never an error — it degrades to "no cache," nothing more.

---

## Reconnaissance Reuse (Discover — Phase 1)

Before running
[evidence-and-analysis.md](evidence-and-analysis.md) §01's full
reconnaissance pipeline:

1. Resolve the current HEAD SHA of the ref being analyzed
   (`git rev-parse HEAD`, or the target ref if one was specified).
2. If `reconnaissance.head_sha` in the index matches exactly, reuse
   `reconnaissance.summary` as the reconnaissance output and skip straight
   to Signals. State explicitly that reconnaissance was reused from the
   index and the SHA it matched.
3. Otherwise, run reconnaissance in full, then write the new summary to
   `reconnaissance` in the index (replacing whatever was there).

A reused reconnaissance summary is still subject to the same reasoning
chain and Fact/Inference/Hypothesis discipline as freshly gathered
reconnaissance — reuse changes *where the evidence came from*, never
*how confidently it's allowed to be stated*.

## Branch Evidence Reuse (Onboarding, Review, MR Generation)

Before running [branch-operations.md](branch-operations.md)'s "Shared:
Branch Evidence Gathering" (Steps 0–6):

1. Complete Step 0 (repository state) and Step 1 (resolve base branch)
   normally — these are cheap and the base branch can legitimately change
   between runs.
2. Resolve the target branch's current head SHA and the current
   `merge-base(base, branch)` SHA (Step 2's ref check gives you the first;
   `git merge-base` gives the second).
3. Look up `branches.{{branch-slug}}` in the index. If both
   `merge_base_sha` and `branch_head_sha` match the current values exactly,
   reuse the cached `changed_files`, `diff_stat`, `traced_artifact`,
   `scope_alignment`, and `shared_consumers` in place of Steps 3–6. State
   explicitly that branch evidence was reused from the index and which SHA
   it matched.
4. Otherwise — either no entry exists, or either SHA differs — run Steps
   3–6 in full, then write (or overwrite) `branches.{{branch-slug}}` with
   the new evidence and current SHAs.

**A branch head moving invalidates its entire cache entry.** New commits,
a rebase, or an amend on the branch since the last cached run means Steps
3–6 run again in full — never patch or partially trust a stale entry.
[mr-generation.md](mr-generation.md) uses this same reuse check since it
runs the identical pipeline.

---

## What This Never Changes

- The evidence-gathering rules themselves — Steps 0–6, the reconnaissance
  checklist, the finding-confidence tiers — are unchanged by whether their
  output came from a fresh run or the index.
- **Never invalidation-fudge.** A SHA that's "close enough" (e.g. one
  commit behind) is still a miss. Exact match only.
- The index caches evidence, never conclusions that depend on more than
  the diff itself — e.g. a review's `MUST`/`SHOULD`/`COULD` findings and
  an onboarding doc's prose are always regenerated from the (possibly
  reused) evidence, never cached and replayed verbatim. Two different
  operations against the same branch (e.g. `review` then `onboarding`)
  reuse the same underlying diff/scope evidence but still produce their
  own, freshly-written documents.
- Read-only guarantees in [branch-operations.md](branch-operations.md) —
  writing to `evidence/index.json` is the only file this mechanism
  produces or updates; it never touches the branch under analysis.
- No fabrication: if the index doesn't have what's needed and gathering it
  fresh isn't possible (e.g. can't fetch a remote branch), fall back to
  `[UNKNOWN: ...]` exactly as the underlying pipeline already specifies —
  the index is never a reason to guess.

`evidence/index.json` is a disposable working file, not a deliverable —
safe to delete at any time; the next operation just rebuilds it as a cache
miss. Projects that don't want it committed can add `evidence/index.json`
to `.gitignore`; `onboarding/` and `reviews/` remain the actual documents
meant to be read and shared.
