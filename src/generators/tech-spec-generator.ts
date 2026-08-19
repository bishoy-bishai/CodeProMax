/**
 * @file tech-spec-generator.ts
 * @description Generates the Technical Specification document ("how are we
 * building it?") from a validated Initiative. Audience: Engineers + Architects.
 */

import type { Initiative } from "../schemas/types.ts";
import type { DocumentMetadata, GeneratorOptions } from "./types.ts";
import { insertTocIfLong, metadataBlock, placeholder } from "./helpers/markdown-utils.ts";
import { generateAlternativesSection } from "./helpers/initiative-sections.ts";
import {
  generateAPIContracts,
  generateArchitectureDiagram,
  generateComponents,
  generateConstraints,
  generateCurrentArchitecture,
  generateDashboards,
  generateDataModels,
  generateDesignOverview,
  generateE2ETestStrategy,
  generateEdgeCases,
  generateFailures,
  generateFeatureFlags,
  generateGoals,
  generateIntegrationTestStrategy,
  generateMonitoring,
  generateNonGoals,
  generatePerformance,
  generateReliability,
  generateRollbackPlan,
  generateRolloutPhases,
  generateScalability,
  generateSecurity,
  generateTechMetrics,
  generateTechQuestions,
  generateUnitTestStrategy,
} from "./helpers/tech-spec-sections.ts";

function buildMetadata(init: Initiative, options: GeneratorOptions): DocumentMetadata {
  return {
    version: options.version ?? "0.1.0",
    generatedAt: new Date().toISOString(),
    owner: init.owner,
    reviewers: options.reviewers ?? init.stakeholders,
  };
}

export class TechSpecGenerator {
  /**
   * Generate the Technical Specification Markdown document.
   *
   * @param init - A validated Initiative
   * @param options - Optional reviewers and version override
   * @returns Markdown document string
   */
  generate(init: Initiative, options: GeneratorOptions = {}): string {
    const metadata = buildMetadata(init, options);
    const initiativeLink = `./${init.slug}-initiative.md`;
    const epicLink = `./${init.slug}-epic.md`;

    const body = `# Technical Specification: ${init.name}

${metadataBlock(metadata)}

## 1. Context & Goals

### Goals

${generateGoals(init)}

### Non-Goals

${generateNonGoals(init)}

### Success Metrics

${generateTechMetrics(init)}

## 2. Current State

### Architecture

${generateCurrentArchitecture(init)}

### Constraints

${generateConstraints(init)}

## 3. Proposed Solution

### Architecture Diagram

\`\`\`mermaid
${generateArchitectureDiagram(init)}
\`\`\`

### Design Overview

${generateDesignOverview(init)}

## 4. Detailed Design

### Components

${generateComponents(init)}

### Data Models

${generateDataModels(init)}

### API Contracts

${generateAPIContracts(init)}

### Error Handling

${placeholder("error boundaries, retry/backoff policy, and fallback behavior for this initiative's components")}

## 5. Security & Non-Functional Requirements

### Security

${generateSecurity(init)}

### Performance

${generatePerformance(init)}

### Scalability

${generateScalability(init)}

### Reliability

${generateReliability(init)}

## 6. Failure Modes & Edge Cases

### Failure Scenarios

${generateFailures(init)}

### Edge Cases

${generateEdgeCases()}

## 7. Alternatives Considered

${generateAlternativesSection()}

## 8. Testing Strategy

### Unit Tests

${generateUnitTestStrategy(init)}

### Integration Tests

${generateIntegrationTestStrategy(init)}

### End-to-End Tests

${generateE2ETestStrategy(init)}

## 9. Rollout & Observability

### Phased Rollout

${generateRolloutPhases()}

### Feature Flags

${generateFeatureFlags(init)}

### Monitoring & Alerting

${generateMonitoring(init)}

### Dashboards

${generateDashboards()}

## 10. Rollback Plan

${generateRollbackPlan(init)}

## 11. Open Questions

${generateTechQuestions(init)}

## 12. Related Artifacts

- Initiative: [${init.id}](${initiativeLink})
- Epic: [Epic](${epicLink})
- Jira Tickets: ${placeholder("link once tickets are filed")}
- Release Plan: ${placeholder("link once release plan is created")}
`;

    return insertTocIfLong(body);
  }
}
