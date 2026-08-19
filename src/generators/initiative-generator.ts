/**
 * @file initiative-generator.ts
 * @description Generates the strategic Initiative document ("why should we invest?")
 * from a validated Initiative. Audience: Engineering + Leadership.
 */

import type { Initiative } from "../schemas/types.ts";
import type { DocumentMetadata, GeneratorOptions } from "./types.ts";
import { insertTocIfLong, metadataBlock } from "./helpers/markdown-utils.ts";
import {
  generateAlternativesSection,
  generateDependenciesSection,
  generateEvidenceSection,
  generateExecutiveSummary,
  generateMetricsSection,
  generateOpportunitySection,
  generateOutcomesSection,
  generateProblemStatement,
  generateQuestionsSection,
  generateRecommendationSection,
  generateRisksSection,
  generateRootCauseSection,
} from "./helpers/initiative-sections.ts";

function buildMetadata(init: Initiative, options: GeneratorOptions): DocumentMetadata {
  return {
    version: options.version ?? "0.1.0",
    generatedAt: new Date().toISOString(),
    owner: init.owner,
    reviewers: options.reviewers ?? init.stakeholders,
  };
}

export class InitiativeGenerator {
  /**
   * Generate the strategic Initiative Markdown document.
   *
   * @param init - A validated Initiative
   * @param options - Optional RCA, reviewers, and version override
   * @returns Markdown document string
   */
  generate(init: Initiative, options: GeneratorOptions = {}): string {
    const metadata = buildMetadata(init, options);
    const epicLink = `./${init.slug}-epic.md`;

    const body = `# ${init.name}

${metadataBlock(metadata)}

**Related documents:** [Epic](${epicLink})

## Executive Summary

${generateExecutiveSummary(init)}

## Problem Statement

${generateProblemStatement(init)}

## Evidence

${generateEvidenceSection(init.evidence)}

## Root Cause

${generateRootCauseSection(init, options.rca)}

## Opportunity

${generateOpportunitySection(init)}

## Expected Outcomes

${generateOutcomesSection(init)}

## Success Metrics

${generateMetricsSection(init)}

## Scope

${init.opportunity.scope.map((s) => `- ${s}`).join("\n")}

## Non-Scope

${init.opportunity.nonScope.map((s) => `- ${s}`).join("\n")}

## Alternatives Considered

${generateAlternativesSection()}

## Recommended Direction

${generateRecommendationSection(init)}

## Risks & Blockers

${generateRisksSection(init)}

## Dependencies

${generateDependenciesSection(init)}

## Open Questions

${generateQuestionsSection(init)}

## Decision Trace

${init.scoring.decisionTrace}
`;

    return insertTocIfLong(body);
  }
}
