/**
 * @file opportunity-generator.ts
 * @description Converts Findings + RootCauseAnalyses into outcome-oriented Opportunities.
 *
 * Design:
 *   A template bank of 6 problem categories maps finding keywords to:
 *     - Outcome-oriented name (never implementation-specific)
 *     - Description of the gain
 *     - Measurable success criteria (≥ 2)
 *     - Explicit scope + non-scope
 *
 * Naming rules (enforced):
 *   ✓ "Improve Production Error Observability"
 *   ✗ "Add try-catch blocks"
 *   ✓ "Establish Module Boundary Architecture"
 *   ✗ "Reduce import count below 10"
 */

import type { Finding, ProblemSeverity } from "../schemas/types.ts";
import type { RootCauseAnalysis } from "../analyzers/types.ts";
import type { Opportunity } from "./types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert a human-readable name to a kebab-case slug */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/** Extract the most relevant module/file name from a finding description */
function extractModule(finding: Finding): string {
  // Try to extract a file path mention
  const pathMatch = finding.description.match(/["']?([a-zA-Z0-9/_.-]+\.(ts|js|py|go))["']?/);
  if (pathMatch !== null && pathMatch[1] !== undefined) {
    // Return just the filename without extension
    const parts = pathMatch[1].split("/");
    const last = parts[parts.length - 1];
    if (last !== undefined) return last.replace(/\.[^.]+$/, "");
  }
  return "service";
}

// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

interface OpportunityTemplate {
  /** Matched if any keyword appears in finding title or description */
  matchKeywords: string[];
  name: (finding: Finding) => string;
  description: (finding: Finding, rca: RootCauseAnalysis) => string;
  successCriteria: string[];
  scope: string[];
  nonScope: string[];
  severity: ProblemSeverity;
}

const TEMPLATES: OpportunityTemplate[] = [
  // ── Error handling ────────────────────────────────────────────────────────
  {
    matchKeywords: ["error handling", "try-catch", "unhandled", "catch", "uncaught"],
    name: () => "Improve Production Error Observability",
    description: (_finding, rca) =>
      `Establish consistent, structured error handling across all async code paths. ` +
      `Root cause: ${rca.rootCause.reason.slice(0, 120)} ` +
      `This enables correlated, traceable production errors across service boundaries.`,
    successCriteria: [
      "All async service functions wrapped in try-catch with structured error logging",
      "Production errors carry correlation IDs traceable across service calls",
      "Mean time to diagnose (MTTD) production errors reduced by ≥ 40%",
      "Zero silent error swallowing detected in CI static analysis",
    ],
    scope: [
      "All async service and API handler functions",
      "Shared error middleware or interceptor",
      "Logging and monitoring infrastructure configuration",
    ],
    nonScope: [
      "Frontend UI error boundaries (separate initiative)",
      "Third-party API errors outside engineering control",
      "Error handling in auto-generated code",
    ],
    severity: "High",
  },

  // ── Large / complex functions ─────────────────────────────────────────────
  {
    matchKeywords: ["large function", "complex", "cyclomatic", "lines", "complexity"],
    name: (finding) => `Reduce ${extractModule(finding)} Complexity and Maintainability Risk`,
    description: (finding, rca) =>
      `Decompose oversized functions in "${extractModule(finding)}" into focused, single-responsibility units. ` +
      `Root cause: ${rca.rootCause.reason.slice(0, 120)} ` +
      `This reduces cognitive load, accelerates code review, and lowers change failure rate.`,
    successCriteria: [
      "No function exceeds 50 lines or cyclomatic complexity of 15",
      "Automated complexity gate (ESLint/SonarQube) enforced in CI pipeline",
      "Change failure rate in affected modules decreases by ≥ 30%",
      "Code review cycle time for affected files reduces by ≥ 20%",
    ],
    scope: [
      "Functions exceeding the complexity/size thresholds identified in findings",
      "CI pipeline complexity gate configuration",
    ],
    nonScope: [
      "Auto-generated code (e.g., gRPC stubs, OpenAPI clients)",
      "Third-party vendored code",
      "Test fixtures or mock data files",
    ],
    severity: "Medium",
  },

  // ── Duplicated code ───────────────────────────────────────────────────────
  {
    matchKeywords: ["duplicate", "duplicated", "similar", "copy"],
    name: () => "Consolidate Shared Utilities and Eliminate Code Duplication",
    description: (_finding, rca) =>
      `Extract duplicated code blocks into a shared utilities layer accessible across modules. ` +
      `Root cause: ${rca.rootCause.reason.slice(0, 120)} ` +
      `This prevents divergence bugs and reduces the surface area for introducing inconsistencies.`,
    successCriteria: [
      "Identified duplicated blocks extracted into shared utility modules",
      "Automated duplication detector (jscpd) added to CI pipeline",
      "Zero new duplication blocks > 10 lines detected in new pull requests",
      "Shared utility documentation published for team discoverability",
    ],
    scope: [
      "Identified duplicated code blocks across source files",
      "Shared utilities layer structure and discoverability",
      "CI duplication gate setup",
    ],
    nonScope: [
      "Boilerplate or scaffold code intentionally repeated",
      "Test fixtures (duplication in tests is acceptable for isolation)",
    ],
    severity: "Medium",
  },

  // ── High coupling ─────────────────────────────────────────────────────────
  {
    matchKeywords: ["coupling", "import", "cross-module", "high coupling"],
    name: (finding) => `Establish Module Boundary Architecture for ${extractModule(finding)}`,
    description: (_finding, rca) =>
      `Define and enforce explicit module boundaries, preventing arbitrary cross-module imports. ` +
      `Root cause: ${rca.rootCause.reason.slice(0, 120)} ` +
      `This reduces the blast radius of changes and enables independent module evolution.`,
    successCriteria: [
      "Module dependency rules documented in an Architecture Decision Record (ADR)",
      "Import boundary enforcement tooling (eslint-plugin-import or dependency-cruiser) configured",
      "No module violates defined boundary rules in CI",
      "Coupling metrics (fan-in/fan-out) for affected modules reduce by ≥ 40%",
    ],
    scope: [
      "Module dependency policy and ADR creation",
      "Automated boundary enforcement in CI",
      "Refactoring of the highest-coupling modules identified in findings",
    ],
    nonScope: [
      "Complete architectural rewrite of the application",
      "Dependencies on shared framework APIs (React, Express) — those are intentional",
    ],
    severity: "Medium",
  },

  // ── Outdated / deprecated dependencies ────────────────────────────────────
  {
    matchKeywords: ["deprecated", "outdated", "old version", "dependency issue"],
    name: () => "Modernize and Secure the Dependency Stack",
    description: (_finding, rca) =>
      `Replace deprecated and outdated packages with maintained alternatives, ` +
      `and establish automated dependency maintenance. ` +
      `Root cause: ${rca.rootCause.reason.slice(0, 120)}`,
    successCriteria: [
      "All deprecated packages removed or replaced with maintained alternatives",
      "Functionally duplicate packages consolidated to a single canonical choice",
      "Dependabot or Renovate configured for automated dependency updates",
      "Dependency freshness policy documented (max acceptable lag: 6 months behind major)",
    ],
    scope: [
      "All flagged deprecated and outdated packages",
      "Automated dependency update tooling setup",
      "Dependency policy documentation",
    ],
    nonScope: [
      "Complete framework upgrades (e.g., React 17 → 18) — separate initiative",
      "@types/* packages unless they cause type errors",
    ],
    severity: "High",
  },

  // ── High churn / instability ───────────────────────────────────────────────
  {
    matchKeywords: ["churn", "hotspot", "repeated fixes", "frequently changed", "coverage", "test"],
    name: (finding) => `Improve Stability and Test Coverage for ${extractModule(finding)}`,
    description: (finding, rca) =>
      `Address the structural instability in "${extractModule(finding)}" causing repeated fixes ` +
      `and improve automated test coverage to catch regressions earlier. ` +
      `Root cause: ${rca.rootCause.reason.slice(0, 120)}`,
    successCriteria: [
      "Root cause structural issue (identified in RCA) addressed with targeted refactoring",
      "Automated test coverage for the identified module reaches ≥ 80%",
      "Number of fix-related commits for the module reduces by ≥ 50% over 3 months",
      "CI coverage gate prevents merges that reduce coverage below threshold",
    ],
    scope: [
      "Structural refactoring of the high-churn module based on root cause",
      "Test suite for the identified module",
      "CI coverage threshold configuration",
    ],
    nonScope: [
      "Complete rewrite of the module",
      "Coverage improvements in unrelated modules",
    ],
    severity: "Medium",
  },

  // ── Generic fallback ──────────────────────────────────────────────────────
  {
    matchKeywords: [],
    name: (finding) => `Improve Engineering Quality: ${finding.title.slice(0, 50)}`,
    description: (finding, rca) =>
      `Address the quality gap identified in "${finding.title}". ` +
      `Root cause: ${rca.rootCause.reason.slice(0, 120)} ` +
      `This improvement reduces technical risk and maintenance burden.`,
    successCriteria: [
      "Root cause (as identified in RCA) structurally addressed",
      "Automated quality gate prevents recurrence in CI",
      "Engineering team alignment documented in ADR or team wiki",
    ],
    scope: ["The specific area identified in the finding", "Preventive CI tooling"],
    nonScope: ["Unrelated quality improvements"],
    severity: "Low",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export class OpportunityGenerator {
  /**
   * Select the best-matching template for a finding.
   * Scores each template by keyword match count; falls back to the generic template.
   */
  private selectTemplate(finding: Finding): OpportunityTemplate {
    const text = `${finding.title} ${finding.description}`.toLowerCase();
    let bestScore = 0;
    let bestTemplate = TEMPLATES[TEMPLATES.length - 1]!;

    for (const t of TEMPLATES) {
      if (t.matchKeywords.length === 0) continue;
      const score = t.matchKeywords.filter((kw) => text.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = t;
      }
    }

    return bestTemplate;
  }

  /**
   * Generate an Opportunity from a finding and its root cause analysis.
   *
   * @param finding - A validated Finding
   * @param rca - The root cause analysis for the finding
   * @returns An outcome-oriented Opportunity
   */
  generate(finding: Finding, rca: RootCauseAnalysis): Opportunity {
    const template = this.selectTemplate(finding);

    const name = template.name(finding);
    const slug = slugify(name);
    const description = template.description(finding, rca);

    return {
      name,
      slug,
      description,
      successCriteria: template.successCriteria,
      scope: template.scope,
      nonScope: template.nonScope,
      severity: template.severity,
      findingRef: finding.id,
      rcaSummary: rca.rootCause.reason.slice(0, 200),
    };
  }

  /**
   * Generate opportunities for a batch of (finding, rca) pairs.
   * Skips UNKNOWN-classified findings (not enough evidence to act on).
   */
  generateAll(
    pairs: ReadonlyArray<{ finding: Finding; rca: RootCauseAnalysis }>
  ): Opportunity[] {
    return pairs
      .filter(({ finding }) => finding.classification !== "UNKNOWN")
      .map(({ finding, rca }) => this.generate(finding, rca));
  }
}
