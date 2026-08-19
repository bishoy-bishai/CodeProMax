# Code Pro Max — Evidence Type Classification

> **Phase 1.1 — Evidence Collector & Root Cause Analyzer**

---

## Overview

Evidence is the epistemic foundation of Code Pro Max.
Every finding, score, and initiative must be backed by traceable evidence.
This document defines each evidence type, when to use it, and how it is collected.

---

## Evidence Types

### `code` — Direct Source Code Observation

**Definition:** Evidence obtained by statically inspecting source files.

**When to use:**
- A problem is directly observable in the source (large function, missing try-catch, import count)
- The finding does not require runtime execution to verify

**Collector:** `EvidenceCollector.collectCodeEvidence()`

**Detected patterns:**

| Pattern | Detection method | Confidence |
|---|---|---|
| Large function | Line count + cyclomatic complexity | 3–4/5 |
| Missing error handling | Async function + absent try-catch | 4/5 |
| High coupling | Import statement count per file | 3/5 |
| Code smells | File line count, parameter count | 2–3/5 |
| Duplicated code | Sliding-window Dice similarity (≥ 85%) | 3/5 (INFERENCE) |

**Thresholds:**
- Large function: ≥ 50 lines OR cyclomatic complexity ≥ 15
- High coupling: ≥ 10 import statements
- God file: ≥ 500 lines
- Many parameters: ≥ 6 parameters
- Duplicate block: ≥ 8 consecutive lines, ≥ 85% similarity

---

### `git` — Version Control History

**Definition:** Evidence derived from git commit history, blame, and log analysis.

**When to use:**
- A finding relates to file stability, ownership concentration, or recurring failures
- The problem has a historical pattern (repeated fixes, high churn)

**Collector:** `EvidenceCollector.collectGitEvidence()`

**Detected patterns:**

| Pattern | Detection method | Confidence |
|---|---|---|
| High churn file | Commit count in 6 months ≥ 50 | 4/5 (FACT) |
| Repeated fixes | Fix/bug/patch keywords in commit subjects | 3/5 (INFERENCE) |
| Dead code | Last commit date > 12 months ago | 3/5 (INFERENCE) |
| Single-owner bottleneck | Only 1 unique author in recent commits | 4/5 (FACT) |

**Git command used:**
```bash
git log --format="%H|%aI|%s|%an" --follow -- <file>
```

**Graceful degradation:** If git is unavailable or the path is not in a repository,
the collector records a warning and continues. No findings are fabricated.

---

### `test` — Test File & Coverage Analysis

**Definition:** Evidence derived from test files, coverage configuration, and test patterns.

**When to use:**
- A finding relates to test coverage gaps or missing error-path tests
- The problem is that untested code is deployed

**Collector:** `EvidenceCollector.collectTestEvidence()`

**Detected patterns:**

| Pattern | Detection method | Confidence |
|---|---|---|
| No test files | Zero `*.test.*` or `*.spec.*` files found | 5/5 (FACT) |
| Low test ratio | Test files / source files < 50% | 3/5 (INFERENCE) |
| No error-path tests | No throw/reject/toThrow in test body | 3/5 (INFERENCE) |
| No coverage config | No coverage threshold in vitest/jest config | 4/5 (FACT) |

**File patterns recognized as tests:**
- `*.test.ts`, `*.test.js`, `*.spec.ts`, `*.spec.js`
- Files inside `__tests__/` directories

---

### `dependency` — Package Manifest Analysis

**Definition:** Evidence derived from package manager manifests (`package.json`, `go.mod`, etc.).

**When to use:**
- A finding relates to third-party package risk: deprecated, outdated, or functionally duplicated

**Collector:** `EvidenceCollector.collectDependencyEvidence()`

**Detected patterns:**

| Pattern | Detection method | Confidence |
|---|---|---|
| Deprecated package | Known-deprecated package list | 5/5 (FACT) |
| Functional duplicate | Two packages from the same functional group present | 5/5 (FACT) |
| Outdated (major) | Major version < 2 for non-@types packages | 5/5 (FACT) |

**Known deprecated packages (selected):**

| Package | Reason |
|---|---|
| `moment` | Deprecated in favour of `dayjs`, `date-fns`, `luxon` |
| `request` | Deprecated; no security patches |
| `bluebird` | Native Promises make this redundant |
| `tslint` | Replaced by `eslint` with TypeScript plugins |
| `node-sass` | Replaced by `sass` (Dart Sass) |
| `grunt` / `bower` | Replaced by modern build tools |

**Functional duplicate groups:**

| Group | Members |
|---|---|
| HTTP clients | axios, node-fetch, got, request, superagent, ky |
| Utility libs | lodash, underscore, ramda |
| Date libs | moment, dayjs, date-fns, luxon |
| Promise libs | bluebird, q, when |

---

### `runtime` — Profiling & Observability Data

**Definition:** Evidence obtained from running systems (logs, metrics, traces, profiles).

