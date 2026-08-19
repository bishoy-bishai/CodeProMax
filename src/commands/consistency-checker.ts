/**
 * @file consistency-checker.ts
 * @description Cross-document validation for a generated document package.
 * Because every document is derived from the same Initiative object, these
 * checks mainly guard against generator bugs and drift (e.g. a helper
 * silently dropping a scope item) rather than independent authoring
 * inconsistencies — but they are real, structural checks, not rubber stamps.
 */

import type { Initiative } from "../schemas/types.ts";
import type { Ticket } from "../generators/ticket-types.ts";
import { validateInvestAll } from "../validators/invest-validator.ts";

export interface DocumentPackage {
  initiative: string;
  epic: string;
  techSpec: string;
  tickets: Ticket[];
}

export interface ConsistencyReport {
  valid: boolean;
  errors: string[];
}

export class ConsistencyChecker {
  /**
   * Validate a generated document package against its source Initiative.
   * Never throws — collects every violation and returns them together so a
   * caller can report the full picture in one pass.
   */
  validate(documents: DocumentPackage, initiative: Initiative): ConsistencyReport {
    const errors: string[] = [
      ...this.checkTitles(documents, initiative),
      ...this.checkScopeCoverage(documents, initiative),
      ...this.checkTicketsCoverScope(documents, initiative),
      ...this.checkTicketsInvestReady(documents),
      ...this.checkTicketDependenciesValid(documents),
    ];

    return { valid: errors.length === 0, errors };
  }

  private checkTitles(documents: DocumentPackage, initiative: Initiative): string[] {
    const errors: string[] = [];
    if (!documents.epic.includes(initiative.name)) {
      errors.push(`Epic document does not reference the initiative name "${initiative.name}"`);
    }
    if (!documents.techSpec.includes(initiative.name)) {
      errors.push(`Tech spec document does not reference the initiative name "${initiative.name}"`);
    }
    return errors;
  }

  private checkScopeCoverage(documents: DocumentPackage, initiative: Initiative): string[] {
    const errors: string[] = [];
    for (const item of initiative.opportunity.scope) {
      if (!documents.epic.includes(item)) {
        errors.push(`Scope item "${item}" is missing from the epic document`);
      }
      if (!documents.techSpec.includes(item)) {
        errors.push(`Scope item "${item}" is missing from the tech spec document`);
      }
    }
    return errors;
  }

  private checkTicketsCoverScope(documents: DocumentPackage, initiative: Initiative): string[] {
    const errors: string[] = [];
    for (const item of initiative.opportunity.scope) {
      const covered = documents.tickets.some(
        (t) => t.title === item || t.title.startsWith(`${item} —`)
      );
      if (!covered) {
        errors.push(`No ticket represents scope item "${item}"`);
      }
    }
    return errors;
  }

  private checkTicketsInvestReady(documents: DocumentPackage): string[] {
    const scores = validateInvestAll(documents.tickets);
    return scores
      .map((score, i) => ({ score, ticket: documents.tickets[i]! }))
      .filter(({ score }) => score.status !== "READY")
      .map(({ score, ticket }) => `Ticket ${ticket.id} is not INVEST-ready: ${score.reasons.join("; ")}`);
  }

  private checkTicketDependenciesValid(documents: DocumentPackage): string[] {
    const knownIds = new Set(documents.tickets.map((t) => t.id));
    const errors: string[] = [];
    for (const ticket of documents.tickets) {
      for (const dep of ticket.dependencies) {
        if (!knownIds.has(dep)) {
          errors.push(`Ticket ${ticket.id} depends on unknown ticket ${dep}`);
        }
      }
    }
    return errors;
  }
}
