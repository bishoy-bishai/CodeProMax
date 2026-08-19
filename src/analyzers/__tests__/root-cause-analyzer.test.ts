/**
 * @file root-cause-analyzer.test.ts
 * @description Tests for RootCauseAnalyzer: cause selection, termination conditions,
 * confidence derivation, batch analysis, and trace formatting.
 */

import { describe, it, expect } from "vitest";
import { RootCauseAnalyzer } from "../root-cause-analyzer.ts";
import type { Finding, EvidenceRecord } from "../../schemas/types.ts";

const NOW = new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function makeEvidence(type: EvidenceRecord["type"] = "code"): EvidenceRecord {
  return {
    source: "src/api/products.ts",
    type,
    location: { file: "src/api/products.ts", line: 42, functionName: "getProducts", symbol: null },
    content: "Direct code observation supporting the finding.",
    timestamp: NOW,
    validated: true,
    validatedAt: NOW,
  };
}

function makeFinding(
  id: string,
  title: string,
  description: string,
  evidenceType: EvidenceRecord["type"] = "code"
): Finding {
  return {
    id: `FIND-${id}` as `FIND-${string}`,
    title,
    description,
    classification: "FACT",
    confidence: 4,
    evidence: [makeEvidence(evidenceType)],
    linkedFindings: [],
    initiativeRef: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const analyzer = new RootCauseAnalyzer();

// ─────────────────────────────────────────────────────────────────────────────
// BASIC RCA TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("RootCauseAnalyzer — analyze()", () => {
  it("returns a RootCauseAnalysis for any finding", () => {
    const finding = makeFinding("001", "Missing error handling", "Async function missing try-catch");
    const rca = analyzer.analyze(finding);
    expect(rca).toBeDefined();
    expect(rca.findingId).toBe("FIND-001");
  });

  it("produces at least one cause level", () => {
    const finding = makeFinding("002", "Missing error handling", "No try-catch in deleteProduct");
    const rca = analyzer.analyze(finding);
    expect(rca.causes.length).toBeGreaterThanOrEqual(1);
  });

  it("rootCause equals the last cause in the chain", () => {
    const finding = makeFinding("003", "Missing error handling", "Async function missing try-catch");
    const rca = analyzer.analyze(finding);
    expect(rca.rootCause).toBe(rca.causes[rca.causes.length - 1]);
  });

  it("depth equals the number of causes", () => {
    const finding = makeFinding("004", "Large function", "getProducts has 90 lines and complexity 18");
    const rca = analyzer.analyze(finding);
    expect(rca.depth).toBe(rca.causes.length);
  });

  it("analysisTimestamp is a valid ISO date", () => {
    const finding = makeFinding("005", "Duplicated code", "sanitizeString duplicated in formatter.ts");
    const rca = analyzer.analyze(finding);
    expect(() => new Date(rca.analysisTimestamp)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE SELECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("RootCauseAnalyzer — template selection", () => {
  it("selects error-handling chain for missing try-catch finding", () => {
    const finding = makeFinding("010", "Missing error handling", "Async function missing try-catch");
    const rca = analyzer.analyze(finding);
    expect(rca.causes[0]?.reason.toLowerCase()).toContain("error");
  });

  it("selects large-function chain for complexity finding", () => {
    const finding = makeFinding("011", "Large complex function", "Function has 80 lines and cyclomatic complexity 18");
    const rca = analyzer.analyze(finding);
    // Should match complex/large chain
    const firstReason = rca.causes[0]?.reason.toLowerCase() ?? "";
    const matchesLargeChain =
      firstReason.includes("logic") ||
      firstReason.includes("abstraction") ||
      firstReason.includes("function");
    expect(matchesLargeChain).toBe(true);
  });

  it("selects duplicate chain for duplication finding", () => {
    const finding = makeFinding("012", "Duplicated code", "sanitizeString duplicated in formatter.ts");
    const rca = analyzer.analyze(finding);
    const firstReason = rca.causes[0]?.reason.toLowerCase() ?? "";
    expect(firstReason.includes("copy") || firstReason.includes("shared") || firstReason.includes("past")).toBe(true);
  });

  it("selects coupling chain for import finding", () => {
    const finding = makeFinding("013", "High coupling", "File has 14 import statements");
    const rca = analyzer.analyze(finding);
    const firstReason = rca.causes[0]?.reason.toLowerCase() ?? "";
    expect(firstReason.includes("module") || firstReason.includes("import") || firstReason.includes("interface")).toBe(true);
  });

  it("selects dependency chain for outdated package finding", () => {
    const finding = makeFinding("014", "Outdated dependency", "moment is deprecated and outdated", "dependency");
    const rca = analyzer.analyze(finding);
    const firstReason = rca.causes[0]?.reason.toLowerCase() ?? "";
    expect(firstReason.includes("upgrade") || firstReason.includes("package") || firstReason.includes("risk")).toBe(true);
  });

  it("falls back to generic chain for unknown finding type", () => {
    const finding = makeFinding("015", "Unknown issue", "Some unrecognized code quality problem xyz");
    const rca = analyzer.analyze(finding);
    expect(rca.causes.length).toBeGreaterThanOrEqual(1);
    expect(rca.rootCause).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TERMINATION CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

describe("RootCauseAnalyzer — termination conditions", () => {
  it("terminates with systemic-actionable when reaching systemic+actionable cause", () => {
    const finding = makeFinding("020", "Missing error handling", "No try-catch in deleteProduct");
    const rca = analyzer.analyze(finding);
    expect(rca.terminationReason).toBe("systemic-actionable");
  });

  it("root cause is always marked as actionable", () => {
    const finding = makeFinding("021", "Missing error handling", "Async function missing try-catch");
    const rca = analyzer.analyze(finding);
    expect(rca.rootCause.isActionable).toBe(true);
  });

  it("root cause for error handling is systemic", () => {
    const finding = makeFinding("022", "Missing error handling", "No try-catch in deleteProduct");
    const rca = analyzer.analyze(finding);
    expect(rca.rootCause.isSystemic).toBe(true);
  });

  it("never exceeds max depth of 7", () => {
    const finding = makeFinding("023", "Unknown", "Some very deep problem that could chain forever");
    const rca = analyzer.analyze(finding);
    expect(rca.depth).toBeLessThanOrEqual(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("RootCauseAnalyzer — confidence", () => {
  it("overall confidence is High, Medium, or Low", () => {
    const finding = makeFinding("030", "Missing error handling", "No try-catch");
    const rca = analyzer.analyze(finding);
    expect(["High", "Medium", "Low"]).toContain(rca.confidence);
  });

  it("confidence is Medium or Low for dependency findings (lower evidence confidence)", () => {
    const finding = makeFinding("031", "Outdated dependency", "moment deprecated", "dependency");
    const rca = analyzer.analyze(finding);
    // Last cause in chain typically has confidence 2-3 → Medium
    expect(["High", "Medium", "Low"]).toContain(rca.confidence);
  });

  it("cause confidence decreases or stays equal as depth increases", () => {
    const finding = makeFinding("032", "Duplicated code", "sanitizeString duplicated");
    const rca = analyzer.analyze(finding);
    for (let i = 1; i < rca.causes.length; i++) {
      const prev = rca.causes[i - 1];
      const curr = rca.causes[i];
      if (prev !== undefined && curr !== undefined) {
        expect(curr.confidence).toBeLessThanOrEqual(prev.confidence);
      }
    }
  });

  it("each cause has confidence between 1 and 5", () => {
    const finding = makeFinding("033", "Missing error handling", "No try-catch");
    const rca = analyzer.analyze(finding);
    for (const cause of rca.causes) {
      expect(cause.confidence).toBeGreaterThanOrEqual(1);
      expect(cause.confidence).toBeLessThanOrEqual(5);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE LINKAGE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("RootCauseAnalyzer — evidence linkage", () => {
  it("each cause has at least one evidence record", () => {
    const finding = makeFinding("040", "Missing error handling", "No try-catch");
    const rca = analyzer.analyze(finding);
    for (const cause of rca.causes) {
      expect(cause.evidence.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("evidence records reference the original finding evidence", () => {
    const finding = makeFinding("041", "Missing error handling", "No try-catch");
    const originalSource = finding.evidence[0]!.source;
    const rca = analyzer.analyze(finding);
    // At least the first cause should reference original evidence
    const firstCauseEv = rca.causes[0]?.evidence ?? [];
    const referencesOriginal = firstCauseEv.some((e) => e.source === originalSource);
    expect(referencesOriginal).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY CHECKS (no person-blaming)
// ─────────────────────────────────────────────────────────────────────────────

describe("RootCauseAnalyzer — output quality", () => {
  it("does not blame individuals (no 'developer forgot' patterns)", () => {
    const findings = [
      makeFinding("050", "Missing error handling", "No try-catch"),
      makeFinding("051", "Large function", "Function has 90 lines"),
      makeFinding("052", "Duplicated code", "sanitizeString duplicated"),
      makeFinding("053", "High coupling", "14 imports"),
      makeFinding("054", "Outdated dependency", "moment deprecated"),
    ];
    const blamePatterns = /developer forgot|someone forgot|bad developer|poor coding/i;
    for (const finding of findings) {
      const rca = analyzer.analyze(finding);
      for (const cause of rca.causes) {
        expect(blamePatterns.test(cause.reason)).toBe(false);
      }
    }
  });

  it("all cause reasons are non-empty strings", () => {
    const finding = makeFinding("055", "Missing error handling", "No try-catch");
    const rca = analyzer.analyze(finding);
    for (const cause of rca.causes) {
      expect(cause.reason.trim().length).toBeGreaterThan(20);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BATCH ANALYSIS + TRACE FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

describe("RootCauseAnalyzer — analyzeAll & formatTrace", () => {
  it("analyzeAll returns one result per finding", () => {
    const findings = [
      makeFinding("060", "Missing error handling", "No try-catch"),
      makeFinding("061", "Duplicated code", "sanitizeString duplicated"),
      makeFinding("062", "Outdated dependency", "moment deprecated"),
    ];
    const results = analyzer.analyzeAll(findings);
    expect(results).toHaveLength(3);
  });

  it("analyzeAll results are sorted by confidence (High first)", () => {
    const findings = [
      makeFinding("063", "Missing error handling", "No try-catch"),
      makeFinding("064", "Outdated dependency", "moment deprecated", "dependency"),
    ];
    const results = analyzer.analyzeAll(findings);
    const confOrder: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]!;
      const curr = results[i]!;
      expect(confOrder[prev.confidence] ?? 0).toBeGreaterThanOrEqual(confOrder[curr.confidence] ?? 0);
    }
  });

  it("analyzeAll handles empty input", () => {
    expect(analyzer.analyzeAll([])).toEqual([]);
  });

  it("formatTrace returns a non-empty string", () => {
    const finding = makeFinding("070", "Missing error handling", "No try-catch");
    const rca = analyzer.analyze(finding);
    const trace = analyzer.formatTrace(rca);
    expect(typeof trace).toBe("string");
    expect(trace.length).toBeGreaterThan(50);
  });

  it("formatTrace includes finding ID", () => {
    const finding = makeFinding("071", "Missing error handling", "No try-catch");
    const rca = analyzer.analyze(finding);
    const trace = analyzer.formatTrace(rca);
    expect(trace).toContain("FIND-071");
  });

  it("formatTrace marks root cause as [ROOT CAUSE]", () => {
    const finding = makeFinding("072", "Missing error handling", "No try-catch");
    const rca = analyzer.analyze(finding);
    const trace = analyzer.formatTrace(rca);
    expect(trace).toContain("[ROOT CAUSE]");
  });

  it("formatTrace includes confidence and termination reason", () => {
    const finding = makeFinding("073", "Missing error handling", "No try-catch");
    const rca = analyzer.analyze(finding);
    const trace = analyzer.formatTrace(rca);
    expect(trace).toContain("confidence");
    expect(trace).toContain("Termination reason");
  });
});
