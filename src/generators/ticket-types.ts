/**
 * @file ticket-types.ts
 * @description Type definitions for generated implementation tickets and
 * their INVEST validation results.
 */

import type { InitiativeId } from "../schemas/types.ts";

/** T-shirt effort size, derived from the initiative's cost axis — never guessed */
export type EffortSize = "S" | "M" | "L";

/** Ticket identifier: {InitiativeId}-{NN} */
export type TicketId = `${InitiativeId}-${string}`;

/** A single implementation ticket — a vertical slice of the initiative's scope */
export interface Ticket {
  id: TicketId;
  title: string;
  /** "As a ... I want ... So that ..." */
  story: string;
  /** Gherkin Feature/Scenario block */
  acceptanceCriteria: string;
  technicalNotes: string;
  /** IDs of tickets that must land first */
  dependencies: TicketId[];
  effort: EffortSize;
  effortLabel: string;
  definitionOfDone: string[];
}

/** Per-criterion INVEST result, with the reason a failing criterion failed */
export interface InvestScore {
  independent: boolean;
  negotiable: boolean;
  valuable: boolean;
  estimable: boolean;
  small: boolean;
  testable: boolean;
  status: "READY" | "NEEDS_REFINEMENT";
  /** Human-readable explanation for every criterion that failed */
  reasons: string[];
}
