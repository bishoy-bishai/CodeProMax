# Evidence & Analysis Reference

Supports [SKILL.md](../SKILL.md) Phase 1 (Discover) and the evidence rules
used throughout planning.

---

## Analytical Framework

Reasoning chain: **Observation → Evidence → Interpretation → Impact → Root
Cause → Opportunity → Alternatives → Recommendation → Execution →
Measurement.**

Every important technical claim must be supported by repository evidence:
files, directories, components, functions, dependencies, configuration,
tests, metrics, or other observable facts.

### Fact vs Inference vs Hypothesis

- **Fact** — directly observed in the repository or supplied context.
- **Strong inference** — a conclusion supported by multiple observations.
- **Hypothesis** — plausible but unverified.
- **Unknown** — cannot be established from available evidence.

Unknowns required for planning become explicit `[PLACEHOLDER]` items.

---

## §01 — Repository Reconnaissance

**Objective:** build a reliable mental model of the repository before making
improvement recommendations. **Principle: understand before judging.**

**Repository identification** — determine application type, languages,
frameworks, runtime(s), package manager, build system, repo model (single /
monorepo / multi-service), deployment model. Inspect README, package
manifests, lockfiles, compiler/build config, Docker/deployment files, CI
config, workspace config. Don't rely on README alone.

**Repository mapping** — map major structural/architectural areas
(applications, services, packages/libraries, infrastructure, data layer,
workers, CLI tools, documentation). Don't assume every directory is an
architectural boundary.

**Entry points** — web/API bootstrap, CLI entry points, workers, scheduled
jobs, event consumers, message handlers, routes, server initialization.

**Architecture discovery** — major components, architectural boundaries,
ownership boundaries where evident, dependency relationships, communication
patterns, business-logic locations, validation/persistence/external-system
boundaries. Don't infer an architecture pattern merely from naming
conventions — distinguish facts from inferences.

**Data flow discovery** — trace representative critical flows across
relevant layers (UI → API → business logic → persistence → external
systems). For each important flow: input, validation, transformation,
business logic, persistence, external dependencies, output, error handling.

**Dependency mapping** — internal and external dependencies; classify where
evidence supports it as critical, optional, high-coupling, or a potential
single point of failure. A dependency's presence is not itself a problem.

**Quality system** — unit/integration/e2e/contract/component/performance
tests, type checking, linting, security scanning, dependency scanning, build
validation.

**CI/CD discovery** — PR checks, build pipeline, test pipeline, deployment,
environment promotion, release process, feature flags, DB migrations,
rollback strategy.

**Observability discovery** — logs, metrics, traces, error tracking,
dashboards, alerts, SLI/SLO definitions, health checks, correlation/request
IDs, profiling. **Distinguish tool presence from actual usage** — an
installed dependency doesn't prove it's configured, instrumented, or
operationally used. See the Observability Evidence Model below.

**Documentation & knowledge** — README, architecture docs, ADRs, RFCs,
design docs, contributing guides, runbooks, deployment docs, API docs.
Compare documented architecture with observed implementation where possible.

**Sampling strategy** — you don't need to read every file. Always inspect
root config, package manifests, lockfiles, build/CI/deployment/test/lint
config, entry points, environment examples. Then sample representative
features, APIs/services, data models, tests, shared utilities, integrations.
Deep-dive only when evidence creates a meaningful investigation signal.

**Reconnaissance stop condition** — before moving to evidence collection,
you should be able to answer: what does the system do; what are its major
boundaries; where does execution start; how does data move; where is
business logic; where is persistence; how is it tested; how is it built and
deployed; how is it observed; what are the major constraints. If an answer
is unavailable, mark it `UNKNOWN`.

**Output:** reconnaissance produces **Signals**, not Initiatives — concise,
evidence-oriented observations worth investigating further, not yet
validated findings.

---

## §02 — Evidence Collection

**Objective:** determine whether a signal represents a real, significant
problem and establish confidence before creating a validated finding.

**Evidence types:**
- **Static** — code, architecture, configuration, dependencies, tests, CI
  config, documentation.
- **Runtime** — logs, metrics, traces, profiling, error tracking, production
  incidents.
- **Historical** — git history, repeated fixes, reverts, churn, hotspots,
  TODO/FIXME patterns, previous incidents.
- **Human/project** — ADRs, RFCs, requirements, documented constraints,
  explicit project context.

**Evidence strength tiers:**
1. **Direct** — production metric, failing test, concrete code behavior.
2. **Corroborated** — multiple independent signals agree.
3. **Indirect** — strong architectural indication.
4. **Hypothesis** — plausible but unverified.

**Triangulation** — where appropriate, correlate multiple evidence sources
(e.g. code evidence + git churn + missing tests) rather than relying on one.

**Static vs runtime** — when reliable runtime evidence exists, use it when
evaluating production claims. Example: static code suggests an N+1 query;
runtime traces confirming elevated p99 latency on the same endpoint
upgrades the claim to FACT. Without runtime evidence, the same code pattern
is a HYPOTHESIS pending validation — say so explicitly.

**Evidence gaps** — record missing evidence explicitly; it lowers
confidence, it is never silently replaced by an assumption.

**Contradicting evidence** — actively check whether evidence contradicts the
signal. Don't keep a problem claim alive on suspicious-looking static code
when runtime evidence demonstrates otherwise.

**Signal → Validated Finding gate** — a signal becomes a validated finding
only when it has at least one Tier 1–2 piece of evidence, or 2+ independent
Tier 3 sources with no contradicting evidence. Failure result: **NEEDS MORE
EVIDENCE**, not an Initiative.

---

## §03 — Root Cause Analysis

