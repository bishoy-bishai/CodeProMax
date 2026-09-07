# §09 — Humanization

The final pass applied to generated prose (Initiative narratives, Epic
summaries, Tech Spec rationale, ADR context/consequences, Stakeholder
Report copy, onboarding write-ups, branch review commentary, MR
descriptions) after the [Writing Constitution](documentation-framework.md#writing-constitution)
and before the document is considered done. Where the Writing Constitution
governs *what tone and vocabulary to use*, this layer governs *whether the
sentence reads like a person wrote it or like a template generated it*.

Inspired by the pattern catalogue in
[blader/humanizer](https://github.com/blader/humanizer), adapted to
codeProMax's own content (engineering planning docs, not general prose) and
constrained by codeProMax's evidence rules: humanization is a **phrasing
pass only**. It must never add, remove, or reweight a fact, metric, date,
name, or technology that the evidence discipline in
[evidence-and-analysis.md](evidence-and-analysis.md) and
[SKILL.md](../SKILL.md)'s no-fabrication rule already settled.

---

## 1. Core Rule

> Fix sentences that sound generated. Leave sentences that already sound
> natural alone.

This is a **minimum-necessary-intervention** pass, not a rewrite-everything
pass. A sentence that already reads like something a senior engineer would
write to a colleague stays untouched.

Humanization never overrides the no-fabrication rule or the Writing
Constitution — if a fix would require inventing, softening, or dropping
evidence to sound smoother, don't make the fix.

---

## 2. Patterns to Reduce

### A. Fake contrasts

```
❌ It's not just a slower query — it's a slower checkout for every user.
❌ This isn't about refactoring. It's about maintainability.
✓  The slow query adds 400ms to every checkout.
✓  Refactoring here reduces the maintenance burden on the payments team.
```

Keep a contrast only if both halves carry real information the reader
needs, or the contrast corrects an actual misconception.

### B. Generic dramatic conclusions

```
❌ And that's where the real impact shows.
❌ This is the key improvement driving the whole initiative.
```

If a closing sentence adds no new fact, delete it. End on the last
concrete point (a metric, a risk, a next step) instead.

### C. Staged introductions

```
❌ Let's dive into what changed this release.
❌ Here's what you need to know about this tech spec.
❌ Let's break down the current architecture.
```

Start directly with the actual information — the problem statement, the
change, the design.

### D. Generic AI vocabulary

Watch for: `crucial`, `pivotal`, `comprehensive`, `delve`, `landscape`,
`showcase`, `leverage`, `foster`, `testament`, `underscore`, `valuable`,
`intricate` — on top of the words the
[Writing Constitution](documentation-framework.md#writing-constitution)
already bans (*robust, seamless, cutting-edge, revolutionary,
transformative*).

Not a blocklist — replace a word only when it's decoration rather than
doing real work in the sentence. "Comprehensive test suite" with no count
is decoration; "comprehensive" describing a suite of 40 named test cases
that's explicitly enumerated nearby is fine.

### E. Inflated phrasing (style, not fact)

This is distinct from the no-fabrication rule (which catches invented
*facts*). Humanization catches a true fact dressed in oversized language:

```
Evidence: added a Redis cache in front of the /search endpoint
(FACT — src/api/search.ts:40-58).

❌ Played a pivotal role in transforming search performance.
✓  Added a Redis cache in front of the /search endpoint.
```

Never let a humanization pass increase the strength of a claim — only
reduce inflation, never reintroduce it as "more natural-sounding"
exaggeration.

### F. Forced triads

```
❌ improves reliability, performance, and developer experience
   (evidence only supports two of the three)
✓  improves reliability and performance
```

Use exactly as many items as the evidence supports — never pad or trim a
list to hit three.

### G. Excessive em dashes

```
❌ Rebuilt the service in TypeScript — reducing type errors in prod — and
   cut the deploy time in half.
✓  Rebuilt the service in TypeScript, which reduced type errors in
   production and cut deploy time in half.
```

If the repository's existing docs or a supplied Epic naturally use em
dashes, preserve that style rather than forcing it out.

### H. Repetitive sentence structure

```
❌ Added the cache. Added the retry logic. Added the circuit breaker.
✓  Added the cache, retry logic, and a circuit breaker.
```

Vary structure only where it doesn't cost clarity — a flat list of
parallel Acceptance Criteria or ticket bullets is often *supposed* to be
structurally uniform; don't force variation onto a format where uniformity
is the convention (see §4, Jira Tickets).

---

## 3. What Humanization Must Never Touch

Never modify, in the course of a humanization pass:

- FACT/INFERENCE/HYPOTHESIS/UNKNOWN classification tags
- `[PLACEHOLDER]`, `[ASSUMPTION]`, `[UNKNOWN]`, `[HYPOTHESIS]` markers
- `MUST`/`SHOULD`/`COULD` recommendation strength and Critical/High/Medium/
  Low severity labels
- numbers, percentages, counts, before/after measurements, dates
- URLs, file paths, commit hashes, ticket/branch IDs
- company names, product names, team names
- languages, frameworks, libraries, tools, API/package names (e.g. don't
  turn `React` into "a frontend library")
- job/role terms used in Jira ticket "As a `<role>`" statements
- markdown structure — headings, bullet/numbered lists, tables, code
  blocks, inline code, diagrams

If a candidate rewrite would touch any of the above, skip that rewrite and
leave the sentence as generated.

---

## 4. Per-Artifact Calibration

The [Artifact Voices table](documentation-framework.md#artifact-voices)
already sets tone per document; this sets how much this pass should
intervene, using the same document set:

| Artifact | Intervention level | Why |
|---|---|---|
| Initiative | Medium | Narrative Problem/Why-It-Matters prose — full pattern pass from §2 |
| Epic | Medium | Business-value/technical-value prose — full pattern pass |
| Tech Spec | Light | Precision matters more than style; only fix obviously templated phrasing (§B, §C) in prose sections — never touch architecture/design language |
| ADR | Light | Rationale/consequences are decision records, not narrative — fix templated framing only, preserve the exact reasoning as stated |
| Jira Ticket | Minimal | Acceptance criteria and "As a/I want/So that" are conventionally uniform and machine-parseable-ish; only clean up a Description paragraph if it reads like boilerplate |
| Release Ticket | Minimal | Operational checklist format — uniformity is the point, don't vary it |
| Stakeholder Report | Medium | Written for non-engineers; benefits most from removing generic framing/conclusions and inflated language |
| Onboarding doc | Medium | Written for a person catching up on a branch — full pattern pass |
| Branch Review | Light | Findings are evidence-backed and precise; only clean up templated intro/conclusion sentences, never the finding text itself |
| MR Description | Light | Summary/problem/changes prose can be humanized; the Acceptance Criteria table and checklist stay untouched |

Default, if an artifact isn't listed above: medium.

---

## 5. Process

1. Generate the document normally, following
   [documentation-framework.md](documentation-framework.md)'s per-document
   structure and the evidence discipline in
   [SKILL.md](../SKILL.md) / [evidence-and-analysis.md](evidence-and-analysis.md).
2. Before finalizing, re-read each prose sentence against §2. Flag only
   sentences that actually match a pattern.
3. Rewrite flagged sentences only, at the intervention level in §4 for that
   artifact type.
4. Re-check every rewritten sentence against §3 (never-touch list) — a
   rewrite must express the exact same claim as before, not a stronger or
   weaker one, and must not have dropped or altered any marker.
5. If a rewrite can't be made without risking §3 or the no-fabrication
   rule, discard the rewrite and keep the original sentence. A
   humanization pass that corrupts content is worse than no pass at all —
   correctness always wins over polish.

---

## 6. Validation Checklist

Before finalizing output:

- [ ] No fact, number, date, URL, path, or technical term changed by the
      humanization pass
- [ ] No claim got stronger or weaker than what the evidence supports
- [ ] FACT/INFERENCE/HYPOTHESIS/UNKNOWN tags and `[PLACEHOLDER]`-style
      markers unchanged
- [ ] MUST/SHOULD/COULD and severity labels unchanged
- [ ] Markdown/table/code-block structure unchanged
- [ ] Only sentences that actually matched a §2 pattern were touched
- [ ] Sentences that already sounded natural were left alone
- [ ] Acceptance criteria, checklists, and structured template fields were
      not rewritten (per §4)

---

## 7. Not a Detection-Evasion Tool

This layer exists to make codeProMax's own output read like something a
person actually wrote — not to help any output evade AI-detection systems.
Evidence-based, non-inflated writing is the goal in its own right, per the
no-fabrication rule in [SKILL.md](../SKILL.md) and the
[Writing Constitution](documentation-framework.md#writing-constitution);
humanization is a readability layer on top of already-truthful content,
nothing more.
