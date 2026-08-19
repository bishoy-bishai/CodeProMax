/**
 * @file state-machine.ts  (core layer)
 * @description Enhanced state machine for the core layer.
 *
 * Differences from src/schemas/state-machine.ts:
 *   - Guards are function-based (executable, not just string descriptions)
 *   - Every transition requires an explicit `reason` string (no silent moves)
 *   - Every transition generates a TransitionRecord (audit log)
 *   - Guard results are structured and returned, not just thrown
 *
 * The schema-layer state machine defines the structure; this layer enforces it.
 */

import type { Initiative, InitiativeStatus } from "../schemas/types.ts";
import { ValidationError } from "../schemas/types.ts";
import type {
  CoreStateTransition,
  GuardFn,
  GuardResult,
  TransitionRecord,
} from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// GUARD FUNCTIONS
// Each returns a GuardResult — always structured, never throws.
// ─────────────────────────────────────────────────────────────────────────────

const guardOwnerAssigned: GuardFn = (init: Initiative): GuardResult => {
  const passed = init.owner.trim() !== "";
  return {
    guardName: "owner-assigned",
    passed,
    detail: passed
      ? `Owner "${init.owner}" is assigned.`
      : "Owner field is empty. Assign an owner before transitioning.",
  };
};

const guardEvidenceNonEmpty: GuardFn = (init: Initiative): GuardResult => {
  const passed = init.evidence.length > 0;
  return {
    guardName: "evidence-non-empty",
    passed,
    detail: passed
      ? `${init.evidence.length} evidence record(s) present.`
      : "Evidence array is empty. At least one evidence record is required.",
  };
};

const guardScoringComplete: GuardFn = (init: Initiative): GuardResult => {
  const b = init.scoring.breakdown;
  const allFilled =
    b.impact >= 1 && b.confidence >= 1 && b.urgency >= 1 &&
    b.leverage >= 1 && b.cost >= 1 && b.risk >= 1;
  const hasTrace = init.scoring.decisionTrace.trim() !== "";
  const passed = allFilled && hasTrace;
  return {
    guardName: "scoring-complete",
    passed,
    detail: passed
      ? `Scoring complete. Final score: ${init.scoring.finalScore}, decisionTrace present.`
      : `Scoring incomplete. All 6 axes must be ≥1 and decisionTrace must be non-empty. ` +
        `Breakdown: ${JSON.stringify(b)}. trace="${init.scoring.decisionTrace.slice(0, 40)}..."`,
  };
};

const guardNoOpenBlockers: GuardFn = (init: Initiative): GuardResult => {
  const openBlockers = init.blockers.filter((b) => b.status === "Open");
  const passed = openBlockers.length === 0;
  return {
    guardName: "no-open-blockers",
    passed,
    detail: passed
      ? "No open blockers."
      : `${openBlockers.length} open blocker(s): ${openBlockers.map((b) => `"${b.description}"`).join(", ")}.`,
  };
};

const guardSuccessCriteriaDefined: GuardFn = (init: Initiative): GuardResult => {
  const passed = init.opportunity.successCriteria.length > 0;
  return {
    guardName: "success-criteria-defined",
    passed,
    detail: passed
      ? `${init.opportunity.successCriteria.length} success criterion/ia defined.`
      : "opportunity.successCriteria is empty. Define at least one measurable criterion.",
  };
};

const guardNonScopeDefined: GuardFn = (init: Initiative): GuardResult => {
  const passed = init.opportunity.nonScope.length > 0;
  return {
    guardName: "non-scope-defined",
    passed,
    detail: passed
      ? `${init.opportunity.nonScope.length} non-scope item(s) defined.`
      : "opportunity.nonScope is empty. Explicit non-scope prevents scope creep.",
  };
};

const guardAllQuestionsAnswered: GuardFn = (init: Initiative): GuardResult => {
  const unanswered = init.openQuestions.filter((q) => q.answer === null);
  const passed = unanswered.length === 0;
  return {
    guardName: "all-questions-answered",
    passed,
    detail: passed
      ? "All open questions are answered."
      : `${unanswered.length} unanswered open question(s): ` +
        unanswered.map((q) => `"${q.question}"`).join("; "),
  };
};

