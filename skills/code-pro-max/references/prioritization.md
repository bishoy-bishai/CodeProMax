# Prioritization & Decision Framework Reference

Supports [SKILL.md](../SKILL.md) Phase 1 (ranking opportunities) and Phase 5
(drift/reassessment). Continues from
[evidence-and-analysis.md](evidence-and-analysis.md) §03 Root Cause.

Borrows the *useful* principles of scoring and explainability from risk/ML
systems, without pretending engineering prioritization is a precise ML
problem. Goal: an evidence-based, explainable, calibrated way to help the
user decide what's worth improving. **Simple before complex** — start with
an interpretable heuristic model; don't introduce sophisticated ranking
unless real-world use demonstrates the simple model is insufficient.

---

## §04 — Opportunity Definition

**Objective:** transform a root cause into a meaningful improvement
opportunity without prematurely selecting an implementation.

Each opportunity answers: What can be improved? Who benefits? Why now? What
outcome could change? What evidence supports it?

**Opportunity ≠ solution.** An opportunity describes what should become
better; a solution describes how. E.g. Opportunity: "Improve production
error visibility." Possible approaches: structured logging, centralized
error tracking, standardized telemetry, or a hybrid.

**Multiple approaches** — where meaningful, consider minimal, incremental,
strategic, buy/adopt, build, and do-nothing. Don't force categories that
don't apply.

**Scope** — every candidate opportunity defines In Scope / Out of Scope.
Don't turn every improvement into an unlimited architecture initiative.

**Expected outcome** — describe outcomes, not implementation activity. Use
measurable targets only when evidence supports them; otherwise
`[PLACEHOLDER]`.

**Opportunity gate** — ready to rank only when it has a stated scope,
non-scope, at least one measurable-or-placeholder success criterion, and
traces to a root cause from §03.

**Opportunity landscape** — group by domain (Architecture, Testing,
Observability, Performance, Developer Experience, Security, Reliability,
etc.) relevant to the repo. Don't force artificial diversity into the final
ranking.

---

## §05 — Alternatives & Decision Analysis

**Objective:** explore meaningful alternatives before committing to an
approach.

**Alternative types:** Minimal, Incremental, Strategic, Buy/Adopt, Build, Do
Nothing. Consider Do Nothing / status quo for meaningful decisions.

**Decision criteria (use only relevant ones):** Value, Effort, Risk,
Complexity, Time to Value, Maintainability, Scalability, Reliability,
Security, Operational Cost, Reversibility, Migration Cost, Team Familiarity.

**Trade-off analysis** — document comparative advantages, disadvantages,
costs, risks, consequences. Comparative scores are decision aids, not facts,
unless backed by measurement.

**Decision principles** — choose for the actual system and constraints, not
popularity; prefer proportional solutions; consider reversibility; consider
where complexity moves (not just whether it disappears); consider
operational impact; avoid vendor/technology/resume-driven bias; avoid false
precision.

**Validation/spike** — if the decision can't be made with available
evidence, don't guess. Mark **NEEDS VALIDATION** and define the spike/
experiment/investigation required.

**Decision record** (feeds the ADR — [templates/adr.md](../templates/adr.md)):
options considered, selected option, why, trade-offs, consequences.

**Decision gate** — ready to score only when at least one meaningful
alternative was considered (or explicitly ruled out as N/A) and, if
undecided, marked NEEDS VALIDATION with a defined next step.

---

## §06 — Initiative Prioritization & Scoring

**Objective:** rank validated opportunities by expected value, evidence
quality, cost, risk, and urgency. **The score supports the decision — it
does not make the decision.**

**Input contract** — the scoring step consumes a validated finding, root
cause, opportunity, and relevant alternatives/chosen direction. Raw code
smells are never ranked directly as initiatives — they must pass through
§02–§05 first.

