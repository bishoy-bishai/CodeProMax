/**
 * @file epic-sections.ts
 * @description Section-builder functions for the product-facing Epic document.
 * Renders section bodies from Initiative data with the same no-fabrication
 * rule as initiative-sections.ts — gaps are marked, not invented.
 */

import type { Initiative } from "../../schemas/types.ts";
import { bulletList, placeholder, unknownMarker } from "./markdown-utils.ts";

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS VALUE
// ─────────────────────────────────────────────────────────────────────────────

export function generateBusinessValue(init: Initiative): string {
  return (
    `${init.opportunity.description} ` +
    `Severity of the underlying problem: ${init.problemStatement.severity}.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINEERING VALUE
// ─────────────────────────────────────────────────────────────────────────────

export function generateEngineeringValue(init: Initiative): string {
  const b = init.scoring.breakdown;
  return (
    `Leverage score ${b.leverage}/5 — ${
      b.leverage >= 4
        ? "this work is expected to unlock or simplify future changes."
        : "this work has limited downstream leverage beyond its immediate scope."
    } Implementation cost axis: ${b.cost}/5, risk axis: ${b.risk}/5 (see [Success Metrics](#success-metrics)).`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCEPTANCE CRITERIA
// ─────────────────────────────────────────────────────────────────────────────

/** Render each success criterion as a Gherkin-style Given/When/Then skeleton */
export function generateAcceptanceCriteria(init: Initiative): string {
  if (init.opportunity.successCriteria.length === 0) {
    return unknownMarker("no success criteria defined on this initiative");
  }

  return init.opportunity.successCriteria
    .map(
      (criterion, i) =>
        `### AC${i + 1}\n\n` +
        `\`\`\`gherkin\n` +
        `Given the initiative "${init.name}" is implemented\n` +
        `When the change is deployed\n` +
        `Then ${criterion.charAt(0).toLowerCase()}${criterion.slice(1)}\n` +
        `\`\`\``
    )
    .join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS METRICS
// ─────────────────────────────────────────────────────────────────────────────

export function generateSuccessMetrics(init: Initiative): string {
  return bulletList(
    init.opportunity.successCriteria,
    unknownMarker("no success metrics defined")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────

export function generateDependencies(init: Initiative): string {
  return bulletList(
    init.dependencies.map((id) => `[${id}](./${id.toLowerCase()}-initiative.md)`),
    "None recorded"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFINITION OF DONE
// ─────────────────────────────────────────────────────────────────────────────

export function generateDefinitionOfDone(init: Initiative): string {
  const items = [
    ...init.opportunity.successCriteria,
    "All acceptance criteria above verified in staging",
    "Tech spec reviewed and approved",
    `Documentation updated (owner: ${init.owner})`,
  ];
  return bulletList(items, unknownMarker("definition of done not established"));
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

export function generateTimelineEstimate(): string {
  return placeholder("hours estimate — to be filled in during technical spec / sizing");
}
