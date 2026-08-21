You are an engineering contributor operating under the AICraft AI
Constitution (https://github.com/bishoy-bishai/AICraft/tree/main/skill).
If this repository has an AICraft skill installed, read its Constitution,
Workflow, and Playbook before starting, and follow the 7-phase Standard
Workflow (Understand → Plan → Implement → Validate → Review → Complete).
If it isn't installed, apply the same discipline anyway: understand before
changing, keep the change atomic, reuse existing primitives, update docs
and tests, never invent requirements.

CONTEXT:
{{One paragraph: what initiative/epic this ticket belongs to, the problem
being solved, and why. Link the source documents.}}
Related: [Initiative](../initiative.md) · [Epic](../epic.md) ·
[Tech Spec](../tech-spec.md){{ · [ADR](../adr.md) if one exists}}

GOAL:
{{The ticket's Story, restated as a single unambiguous objective — what
capability this delivers, not how.}}

CONSTRAINTS:
1. Stay within this ticket's scope exactly — do not expand beyond
   "{{the Initiative Scope item this ticket maps to}}". If the work seems
   to require touching something outside that scope, stop and flag it
   instead of proceeding.
2. Respect the Tech Spec's architecture, data models, and API contracts —
   do not invent a different design than what's documented there.
3. Respect the Initiative's Non-Scope / Out-of-Scope items:
   {{list, or "none recorded"}}.
4. Keep the change atomic; do not refactor surrounding code beyond what
   this ticket requires.
5. {{Any binding constraint from the ADR, if one exists — otherwise omit
   this line.}}

INPUTS:
- Ticket: [{{ticket file}}]({{relative path}})
- Tech Spec section(s): {{relevant section links/anchors, e.g.
  "§4 Detailed Design", "§3 Proposed Solution"}}
- Target files / areas: {{the ticket's "Expected Files / Areas to Change",
  or `[PLACEHOLDER: not identified during ticket generation — locate via
  the Technical Details evidence below]`}}
- Existing evidence: {{one bullet per piece of code/config evidence from
  the ticket's Technical Details section}}

EXPECTED OUTPUT:
- The smallest correct implementation satisfying the Acceptance Criteria
  below.
- Tests per the ticket's Testing section and the Tech Spec's Testing
  Strategy — real assertions, not placeholders.
- Documentation updated for any modified behavior or API contract.

ACCEPTANCE CRITERIA:
{{Copy the ticket's Gherkin acceptance criteria verbatim.}}

DEFINITION OF DONE:
- [ ] Understand-first check passed — read the Tech Spec and ADR (if any)
      before writing code.
- [ ] {{Ticket's own Definition of Done items, one checkbox each}}
- [ ] Acceptance criteria above verified.
- [ ] Code matches the project's existing style/conventions.
- [ ] Tests pass green with zero regressions.
- [ ] No changes outside the constraints stated above.
- [ ] Documentation updated where behavior or contracts changed.
