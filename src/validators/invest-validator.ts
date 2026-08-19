/**
 * @file invest-validator.ts
 * @description Validates a generated Ticket against the INVEST criteria
 * (Independent, Negotiable, Valuable, Estimable, Small, Testable).
 * Pure function — no side effects, no fabricated pass/fail; every criterion
 * is checked against an observable property of the ticket.
 */

import type { Ticket, InvestScore } from "../generators/ticket-types.ts";

const GHERKIN_MARKERS = ["given", "when", "then"];

/** A story is independent if it depends on at most one prior ticket */
function checkIndependent(ticket: Ticket): boolean {
  return ticket.dependencies.length <= 1;
}

/** A story is negotiable if it has enough substance to discuss, not a one-liner */
function checkNegotiable(ticket: Ticket): boolean {
  return ticket.story.trim().length > 50 && ticket.acceptanceCriteria.trim().length > 50;
}

/** A story is valuable if it states a "so that" benefit clause */
function checkValuable(ticket: Ticket): boolean {
  const match = ticket.story.toLowerCase().match(/so that\s+(.+)/);
  return match !== null && match[1] !== undefined && match[1].trim().length > 0;
}

/** A story is estimable if it carries a recognized effort size */
function checkEstimable(ticket: Ticket): boolean {
  return ticket.effort === "S" || ticket.effort === "M" || ticket.effort === "L";
}

/** A story is small if its effort size is S or M (L must be split further) */
function checkSmall(ticket: Ticket): boolean {
  return ticket.effort !== "L";
}

/** A story is testable if its acceptance criteria contain Gherkin Given/When/Then */
function checkTestable(ticket: Ticket): boolean {
  const text = ticket.acceptanceCriteria.toLowerCase();
  return GHERKIN_MARKERS.every((marker) => text.includes(marker));
}

/**
 * Validate a ticket against INVEST. Returns per-criterion pass/fail plus an
 * overall status and the reasons behind any failure.
 */
export function validateInvest(ticket: Ticket): InvestScore {
  const independent = checkIndependent(ticket);
  const negotiable = checkNegotiable(ticket);
  const valuable = checkValuable(ticket);
  const estimable = checkEstimable(ticket);
  const small = checkSmall(ticket);
  const testable = checkTestable(ticket);

  const reasons: string[] = [];
  if (!independent) reasons.push("Independent: ticket depends on more than one other ticket");
  if (!negotiable) reasons.push("Negotiable: story or acceptance criteria too thin to discuss");
  if (!valuable) reasons.push('Valuable: story is missing a "so that" benefit clause');
  if (!estimable) reasons.push("Estimable: effort size is not one of S/M/L");
  if (!small) reasons.push("Small: effort size is L — split into smaller tickets");
  if (!testable) reasons.push("Testable: acceptance criteria missing Given/When/Then");

  const status: InvestScore["status"] = reasons.length === 0 ? "READY" : "NEEDS_REFINEMENT";

  return { independent, negotiable, valuable, estimable, small, testable, status, reasons };
}

/** Validate a batch of tickets, returning a score per ticket in the same order */
export function validateInvestAll(tickets: readonly Ticket[]): InvestScore[] {
  return tickets.map(validateInvest);
}
