# §08 — Documentation Generation Framework

Supports [SKILL.md](../SKILL.md) Phase 3. Continues from
[initiative-lifecycle.md](initiative-lifecycle.md) §07.

**Core principle: one Initiative, multiple audiences, multiple documents,
one source of truth.** All documents trace back to the canonical Initiative
and must not independently invent a different problem, scope, outcome, or
decision.

## Universal Documentation Contract

Every generated document should establish, as applicable: Target Audience,
Purpose, Context, Problem Statement, Scope, Non-Scope, Evidence, Expected
Outcome, Success Metrics, Security Considerations, Non-Functional
Requirements, Edge Cases, Failure Scenarios, Alternatives Considered, Action
Items, Highlights, Blockers & Risks, Open Questions, Traceability. **Don't
force irrelevant sections into a document** — exact sections vary by
artifact.

## Target Audience First

Before writing any artifact, determine: who is reading this? What do they
already know? What decision or action do they need to take? What
information do they need — what can be removed? **Write for the reader, not
the author.**

## Artifact Voices

| Artifact | Primary Audience | Main Question | Voice |
|---|---|---|---|
| Initiative | Engineering + Leadership | Why should we do this? | Strategic + Engineering |
| Epic | Product + Engineering | What outcome are we delivering? | Product + Engineering |
| Tech Spec | Engineers | How will we build it? | Technical + Precise |
| ADR | Engineers / Architects | Why did we choose this? | Decision-focused |
| Jira Ticket | Implementer | What exactly needs to be done? | Actionable + Concise |
| Release Ticket | Engineering / Release | How do we safely ship it? | Operational |
| Stakeholder Report | PO / Leadership | What changed and why does it matter? | Business + Product |

**Don't copy the same content into every artifact.** Each document
transforms the information for its specific audience and purpose.

## Writing Constitution

Generated documentation should be: clear, specific, evidence-based, concise,
professional, direct, audience-aware, explicit about uncertainty, free from
unnecessary jargon, free from generic AI/corporate marketing language.

**Prefer:** "The dashboard makes six API requests when the user changes one
filter."
**Avoid:** "There are several inefficiencies in the current implementation."

Avoid vague filler — *robust, seamless, cutting-edge, revolutionary,
transformative* — unless the word has a precise, defensible meaning here.

**Language** — default is plain professional English unless the user asks
for another language. Technical language is fine for technical audiences;
product/stakeholder documents translate implementation details into
outcomes and impact.

**Recommendation strength:**
- **MUST** — required due to a confirmed high-impact or high-risk problem.
- **SHOULD** — clear value with reasonable confidence.
- **COULD** — useful optional improvement.

Carry confidence alongside recommendation strength where useful — see
[evidence-and-analysis.md](evidence-and-analysis.md) §04's Confirmed/
Likely/Potential tiers for the finding-level version of this.

**Severity is not the same axis as Recommendation Strength.** Severity
(Critical/High/Medium/Low) describes how bad the underlying problem is;
Recommendation Strength describes how confidently backed the finding is.
A confirmed-but-minor issue might be `MUST` fix-before-merge at Low
severity (e.g. a typo in a public API error message); a plausible-but-
unverified issue might be High severity if true but only `COULD` because
confidence is thin. Don't collapse the two into one scale, and never use
`MUST` just because something is undesirable — reserve it for confirmed
correctness, security, or data-integrity problems.

## Security & NFRs

First-class, not an afterthought, in any document that touches design.
Relevant dimensions: Performance, Reliability, Availability, Scalability,
Security, Accessibility, Observability, Maintainability, Compatibility.
Security analysis considers authN/authZ, sensitive data exposure, secrets,
PII, logging, dependency vulnerabilities, attack surface, least privilege
— where relevant to the initiative.

## Edge Cases & Failure Scenarios

Reason explicitly about relevant cases: empty states, partial failures,
timeouts, network failures, duplicate requests, concurrent updates, invalid
input, large datasets, missing dependencies, migration failures, rollback
scenarios. Structure as: **Failure → Detection → User/System Impact →
Behavior → Recovery/Fallback.**

## Alternatives & Decisions