**Core signals (use only what's relevant):** Impact, Urgency, Confidence,
Frequency/Reach, Developer Pain, User Impact, Business Impact, Operational
Impact, Effort, Risk.

**Impact model** — evidence-backed across relevant dimensions: User,
Business, Engineering, Operational.

**Value score (simple, transparent MVP model):**
```
value = weighted_sum(impact, urgency, confidence, developer_pain, reach)
```
Then apply transparent cost/risk adjustments:
```
opportunity_score = round(value / (effort_factor + risk_factor) * scale)
```
This mirrors the additive/inverted-cost approach: higher effort and risk
pull the score down, never up. The model is intentionally simple — it does
not imply scientific precision. Document the exact weights you used in the
Decision Trace so the arithmetic is reproducible.

**Effort & risk** — use broad ranges (XS/S/M/L/XL) or evidence-backed
ranges. Never invent precise story points, dates, or capacity assumptions.

**Confidence** — must reflect evidence quality (tie to the evidence tiers in
[evidence-and-analysis.md](evidence-and-analysis.md)). High impact with weak
evidence should not automatically outrank a well-supported moderate-impact
opportunity.

**Score confidence** (separate from the confidence signal) — `High` /
`Medium` / `Low`, based on evidence tier and corroboration count.

**Priority tiers (default policy, configurable):**

| Tier | Typical score band |
|---|---|
| P0 — Critical | ≥ 85, or strategic override |
| P1 — High | 65–84 |
| P2 — Medium | 45–64 |
| P3 — Low | < 45 |

**Strategic override** — strategic, security, regulatory, or other
mandatory constraints may override the numerical ranking. Every override
requires an explicit reason and, where relevant, an owner/approver
`[PLACEHOLDER]`.

**Decision trace** — every ranked initiative explains its position:

```
Impact 4/5 — High business value: this is on the checkout critical path (evidence: code, src/checkout/pay.ts:40-90).
Confidence 4/5 — Two independent evidence types corroborate (code + git high-churn).
Urgency 3/5 — Moderate cost of delay; no active incident.
Effort M, Risk Low.
Score: weighted value 78, cost/risk adjustment -6 → 72 (P1 — High).
Score confidence: High (2 evidence records, one direct observation).
```

**Reason codes** — where useful, surface the strongest contributing reasons
(e.g. `HIGH_CHURN`, `NO_ERROR_HANDLING`, `PRODUCTION_INCIDENT_LINKED`,
`SINGLE_OWNER_BOTTLENECK`) alongside the trace, as an auditable summary.

**Ranking output:**

| Rank | Initiative | Score | Confidence | Effort | Risk |
|---|---|---|---|---|---|
| 1 | ... | 84 | High | M | Medium |
| 2 | ... | 81 | High | M | Low |

The Top 5 are recommendations, not automatic approvals — **the user retains
final prioritization authority.**

**Scoring quality gate** — before presenting a ranked list, confirm every
entry has: a validated finding, a stated root cause, an opportunity with
scope/non-scope, at least one alternative considered, and a decision trace
that reproduces the arithmetic.

**Core principle:** prioritize outcomes, not technical activity. "Refactor
40 components" is an activity. "Reduce UI coupling that causes unrelated
features to break on shared-component changes" is an outcome-oriented
opportunity.

---

## Initiative Drift & Reassessment (Phase 5 — Maintain)

Reassess initiatives as the repository and system evolve. Signals that
warrant reassessment:
- Original evidence is no longer true.
- The underlying problem has been resolved.
- System usage or traffic has changed.
- A new bottleneck has replaced the original one.
- Implementation cost or risk has changed.
- New dependencies or constraints appeared.

Report as: "⚠️ Initiative assumptions may no longer be valid. Reassessment
recommended." — with the specific signal that triggered it.

---

## Scoring Principles

- Evidence beats intuition.
- Missing evidence lowers confidence.
- Impact must be tied to a real outcome.
- Effort and risk must affect prioritization.
- Scores explain decisions; they do not replace judgment.
- A high score does not automatically mean the user must choose the
  initiative — the user retains final prioritization authority.

**Reference inspiration only** (not implementation requirements): feature
engineering ≈ initiative signals; feature weights ≈ priority weights;
missing data ≈ evidence gaps; raw score ≈ opportunity score; calibration ≈
score normalization; thresholds ≈ priority tiers; explainability ≈ decision
trace/reason codes; drift monitoring ≈ initiative reassessment. Domain-
specific credit-scoring concepts (Weight of Evidence, Information Value)
don't belong here unless a future use case genuinely requires them.