**When to use:**
- A finding is about production behaviour (latency, error rates, memory usage)
- Code inspection alone cannot confirm the problem

**Collector:** Not yet automated (Phase 2). Currently added manually.

**Classification:** Usually `FACT` (highest epistemic value when corroborated with `code`).

> **Note:** When both `runtime` and `code` evidence are present, the `EvidenceClassifier`
> assigns confidence **5/5** — the maximum. This is the evidence combination to aim for.

---

### `config` — Configuration File Analysis

**Definition:** Evidence derived from configuration files (CI configs, linter rules, tsconfig, etc.).

**When to use:**
- A finding relates to the absence of a quality gate (no coverage threshold, no lint rule)
- The configuration state directly substantiates the claim

**Collector:** Produced internally by test and dependency collectors.

---

### `documentation` — Documentation & ADR Analysis

**Definition:** Evidence derived from README, ADR, wiki, or code comments.

**When to use:**
- A finding relates to missing or contradictory documentation
- The root cause chain reaches the "no policy/ADR" level

**Collector:** Not yet automated. Currently added manually.

---

## Classification Rules

| Classification | Condition |
|---|---|
| **FACT** | Direct observation via `code`, `test`, or `runtime` |
| **FACT** | Multiple independent source types, at least one direct |
| **INFERENCE** | 2+ independent source types, none direct |
| **HYPOTHESIS** | Single indirect source (`git`, `config`, `documentation`) |
| **UNKNOWN** | Insufficient evidence to classify |

See [`src/core/algorithms/evidence-classifier.ts`](../src/core/algorithms/evidence-classifier.ts)
for the complete rules-based implementation.

---

## Confidence Rules

| Confidence | Condition |
|---|---|
| **5/5** | `runtime` + `code` both present |
| **4/5** | 2+ independent source types |
| **3/5** | 1 direct-observation source |
| **2/5** | Multiple items, single indirect type |
| **1/5** | Single indirect source or UNKNOWN |

Confidence is **reduced** for:
- Each contradiction detected between evidence records (`-1` per contradiction)
- All evidence unvalidated (`-1`)
- Minimum always clamped to **1/5**

---

## Root Cause Analyzer — 5 Whys

The root cause analyzer applies a deterministic knowledge base of cause chains.

### Termination Conditions (in priority order)

| Condition | When |
|---|---|
| `systemic-actionable` | Cause is structural AND an engineering team can address it ✓ |
| `evidence-gap` | Cannot drill deeper without additional evidence |
| `too-speculative` | Next level confidence would be ≤ 1 |
| `max-depth-reached` | Hit the 7-level maximum |
| `self-evident` | Cause requires no further explanation |

### Output Example

```
=== Root Cause Analysis: FIND-001 ===
Symptom: Async function "deleteProduct" (lines 92-99) has no try-catch block.

Level 1: Errors are silently dropped or not propagated at the call site...
  Confidence: 4/5 | Systemic: no | Actionable: yes
  Evidence: 1 record(s) of type(s): code

Level 2: No shared error-handling middleware or wrapper...
  Confidence: 3/5 | Systemic: yes | Actionable: yes
  Evidence: 1 record(s) of type(s): code

Level 3 [ROOT CAUSE]: No standardized error contract was defined...
  Confidence: 3/5 | Systemic: yes | Actionable: yes
  Evidence: 1 record(s) of type(s): documentation

Overall confidence: Medium
Termination reason: systemic-actionable
Depth: 3 Why level(s)
```

### Quality Guarantees

- **Never person-blames** — causes are systemic, not individual mistakes
- **Always actionable at root** — every chain terminates with something engineering can address
- **Evidence-linked** — every cause level references the finding's evidence records
- **Depth-bounded** — never exceeds 7 levels

---

## Performance Targets

| Collector | Target |
|---|---|
| `collectCodeEvidence` | < 1 min for 100K LOC |
| `collectGitEvidence` | < 2 min for 1,000 commits |
| `collectTestEvidence` | < 30 sec |
| `collectDependencyEvidence` | < 10 sec |
| **`collectAll` (combined)** | **< 5 min** |

### Performance mechanisms

- Files > 1 MB are skipped with a warning
- File reads are batched (20 concurrent I/O operations)
- Git processes are batched (10 concurrent processes)
- Duplicate detection uses Dice coefficient on normalized blocks (no O(n³) comparison)

---

## Extending the Collectors

All collectors follow the same pattern:

```typescript
// Add a new detection rule to collectCodeEvidence:
function detectMyNewPattern(source: string, filePath: string): CodeIssue[] {
  // ... detection logic
  return issues;
}

// Then add to the per-file analysis loop in EvidenceCollector.collectCodeEvidence()
```

To add a new known-deprecated package:
```typescript
// In evidence-collector.ts
const DEPRECATED_PACKAGES: ReadonlySet<string> = new Set([
  // ... existing entries
  "my-deprecated-package",
]);
```
