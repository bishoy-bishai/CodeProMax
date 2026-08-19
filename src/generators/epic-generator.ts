/**
 * @file epic-generator.ts
 * @description Generates the product-scope Epic document ("what are we delivering?")
 * from a validated Initiative. Audience: Product + Engineering.
 */

import type { Initiative } from "../schemas/types.ts";
import type { DocumentMetadata, GeneratorOptions } from "./types.ts";
import { metadataBlock, insertTocIfLong } from "./helpers/markdown-utils.ts";
import {
  generateAcceptanceCriteria,
  generateBusinessValue,
  generateDefinitionOfDone,
  generateDependencies,
  generateEngineeringValue,
  generateSuccessMetrics,
  generateTimelineEstimate,
} from "./helpers/epic-sections.ts";

function buildMetadata(init: Initiative, options: GeneratorOptions): DocumentMetadata {
  return {
    version: options.version ?? "0.1.0",
    generatedAt: new Date().toISOString(),
    owner: init.owner,
    reviewers: options.reviewers ?? init.stakeholders,
  };
}

export class EpicGenerator {
  /**
   * Generate the product-scope Epic Markdown document.
   *
   * @param init - A validated Initiative
   * @param options - Optional reviewers and version override
   * @returns Markdown document string
   */
  generate(init: Initiative, options: GeneratorOptions = {}): string {
    const metadata = buildMetadata(init, options);
    const initiativeLink = `./${init.slug}-initiative.md`;

    const body = `# Epic: ${init.name}

${metadataBlock(metadata)}

**Related documents:** [Initiative](${initiativeLink})

## Summary

${init.opportunity.description}

## Business Value

${generateBusinessValue(init)}

## Engineering Value

${generateEngineeringValue(init)}

## Goals

${init.opportunity.scope.map((s) => `- ${s}`).join("\n")}

## Non-Goals

${init.opportunity.nonScope.map((s) => `- ${s}`).join("\n")}

## Acceptance Criteria

${generateAcceptanceCriteria(init)}

## Success Metrics

${generateSuccessMetrics(init)}

## Dependencies

${generateDependencies(init)}

## Timeline Estimate

${generateTimelineEstimate()}

## Definition of Done

${generateDefinitionOfDone(init)}
`;

    return insertTocIfLong(body);
  }
}