Important technical decisions consider meaningful alternatives before
recommending one. Capture: options considered, selected option, why, trade-
offs, consequences. Use an ADR
([templates/adr.md](../templates/adr.md)) when the decision is
architecturally significant or likely to be revisited.

## Action Items, Highlights, Blockers & Risks

Documents surface decisions and follow-up work clearly. **Highlights**
summarize the most important outcomes. **Action Items** identify concrete
follow-up work. **Risks** describe things that may negatively affect
delivery/outcomes. **Blockers** describe things currently preventing
progress. Unknown owners, requirements, integrations, rollout constraints,
or decisions are `[PLACEHOLDER]`, never invented.

---

## Per-Document Specs

### 08.1 Initiative Document
- **Audience:** Engineering, Product Owner, technical leadership, relevant
  stakeholders.
- **Purpose:** Answer *why should this Initiative exist?*
- **Structure:** [templates/initiative.md](../templates/initiative.md).
  Decision-oriented, not implementation-oriented.

### 08.2 Epic Document
- **Audience:** Product Owner, Engineering Lead, Developers, QA.
- **Purpose:** Answer *what are we trying to deliver?*
- **Structure:** [templates/epic.md](../templates/epic.md). Translates the
  Initiative (why invest?) into bounded deliverable scope (what will we
  deliver?).

### 08.3 Tech Spec
- **Audience:** Senior Engineers, Tech Leads, Architects, implementers, SRE,
  Security, technical reviewers.
- **Purpose:** Answer *how should we build it, and why this design?*
- **Structure & rules:** [tech-spec-standard.md](tech-spec-standard.md).

### 08.4 ADR
- **Audience:** Engineers / Architects, present and future.
- **Purpose:** Answer *why did we choose this?*
- **Structure:** [templates/adr.md](../templates/adr.md) — context,
  options considered, decision, rationale, trade-offs, consequences.

### 08.5 Jira Tickets
- **Audience:** Developer, QA, Product Owner.
- **Purpose:** Answer *what exactly needs to be implemented, and how do we
  know it's correct?*
- **Structure:** [templates/ticket.md](../templates/ticket.md).
- **Generate the full list, not one representative example.** One ticket
  per Initiative Scope item (sliced further per
  [story-decomposition.md](story-decomposition.md) where a scope item is
  really several vertical slices), each as its own file in `tickets/`.
  Every scope item needs a ticket; every ticket needs a scope item it maps
  back to. Producing only a Release Ticket, or only one ticket for a
  multi-item scope, fails the Phase 4 Validate gate.
- **User story format** (where appropriate):
  ```
  As a <role>
  I want <capability>
  So that <outcome>
  ```
- **INVEST gate:** every ticket validated against
  [invest.md](invest.md) before it's marked implementation-ready.
- **Acceptance criteria:** prefer observable, testable criteria (Given/When/
  Then, or a concrete pass/fail check). Avoid vague criteria like "handles
  errors gracefully" — say what error, what response, what status code.

### 08.6 Release Ticket
- **Audience:** Engineering, Release/Ops.
- **Purpose:** Answer *how do we safely ship it?*
- **Structure:** [templates/release-ticket.md](../templates/release-ticket.md)
  — release objective, changes included, pre-release checklist, rollout
  plan, rollback plan, post-release validation, success metrics.

### 08.7 Stakeholder / Product Owner Report
- **Audience:** Product Owner, leadership, business stakeholders.
- **Purpose:** Answer *what changed and why does it matter?*
- **Structure:** [templates/stakeholder-report.md](../templates/stakeholder-report.md)
  — what changed, why it matters, expected impact, user/customer impact,
  operational impact, risks, rollout status, success metrics. Translate
  implementation detail into business outcomes — no unexplained jargon.

---

## Reference Hierarchy

When guidance conflicts, resolve in this order:
1. Repository and project conventions
2. This skill's documentation constitution (above)
3. Artifact-specific guidelines (this file / linked references)
4. Microsoft Style Guide (clear technical language, plain English, active
   voice, task-oriented writing)
5. Write the Docs principles (audience-first, findability, maintainability)
6. Atlassian Agile Coach / Lenny's Newsletter / Hashnode developer-marketing
   guidance (epics, PRDs, developer-facing storytelling)
7. General model knowledge

**The repository's actual evidence always wins over generic assumptions.**
