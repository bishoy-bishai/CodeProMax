/**
 * @file state-machine.ts
 * @description State machine definition and transition logic for Initiative lifecycle.
 * All transitions are explicit — no implicit or "catch-all" moves.
 */

import type {
  InitiativeStatus,
  Initiative,
  StateTransition,
  StateMachineDefinition,
} from "./types.ts";
import { ValidationError } from "./types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITION TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All legal state transitions for an Initiative.
 * Order: chronological lifecycle order.
 * Backward transitions (e.g. In Progress → Proposed) are intentionally absent.
 * Rollback is modelled as a separate "reopen" flow with a new Initiative.
 */
export const TRANSITIONS: StateTransition[] = [
  // ── Proposed → Selected ────────────────────────────────────────────────────
  {
    from: "Proposed",
    to: "Selected",
    conditions: [
      "Evidence array is non-empty",
      "Scoring result is present with all 6 axes filled",
      "decisionTrace is non-empty",
      "finalScore >= 1",
    ],
    guards: [
      "openQuestions with no assignee block this transition",
      "Missing owner blocks this transition",
    ],
    sideEffects: [
      "updatedAt is refreshed to now()",
      "Stakeholders are notified of selection",
    ],
  },

  // ── Selected → Planned ─────────────────────────────────────────────────────
  {
    from: "Selected",
    to: "Planned",
    conditions: [
      "opportunity.successCriteria is non-empty",
      "opportunity.nonScope is non-empty",
      "At least one stakeholder is present",
    ],
    guards: [
      "Any blocker with status=Open blocks this transition",
      "openQuestions with answer=null block this transition",
    ],
    sideEffects: [
      "updatedAt is refreshed to now()",
      "Planning artifact is linked to the initiative",
    ],
  },

  // ── Planned → In Progress ──────────────────────────────────────────────────
  {
    from: "Planned",
    to: "In Progress",
    conditions: [
      "owner is assigned",
      "No Open blockers",
    ],
    guards: [
      "Missing owner blocks this transition",
      "Open blockers block this transition",
    ],
    sideEffects: [
      "updatedAt is refreshed to now()",
      "Progress tracking is initiated",
    ],
  },

  // ── In Progress → Released ─────────────────────────────────────────────────
  {
    from: "In Progress",
    to: "Released",
    conditions: [
      "Implementation is deployed to production or a target environment",
      "All blockers are Closed or Mitigated",
    ],
    guards: [
      "Any Open blocker blocks this transition",
    ],
    sideEffects: [
      "updatedAt is refreshed to now()",
      "Validation period begins",
      "Metric collection is triggered",
    ],
  },

  // ── Released → Validated ───────────────────────────────────────────────────
  {
    from: "Released",
    to: "Validated",
    conditions: [
      "All successCriteria have measurable outcomes recorded",
      "Validation period has elapsed (minimum 1 week unless waived)",
    ],
    guards: [
      "Success criteria with no outcome data block this transition",
    ],
    sideEffects: [
      "updatedAt is refreshed to now()",
      "Outcome metrics are persisted to the register",
    ],
  },

  // ── Validated → Completed ──────────────────────────────────────────────────
  {
    from: "Validated",
    to: "Completed",
    conditions: [
      "Retrospective document is linked or noted",
      "All openQuestions are resolved",
      "All risks are Closed, Mitigated, or Accepted",
    ],
    guards: [
      "Unresolved openQuestions block this transition",
      "Open risks block this transition",
    ],
    sideEffects: [
      "updatedAt is refreshed to now()",
      "Findings are marked as resolved",
      "Knowledge base is updated with learnings",
    ],
  },

  // ── ROLLBACK transitions ────────────────────────────────────────────────────
  // Allowed only in exceptional circumstances; each requires an explicit reason.

  {
    from: "In Progress",
    to: "Planned",
    conditions: [
      "Explicit reason for rollback is documented in openQuestions",
      "Owner acknowledges rollback",
    ],
    guards: [],
    sideEffects: [
      "updatedAt is refreshed to now()",
      "Blockers causing the rollback are recorded",
    ],
  },

  {
    from: "Released",
    to: "In Progress",
    conditions: [
      "Critical issue discovered post-release",
      "Rollback reason documented",
    ],
    guards: [],
    sideEffects: [
      "updatedAt is refreshed to now()",
      "Incident is linked to the initiative",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// STATE MACHINE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

export const STATE_MACHINE: StateMachineDefinition = {
  states: [
    "Proposed",
    "Selected",
    "Planned",
    "In Progress",
    "Released",
    "Validated",
    "Completed",
  ],
  transitions: TRANSITIONS,
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the valid next statuses reachable from `current`.
 */
export function getReachableStatuses(current: InitiativeStatus): InitiativeStatus[] {
  return TRANSITIONS
    .filter((t) => t.from === current)
    .map((t) => t.to);
}

/**
 * Returns the transition definition for a given from→to pair.
 * Returns null if the transition is not defined (i.e. invalid).
 */
export function findTransition(
  from: InitiativeStatus,
  to: InitiativeStatus
): StateTransition | null {
  return (
    TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null
  );
}

/**
 * Runtime guard checks that run before a transition is allowed.
 * Returns a list of failure reasons (empty = all checks passed).
 */
function runGuardChecks(
  initiative: Initiative,
  transition: StateTransition
): string[] {
  const failures: string[] = [];

  // Owner check
  if (!initiative.owner || initiative.owner.trim() === "") {
    failures.push("Missing owner: transition blocked until owner is assigned.");
  }

  // Open blockers check (applies to some transitions)
  const hasOpenBlockers = initiative.blockers.some((b) => b.status === "Open");
  if (
    hasOpenBlockers &&
    (transition.to === "Planned" ||
      transition.to === "In Progress" ||
      transition.to === "Released")
  ) {
    const openBlockerDescs = initiative.blockers
      .filter((b) => b.status === "Open")
      .map((b) => b.description)
      .join("; ");
    failures.push(`Open blockers must be resolved before transitioning to "${transition.to}": ${openBlockerDescs}`);
  }

  // Open questions check (applies to Planned and Completed)
  const hasUnansweredQuestions = initiative.openQuestions.some(
    (q) => q.answer === null
  );
  if (
    hasUnansweredQuestions &&
    (transition.to === "Planned" || transition.to === "Completed")
  ) {
    failures.push(
      `All open questions must be answered before transitioning to "${transition.to}".`
    );
  }

  // Non-empty success criteria (applies to Planned+)
  if (
    transition.to !== "Proposed" &&
    transition.to !== "Selected" &&
    initiative.opportunity.successCriteria.length === 0
  ) {
    failures.push("At least one success criterion must be defined.");
  }

  // Non-scope must exist (applies to Planned+)
  if (
    transition.to !== "Proposed" &&
    transition.to !== "Selected" &&
    initiative.opportunity.nonScope.length === 0
  ) {
    failures.push("Non-scope must be explicitly defined (prevents scope creep).");
  }

  return failures;
}

/**
 * Attempts a state transition on an initiative.
 *
 * @param initiative - The current initiative (immutable input)
 * @param to - Target status
 * @returns A new Initiative object with the updated status and refreshed updatedAt
 * @throws ValidationError if the transition is invalid or guards fail
 */
export function transition(
  initiative: Readonly<Initiative>,
  to: InitiativeStatus
): Initiative {
  const transition = findTransition(initiative.status, to);

  if (transition === null) {
    throw new ValidationError(
      `Invalid state transition: "${initiative.status}" → "${to}"`,
      [
        {
          field: "status",
          expected: `One of: ${getReachableStatuses(initiative.status).join(", ") || "none (terminal state)"}`,
          received: to,
          suggestion: `Valid transitions from "${initiative.status}" are: ${
            getReachableStatuses(initiative.status).join(", ") || "none"
          }`,
        },
      ]
    );
  }

  const guardFailures = runGuardChecks(initiative, transition);

  if (guardFailures.length > 0) {
    throw new ValidationError(
      `Transition "${initiative.status}" → "${to}" blocked by guard failures`,
      guardFailures.map((reason) => ({
        field: "status",
        expected: "All guards to pass",
        received: reason,
        suggestion: reason,
      }))
    );
  }

  // Return immutable copy with updated status + timestamp
  return {
    ...initiative,
    status: to,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns true if a status is a terminal state (no outgoing transitions).
 */
export function isTerminalStatus(status: InitiativeStatus): boolean {
  return getReachableStatuses(status).length === 0;
}