const guardAllRisksResolved: GuardFn = (init: Initiative): GuardResult => {
  const openRisks = init.risks.filter((r) => r.status === "Open");
  const passed = openRisks.length === 0;
  return {
    guardName: "all-risks-resolved",
    passed,
    detail: passed
      ? "No open risks."
      : `${openRisks.length} open risk(s): ${openRisks.map((r) => `"${r.description}"`).join("; ")}.`,
  };
};

const guardRollbackReasonDocumented: GuardFn = (init: Initiative): GuardResult => {
  // A rollback is documented if the initiative has at least one open question
  // with text mentioning "rollback" or a blocker causing the rollback.
  const hasRollbackNote =
    init.openQuestions.some((q) => q.question.toLowerCase().includes("rollback")) ||
    init.blockers.some((b) => b.description.toLowerCase().includes("rollback"));
  return {
    guardName: "rollback-reason-documented",
    passed: hasRollbackNote,
    detail: hasRollbackNote
      ? "Rollback reason documented in open questions or blockers."
      : "Rollback requires documentation: add an open question or blocker with 'rollback' in the description.",
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITION TABLE (Core Layer)
// ─────────────────────────────────────────────────────────────────────────────

const CORE_TRANSITIONS: CoreStateTransition[] = [
  {
    from: "Proposed",
    to: "Selected",
    guards: [guardOwnerAssigned, guardEvidenceNonEmpty, guardScoringComplete],
    conditionSummary: [
      "Owner must be assigned",
      "At least one evidence record must exist",
      "All 6 scoring axes must be set and decisionTrace non-empty",
    ],
    sideEffects: ["updatedAt refreshed", "Stakeholders notified"],
  },
  {
    from: "Selected",
    to: "Planned",
    guards: [
      guardOwnerAssigned,
      guardSuccessCriteriaDefined,
      guardNonScopeDefined,
      guardNoOpenBlockers,
      guardAllQuestionsAnswered,
    ],
    conditionSummary: [
      "Owner must be assigned",
      "At least one success criterion must be defined",
      "Non-scope must be explicitly defined",
      "No open blockers",
      "All open questions must be answered",
    ],
    sideEffects: ["updatedAt refreshed", "Planning artifact linked"],
  },
  {
    from: "Planned",
    to: "In Progress",
    guards: [guardOwnerAssigned, guardNoOpenBlockers],
    conditionSummary: ["Owner assigned", "No open blockers"],
    sideEffects: ["updatedAt refreshed", "Progress tracking initiated"],
  },
  {
    from: "In Progress",
    to: "Released",
    guards: [guardNoOpenBlockers],
    conditionSummary: [
      "All blockers are Closed or Mitigated",
      "Implementation deployed to target environment",
    ],
    sideEffects: ["updatedAt refreshed", "Validation period begins", "Metric collection triggered"],
  },
  {
    from: "Released",
    to: "Validated",
    guards: [guardSuccessCriteriaDefined],
    conditionSummary: [
      "All success criteria have measured outcomes recorded",
      "Validation period has elapsed",
    ],
    sideEffects: ["updatedAt refreshed", "Outcome metrics persisted"],
  },
  {
    from: "Validated",
    to: "Completed",
    guards: [guardAllQuestionsAnswered, guardAllRisksResolved],
    conditionSummary: [
      "All open questions resolved",
      "All risks Closed, Mitigated, or Accepted",
      "Retrospective linked",
    ],
    sideEffects: ["updatedAt refreshed", "Findings marked resolved", "Knowledge base updated"],
  },
  // ── Rollback transitions ────────────────────────────────────────────────────
  {
    from: "In Progress",
    to: "Planned",
    guards: [guardRollbackReasonDocumented],
    conditionSummary: ["Rollback reason documented in open questions or blockers"],
    sideEffects: ["updatedAt refreshed", "Blockers recorded"],
  },
  {
    from: "Released",
    to: "In Progress",
    guards: [guardRollbackReasonDocumented],
    conditionSummary: ["Critical issue documented", "Rollback reason recorded"],
    sideEffects: ["updatedAt refreshed", "Incident linked"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CORE STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the core transition definition for a from→to pair.
 * Returns null if the transition is not registered (invalid).
 */
function findCoreTransition(
  from: InitiativeStatus,
  to: InitiativeStatus
): CoreStateTransition | null {
  return CORE_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

/**
 * Execute all guards for a transition and return their results.
 * Guards that throw are caught and recorded as failures.
 */
function runGuards(
  initiative: Initiative,
  guards: GuardFn[]
): GuardResult[] {
  return guards.map((guard) => {
    try {
      return guard(initiative);
    } catch (err) {
      return {
        guardName: guard.name || "unknown-guard",
        passed: false,
        detail: `Guard threw an unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
}

/**
 * Attempt a state transition on an initiative.
 *
 * @param initiative   - Current initiative (immutable input)
 * @param to           - Target status
 * @param reason       - Required: explicit human-readable reason for the change
 * @param triggeredBy  - Required: username or system agent performing the change
 * @returns { initiative: updated copy, log: transition audit record }
 * @throws ValidationError if transition is undefined or any guard fails
 */
export function transition(
  initiative: Readonly<Initiative>,
  to: InitiativeStatus,
  reason: string,
  triggeredBy: string
): { initiative: Initiative; log: TransitionRecord } {
  if (!reason || reason.trim() === "") {
    throw new ValidationError("State transition requires an explicit reason (must be non-empty)", [
      {
        field: "reason",
        expected: "Non-empty string explaining why this transition is happening",
        received: reason,
        suggestion: 'Provide a reason like: "Scoring complete, evidence validated, selecting for Q3 planning."',
      },
    ]);
  }

  if (!triggeredBy || triggeredBy.trim() === "") {
    throw new ValidationError("State transition requires a triggeredBy identity", [
      {
        field: "triggeredBy",
        expected: "Non-empty string: username, agent name, or system identifier",
        received: triggeredBy,
        suggestion: 'Provide the actor: "alice", "system/ci", "code-pro-max-agent"',
      },
    ]);
  }

  const coreTransition = findCoreTransition(initiative.status, to);

  if (coreTransition === null) {
    const validTargets = CORE_TRANSITIONS
      .filter((t) => t.from === initiative.status)
      .map((t) => t.to);

    throw new ValidationError(
      `Invalid transition: "${initiative.status}" → "${to}"`,
      [
        {
          field: "status",
          expected: validTargets.length > 0 ? `One of: ${validTargets.join(", ")}` : "None (terminal state)",
          received: to,
          suggestion:
            validTargets.length > 0
              ? `Valid targets from "${initiative.status}": ${validTargets.join(", ")}`
              : `"${initiative.status}" is a terminal state — no further transitions are allowed.`,
        },
      ]
    );
  }

  const guardResults = runGuards(initiative as Initiative, coreTransition.guards);
  const failures = guardResults.filter((r) => !r.passed);

  if (failures.length > 0) {
    throw new ValidationError(
      `Transition "${initiative.status}" → "${to}" blocked: ${failures.length} guard(s) failed`,
      failures.map((f) => ({
        field: `guard:${f.guardName}`,
        expected: "Guard to pass",
        received: f.detail,
        suggestion: f.detail,
      }))
    );
  }

  const now = new Date().toISOString();

  const log: TransitionRecord = {
    initiativeId: initiative.id,
    from: initiative.status,
    to,
    reason,
    triggeredBy,
    timestamp: now,
    guardResults,
  };

  const updatedInitiative: Initiative = {
    ...initiative,
    status: to,
    updatedAt: now,
  };

  return { initiative: updatedInitiative, log };
}

/**
 * Validate all transitions without executing them.
 * Useful for "what can I do?" queries in a UI.
 */
export function getTransitionOptions(
  initiative: Initiative
): Array<{ to: InitiativeStatus; guardResults: GuardResult[]; canTransition: boolean }> {
  return CORE_TRANSITIONS
    .filter((t) => t.from === initiative.status)
    .map((t) => {
      const guardResults = runGuards(initiative, t.guards);
      return {
        to: t.to,
        guardResults,
        canTransition: guardResults.every((r) => r.passed),
      };
    });
}

/** Returns the list of core transitions (read-only for inspection) */
export function getCoreTransitions(): ReadonlyArray<Readonly<CoreStateTransition>> {
  return CORE_TRANSITIONS;
}