**Objective:** identify causes that explain why the problem exists and that
can be changed to reduce recurrence.

**Causal classification:**
- **Symptom** — what we observe.
- **Proximate/immediate cause** — the direct cause.
- **Contributing factors** — conditions that enabled or amplified it.
- **Root cause** — a deeper systemic condition explaining why the problem
  exists or persists.

**5 Whys** — use when it benefits from root-cause analysis. Five is a
heuristic, not a mandatory count — stop when further questioning becomes
speculative or stops producing a useful systemic cause. Cap at 7 levels.

**Multiple root causes** — don't force a complex problem into one root
cause; model multiple root causes/contributing factors where evidence
supports them.

**Root cause vs blame** — never person-blame ("the developer forgot to...").
Prefer systemic explanations: missing boundaries, contracts, safeguards,
ownership structures, automation.

**Root cause quality** — specific, evidence-backed, actionable, systemic,
appropriately scoped. Avoid vague labels ("technical debt", "bad
architecture") without a concrete causal explanation.

**Alternative explanations** — before confirming a root cause, ask whether
another explanation could account for the finding. If evidence can't
distinguish between plausible causes, mark the root cause **uncertain** and
name the investigation needed.

**Root cause gate** — a root cause is ready to feed Opportunity Definition
only when it is systemic-actionable (an engineering team could address it)
or explicitly marked evidence-gap / too-speculative / self-evident, with the
termination reason stated.

---

## §04 — Finding Confidence & Validation

Shared by any operation in this skill that produces a list of discrete
findings — Discover's Top 5 opportunities and the branch review operation
(see [branch-operations.md](branch-operations.md)) both use this.

**The subject is what actually exists, not presumed intent.** Code, tests,
repository configuration, and git history are authoritative for what a
system *does*. Commit messages, TODOs, comments, ticket titles, branch
names, and PR descriptions are context for *intent* — useful for
understanding why something was attempted, never proof that it was
implemented correctly. Never turn an intent signal into an implementation
fact.

**Finding confidence tiers** (distinct from the Fact/Inference/Hypothesis
classification used for Initiative problem statements — this is for
discrete findings within a review-style output):
- **Confirmed** — the cited code/config/test directly demonstrates the
  issue; no interpretation required. Can justify `MUST`.
- **Likely** — strong circumstantial evidence (pattern matches a known
  failure mode, corroborated by 2+ independent signals) but not directly
  observed failing. Should normally cap at `SHOULD`.
- **Potential** — plausible but thin; single weak signal. Should normally
  cap at `COULD`, or be discarded rather than reported.

**Finding validation** — before any finding is included in output, verify:
1. It has an exact `file:line` location (or equivalent precise locator).
2. The cited code/content actually exists at that location as described.
3. The snippet directly supports the claim — not adjacent or unrelated
   code.
4. It isn't merely a style/taste preference presented as a defect.
5. A concrete failure scenario can be stated when the finding claims a bug
   (what input/state triggers it, what happens, what the user/system
   experiences) — vague language like "this could cause problems" fails
   validation.
6. It isn't a duplicate of another finding already included.
7. Its confidence tier justifies its assigned strength (`MUST`/`SHOULD`/
   `COULD` — see `documentation-framework.md`'s Recommendation Strength).
8. It's actually relevant to the material under review (the diff, or a
   directly affected consumer) — not a pre-existing issue merely noticed
   in passing, unless the operation's scope explicitly includes that.

If any check fails, discard the finding or downgrade its confidence/
strength — don't include it as-is.

**Deduplicate root causes, not just wording.** If one underlying defect
produces symptoms visible in multiple categories (e.g. one bad API design
causes an architecture leak, a correctness bug, and a test gap), report it
once under the most actionable category and note the secondary
consequences inside that same finding, rather than three separate entries.

**Never fabricate a finding to look thorough.** An empty category — no
security issues, no performance issues — is a valid, honest result. Padding
output with "no issues found in X" for every unused category is the
opposite of what evidence-based reporting requires; simply omit categories
with nothing to report, while still confirming internally that each was
actually considered (see the calling operation's own coverage-tracking
rule, if it has one).

---

## Observability Evidence Model

Observability is first-class reconnaissance. **Do not infer production
reality from code when reliable runtime evidence is available**, and do not
claim a confirmed production bottleneck when only static code evidence
exists.

**Reasoning:**
```
Static evidence (code) → suggests a hypothesis about production behavior
Runtime evidence (logs/metrics/traces) → confirms or refutes that hypothesis
```

Example: "Code review shows synchronous DB calls in a hot path
(code, FACT). Trace data shows p99 latency of 2.4s on the same endpoint
(runtime, FACT) → corroborated finding, confidence 5/5."

When runtime evidence is unavailable: "Code review shows synchronous DB
calls in a hot path (code, FACT). No tracing/APM configured — production
latency impact is `[UNKNOWN: no runtime evidence available]`. Treat as
HYPOTHESIS pending instrumentation."

**Reconnaissance observability checklist:** logging strategy, metrics,
distributed tracing, error tracking, dashboards, alerts, SLI/SLO
definitions, performance telemetry, runtime profiling, correlation/request
IDs, production health signals. The *absence* of observability is itself a
potential finding — but distinguish absence of evidence from evidence of
failure.

**Reference hierarchy for observability analysis:** repository/production
evidence first; then OpenTelemetry signal taxonomy (traces, metrics, logs,
baggage, profiles) as the technical vocabulary; then general SRE monitoring
principles (SLIs/SLOs, meaningful alerting, symptom vs cause) as reasoning
guidance. These guide analysis — they never override what the repository
and its telemetry actually show.
