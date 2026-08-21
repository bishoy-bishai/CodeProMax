# Tech Spec Quality Standard

Supports [SKILL.md](../SKILL.md) Phase 3, document 3
([templates/tech-spec.md](../templates/tech-spec.md)).

The Tech Spec is the central engineering design artifact. It must do more
than describe the chosen implementation — it should make the problem,
design, trade-offs, risks, and delivery strategy reviewable **before**
implementation begins.

## Quality Criteria

1. **Problem framing first** — start with technical/business context,
   current state, the actual problem, who/what is affected, why it matters.
   Do not begin with the proposed solution.
2. **Traceability & completeness** — cover the relevant end-to-end data and
   control flow (UI/schemas → APIs/services → validation → storage → DB).
   Every major design decision should trace to a requirement, problem,
   constraint, or piece of evidence.
3. **Trade-off analysis** — the chosen solution is not presented as the only
   possible answer. Document meaningful alternatives, their pros/cons, why
   rejected, and the trade-offs accepted by the chosen approach (link to the
   ADR — [templates/adr.md](../templates/adr.md) — for architecturally
   significant decisions).
4. **Failure modes & edge cases** — network failures, timeouts, rate limits,
   partial failures, invalid input, concurrent updates, data conflicts,
   unavailable dependencies, rollback/migration failures.
5. **Security & NFRs** — authN/authZ, data protection/privacy, encryption
   where relevant, input validation/sanitization, secrets/sensitive data
   handling, latency/throughput expectations, caching strategy, reliability/
   availability, scalability, observability, accessibility/compatibility
   where relevant.
6. **Actionable, phased rollout** — translate the design into milestones/
   phases with safe delivery mechanisms: feature flags, gradual rollout,
   migration sequencing, validation checkpoints, monitoring, rollback plan.

## Anatomy

Include sections as relevant to the problem — **don't force irrelevant
sections into a document.**

- **Metadata** — Project/Initiative, Author, Reviewers, Status
  (Draft/In Review/Approved), Last Updated. Unknown metadata is
  `[PLACEHOLDER]`, never invented.
- **Context & Goals** — Goals (what this design should achieve); Non-Goals
  (explicitly out of scope, to prevent scope creep); Success Metrics (the
  scoring breakdown + functional success criteria).
- **Current State** — architecture, behavior, constraints, dependencies,
  from repository evidence; `[UNKNOWN: ...]` when no such evidence exists.
- **Architecture & Data Flow** — the relevant architecture and end-to-end
  flow. Use diagrams (see Diagramming Standard below) where they improve
  understanding: sequence, component, architecture-flow, data-flow, or
  state diagrams.
- **API Contracts** (where applicable) — endpoints, methods, request/
  response payloads, auth requirements, validation rules, error codes/
  shapes, backward-compatibility considerations.
- **Data Models** (where applicable) — types, schemas, DB models, validation
  rules, relationships, migration requirements, data ownership.
- **Security, Performance & Scalability** — security boundaries,
  permissions, data protection, validation/sanitization, expected latency/
  throughput, capacity assumptions, bottlenecks, caching, scalability
  limits, abuse/failure scenarios. **Never invent numerical targets** — use
  `[PLACEHOLDER]` when unknown.
- **Testing Strategy** — unit, integration, e2e, contract tests where
  relevant, migration/data validation tests where relevant, failure-path
  testing. Connect directly to requirements and acceptance criteria.
- **Rollout & Observability** — deployment/rollout phases, feature flags,
  migration sequencing, logging/metrics/tracing, dashboards/alerts,
  validation checkpoints, rollback strategy, post-release verification.
- **Open Questions** — the initiative's open questions, or
  `[UNKNOWN: ...]` if none recorded.
- **Related Artifacts** — links to Initiative, Epic, ADR, tickets, release
  ticket.

## Diagramming Standard

Diagrams are first-class documentation. Prefer a diagram when a flow or
relationship is easier to understand visually than in prose.

- **Mermaid — default.** Use for architecture flows, sequence diagrams, data
  flows, state machines, lifecycle diagrams, dependency relationships,
  decision flows.
- **PlantUML — when justified.** Use when the repository already uses
  PlantUML, the team has an established PlantUML convention, or a more
  complex UML model is justified.

## Review Gate

Before a Tech Spec is ready for implementation, validate:
- Problem framed before solution.
- Goals and non-goals explicit.
- Current state supported by repository evidence.
- Proposed architecture understandable; relevant end-to-end flow traceable.
- API/data contracts defined where applicable.
- Security and relevant NFRs addressed.
- Failure modes and edge cases considered.
- Meaningful alternatives documented, with trade-offs and rejected options
  explained.
- Testing strategy covers intended behavior and failure paths.
- Rollout and rollback are actionable.
- Observability and success measurements defined.
- Open questions/unknowns are explicit `[PLACEHOLDER]` items.
- The design can be decomposed into implementation-ready work (feeds
  [invest.md](invest.md) / [story-decomposition.md](story-decomposition.md)).

## Reference Library

- *Design Docs at Google* (Malte Ubl) — design documentation, architecture
  discussion, review before implementation.
- *The Pragmatic Engineer* (Gergely Orosz) — RFCs, design documents,
  engineering decision-making at scale-ups/Big Tech.
- Rust RFCs & React RFCs (GitHub) — how mature technical communities
  document, debate, review, and evolve complex decisions.
- *Software Engineering at Google* (Titus Winters et al.) — engineering
  practices, design documentation, review processes, maintainability.

Reference models, not templates to copy blindly — repository conventions,
project constraints, and direct evidence take precedence.
