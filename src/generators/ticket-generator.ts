/**
 * @file ticket-generator.ts
 * @description Converts an Initiative's scope into INVEST-valid implementation
 * tickets. Each scope item becomes one vertical-slice ticket; tickets whose
 * derived effort resolves to "L" are automatically split into two "M" tickets
 * so every ticket stays small enough to complete in a few days.
 */

import type { EvidenceRecord, Initiative } from "../schemas/types.ts";
import type { EffortSize, Ticket, TicketId } from "./ticket-types.ts";
import { placeholder } from "./helpers/markdown-utils.ts";

// ─────────────────────────────────────────────────────────────────────────────
// EFFORT DERIVATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive a T-shirt size from the initiative's cost axis (1 = cheap, 5 = expensive).
 * Grounded in the real scoring breakdown rather than guessed per-ticket.
 */
function effortFromCost(cost: number): { size: EffortSize; label: string } {
  if (cost <= 2) return { size: "S", label: "S (1-2 days)" };
  if (cost === 3) return { size: "M", label: "M (3-5 days)" };
  return { size: "L", label: "L (5-10 days)" };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT DERIVATION
// ─────────────────────────────────────────────────────────────────────────────

function lowerFirst(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function firstSentence(text: string): string {
  const idx = text.indexOf(".");
  return idx === -1 ? text : text.slice(0, idx);
}

function buildStory(scopeItem: string, opportunityDescription: string): string {
  return (
    `As an engineer\n` +
    `I want ${lowerFirst(scopeItem)}\n` +
    `So that ${lowerFirst(firstSentence(opportunityDescription))}`
  );
}

function buildAcceptanceCriteria(
  initName: string,
  scopeItem: string,
  matchedCriterion: string | null
): string {
  const then = matchedCriterion !== null ? lowerFirst(matchedCriterion) : "the change satisfies acceptance review";
  return (
    `Feature: ${scopeItem}\n\n` +
    `Scenario: ${scopeItem} is delivered\n` +
    `  Given the initiative "${initName}" is being implemented\n` +
    `  When "${scopeItem}" is completed\n` +
    `  Then ${then}`
  );
}

/** Match evidence whose content or file path shares a significant word with the scope item */
function relevantEvidence(scopeItem: string, evidence: readonly EvidenceRecord[]): EvidenceRecord[] {
  const words = scopeItem
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  if (words.length === 0) return [];

  return evidence.filter((e) => {
    const haystack = `${e.content} ${e.location?.file ?? e.source}`.toLowerCase();
    return words.some((w) => haystack.includes(w));
  });
}

function buildTechnicalNotes(scopeItem: string, evidence: readonly EvidenceRecord[]): string {
  const matches = relevantEvidence(scopeItem, evidence);
  if (matches.length === 0) {
    return `- ${placeholder(`relevant files/modules for "${scopeItem}"`)}`;
  }
  return matches
    .map((e) => {
      const loc = e.location !== null && e.location.file !== null ? e.location.file : e.source;
      return `- ${loc}: ${e.content}`;
    })
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT → TICKET ASSEMBLY
// ─────────────────────────────────────────────────────────────────────────────

interface TicketDraft {
  title: string;
  story: string;
  acceptanceCriteria: string;
  technicalNotes: string;
  effort: EffortSize;
  effortLabel: string;
  definitionOfDone: string[];
}

function splitLargeDraft(draft: TicketDraft): TicketDraft[] {
  if (draft.effort !== "L") return [draft];

  const mLabel = "M (3-5 days)";
  return [
    {
      ...draft,
      title: `${draft.title} — Part 1: Design & Foundation`,
      story: `${draft.story}\n\n(Part 1 of 2 — design and foundational implementation)`,
      effort: "M",
      effortLabel: mLabel,
    },
    {
      ...draft,
      title: `${draft.title} — Part 2: Implementation & Rollout`,
      story: `${draft.story}\n\n(Part 2 of 2 — remaining implementation and rollout)`,
      effort: "M",
      effortLabel: mLabel,
    },
  ];
}

export class TicketGenerator {
  /**
   * Generate INVEST-shaped implementation tickets from an Initiative's scope.
   * Tickets form a linear dependency chain in scope order; each ticket
   * depends on at most the one before it.
   *
   * @param init - A validated Initiative
   * @returns Ordered ticket list
   */
  generateTickets(init: Initiative): Ticket[] {
    const { size: baseEffort, label: baseLabel } = effortFromCost(init.scoring.breakdown.cost);

    const drafts: TicketDraft[] = init.opportunity.scope.flatMap((scopeItem, i) => {
      const matchedCriterion = init.opportunity.successCriteria[i] ?? null;

      const draft: TicketDraft = {
        title: scopeItem,
        story: buildStory(scopeItem, init.opportunity.description),
        acceptanceCriteria: buildAcceptanceCriteria(init.name, scopeItem, matchedCriterion),
        technicalNotes: buildTechnicalNotes(scopeItem, init.evidence),
        effort: baseEffort,
        effortLabel: baseLabel,
        definitionOfDone: [
          matchedCriterion ?? `"${scopeItem}" implemented and verified against its acceptance criteria`,
          "Code reviewed and merged",
          "Tests passing in CI",
        ],
      };

      return splitLargeDraft(draft);
    });

    if (drafts.length === 0) {
      return [];
    }

    let previousId: TicketId | null = null;
    return drafts.map((draft, i) => {
      const id = `${init.id}-${String(i + 1).padStart(2, "0")}` as TicketId;
      const ticket: Ticket = {
        id,
        title: draft.title,
        story: draft.story,
        acceptanceCriteria: draft.acceptanceCriteria,
        technicalNotes: draft.technicalNotes,
        dependencies: previousId !== null ? [previousId] : [],
        effort: draft.effort,
        effortLabel: draft.effortLabel,
        definitionOfDone: draft.definitionOfDone,
      };
      previousId = id;
      return ticket;
    });
  }
}
