/**
 * @file analysis-pipeline.ts
 * @description Full end-to-end analysis pipeline: repo → ranked initiatives.
 *
 * Pipeline steps (7 total):
 *   1. Repository Mapping
 *   2. Evidence Collection (4 sources, run in parallel)
 *   3. Finding Validation (filter UNKNOWN)
 *   4. Root Cause Analysis (parallel, one per finding)
 *   5. Opportunity Generation
 *   6. Initiative Creation (+ initial scoring)
 *   7. Final Ranking
 *
 * Failure handling:
 *   - Repository inaccessible → return { status: "FAILED" }
 *   - Individual evidence source failure → continue, mark source as "failed"
 *   - Individual RCA failure → skip finding, continue
 *   - Timeout → mark PARTIAL, return with whatever was collected
 *
 * Parallelization:
 *   - All 4 evidence sources start simultaneously (Promise.allSettled)
 *   - All RCAs run simultaneously (Promise.all with per-item error handling)
 *
 * Progress reporting:
 *   - onProgress callback invoked before each major step
 *   - Useful for CLI output, WebSocket streaming, or test verification
 */

import type { Finding } from "../schemas/types.ts";
import type { RepositoryMap } from "../core/types.ts";
import { RepositoryMapper } from "../core/algorithms/repository-mapper.ts";
import { EvidenceCollector } from "../analyzers/evidence-collector.ts";
import { RootCauseAnalyzer } from "../analyzers/root-cause-analyzer.ts";
import { ScoringEngine } from "../core/algorithms/scoring-engine.ts";
import { OpportunityGenerator } from "../services/opportunity-generator.ts";
import { InitiativeFactory } from "../services/initiative-factory.ts";
import type {
  AnalysisResult,
  PipelineOptions,
  PipelineStatus,
  PipelineSourceResult,
  RankedInitiativeWithDetails,
  Opportunity,
  PipelineStep,
} from "../services/types.ts";
import type { RootCauseAnalysis } from "../analyzers/types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// ─────────────────────────────────────────────────────────────────────────────
// TIMEOUT UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Race a promise against a timeout.
 * Returns the promise value if it resolves first, or the sentinel if timeout fires.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  sentinel: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(sentinel), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FAILED RESULT FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function makeFailedResult(
  repositoryPath: string,
  analysisId: string,
  startedAt: string,
  reason: string
): AnalysisResult {
  const now = new Date().toISOString();
  return {
    analysisId,
    repositoryPath,
    status: "FAILED",
    startedAt,
    completedAt: now,
    durationMs: Date.now() - new Date(startedAt).getTime(),
    timedOut: false,
    evidenceSources: [],
    evidenceCount: 0,
    findings: [],
    rcaResults: [],
    findingsCount: 0,
    opportunities: [],
    initiatives: [],
    rankedInitiatives: [],
    initiativesCount: 0,
    warnings: [reason],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSIS PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

export class AnalysisPipeline {
  private readonly repositoryMapper: RepositoryMapper;
  private readonly evidenceCollector: EvidenceCollector;
  private readonly rootCauseAnalyzer: RootCauseAnalyzer;
  private readonly scoringEngine: ScoringEngine;
  private readonly opportunityGenerator: OpportunityGenerator;
  private readonly initiativeFactory: InitiativeFactory;

  constructor(overrides: {
    repositoryMapper?: RepositoryMapper;
    evidenceCollector?: EvidenceCollector;
    rootCauseAnalyzer?: RootCauseAnalyzer;
    scoringEngine?: ScoringEngine;
    opportunityGenerator?: OpportunityGenerator;
    initiativeFactory?: InitiativeFactory;
  } = {}) {
    this.repositoryMapper = overrides.repositoryMapper ?? new RepositoryMapper();
    this.evidenceCollector = overrides.evidenceCollector ?? new EvidenceCollector();
    this.rootCauseAnalyzer = overrides.rootCauseAnalyzer ?? new RootCauseAnalyzer();
    this.scoringEngine = overrides.scoringEngine ?? new ScoringEngine();
    this.opportunityGenerator = overrides.opportunityGenerator ?? new OpportunityGenerator();
    this.initiativeFactory = overrides.initiativeFactory ?? new InitiativeFactory();
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  /**
   * Run the full analysis pipeline on a repository.
   *
   * @param repositoryPath - Absolute path to the repository root
   * @param options - Optional configuration (timeout, progress callback)
   * @returns AnalysisResult with status COMPLETE, PARTIAL, or FAILED
   */
  async runFullAnalysis(
    repositoryPath: string,
    options: PipelineOptions = {}
  ): Promise<AnalysisResult> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, onProgress } = options;
    const startedAt = new Date().toISOString();
    const analysisId = `analysis-${Date.now()}`;
    const progress = onProgress ?? ((_step: PipelineStep, _detail: string) => { /* noop */ });

    // ── Step 1: Repository Mapping ──────────────────────────────────────────
    progress("repository-mapping", `Scanning ${repositoryPath}…`);
    let repoMap: RepositoryMap;
    try {
      repoMap = await withTimeout(
        this.repositoryMapper.mapRepository(repositoryPath),
        timeoutMs,
        null as unknown as RepositoryMap
      );
      if (repoMap === null) {
        return makeFailedResult(repositoryPath, analysisId, startedAt,
          `Repository mapping timed out after ${timeoutMs}ms`);
      }
    } catch (err) {
      return makeFailedResult(repositoryPath, analysisId, startedAt,
        `Repository mapping failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Step 2: Evidence Collection (all 4 sources in parallel) ────────────
    progress("code-evidence", "Collecting code, git, test, and dependency evidence…");
    const collectionStart = Date.now();

    const [codeResult, gitResult, testResult, depResult] = await Promise.allSettled([
      this.evidenceCollector.collectCodeEvidence(repoMap),
      this.evidenceCollector.collectGitEvidence(repoMap),
      this.evidenceCollector.collectTestEvidence(repoMap),
      this.evidenceCollector.collectDependencyEvidence(repoMap),
    ]);

    const collectionMs = Date.now() - collectionStart;

    // Build per-source result summaries
    function toSourceResult(
      name: PipelineSourceResult["source"],
      result: PromiseSettledResult<Finding[]>,
      durationMs: number
    ): PipelineSourceResult {
      if (result.status === "fulfilled") {
        return { source: name, status: "success", findingCount: result.value.length, warnings: [], durationMs };
      }
      return { source: name, status: "failed", findingCount: 0,
        warnings: [result.reason instanceof Error ? result.reason.message : String(result.reason)], durationMs };
    }

    const evidenceSources: PipelineSourceResult[] = [
      toSourceResult("code", codeResult, collectionMs),
      toSourceResult("git", gitResult, collectionMs),
      toSourceResult("test", testResult, collectionMs),
      toSourceResult("dependency", depResult, collectionMs),
    ];

    // Add collector warnings to the relevant source
    const collectorWarnings = this.evidenceCollector.getWarnings();
    if (collectorWarnings.length > 0) {
      const gitSource = evidenceSources.find((s) => s.source === "git");
      if (gitSource !== undefined) gitSource.warnings.push(...collectorWarnings);
    }

    // Aggregate all findings
    const allFindings: Finding[] = [
      ...(codeResult.status === "fulfilled" ? codeResult.value : []),
      ...(gitResult.status === "fulfilled" ? gitResult.value : []),
      ...(testResult.status === "fulfilled" ? testResult.value : []),
      ...(depResult.status === "fulfilled" ? depResult.value : []),
    ];

    const allWarnings: string[] = [
      ...evidenceSources.flatMap((s) => s.warnings),
    ];

    // ── Step 3: Finding Validation ──────────────────────────────────────────
    const validatedFindings = allFindings.filter(
      (f) => f.classification !== "UNKNOWN"
    );

    // Determine status so far
    const anySourceFailed = evidenceSources.some((s) => s.status === "failed");
    const pipelineStatus: PipelineStatus = anySourceFailed ? "PARTIAL" : "COMPLETE";

    if (validatedFindings.length === 0) {
      return buildResult(
        analysisId, repositoryPath, pipelineStatus, startedAt,
        evidenceSources, allFindings.length, [], [], [], [], [], allWarnings, false
      );
    }

    // ── Step 4: Root Cause Analysis (parallel) ──────────────────────────────
    progress("rca-analysis", `Running RCA on ${validatedFindings.length} finding(s)…`);

    const rcaResults: RootCauseAnalysis[] = [];
    const rcaFindings: Finding[] = [];

    await Promise.all(
      validatedFindings.map(async (finding) => {
        try {
          const rca = this.rootCauseAnalyzer.analyze(finding);
          rcaResults.push(rca);
          rcaFindings.push(finding);
        } catch (err) {
          allWarnings.push(
            `RCA failed for ${finding.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      })
    );

    // ── Step 5: Opportunity Generation ─────────────────────────────────────
    progress("opportunity-generation", `Generating opportunities from ${rcaFindings.length} finding(s)…`);

    const opportunities: Opportunity[] = this.opportunityGenerator.generateAll(
      rcaFindings.map((finding, i) => ({
        finding,
        rca: rcaResults[i]!,
      }))
    );

    // ── Step 6: Initiative Creation ─────────────────────────────────────────
    progress("initiative-creation", `Creating ${opportunities.length} initiative(s)…`);

    const triples = opportunities.map((opportunity, i) => ({
      opportunity,
      finding: rcaFindings[i]!,
      rca: rcaResults[i]!,
    }));

    const { initiatives, warnings: factoryWarnings } =
      this.initiativeFactory.createAll(triples);
    allWarnings.push(...factoryWarnings);

    // ── Step 7: Scoring & Ranking ───────────────────────────────────────────
    progress("scoring", `Ranking ${initiatives.length} initiative(s)…`);

    const ranked = this.scoringEngine.rank(initiatives);

    // Enrich with full initiative objects
    const initiativeMap = new Map(initiatives.map((i) => [i.id, i]));
    const rankedWithDetails: RankedInitiativeWithDetails[] = ranked
      .map((r) => {
        const initiative = initiativeMap.get(r.initiativeId);
        if (initiative === undefined) return null;
        return { ...r, initiative };
      })
      .filter((r): r is RankedInitiativeWithDetails => r !== null);

    progress("complete", `Analysis complete. ${rankedWithDetails.length} initiative(s) ranked.`);

    return buildResult(
      analysisId, repositoryPath,
      anySourceFailed ? "PARTIAL" : "COMPLETE",
      startedAt, evidenceSources,
      allFindings.length, validatedFindings, rcaResults,
      opportunities, initiatives, rankedWithDetails, allWarnings, false
    );
  }

  // ── CONVENIENCE FORMATTERS ─────────────────────────────────────────────────

  /**
   * Format an AnalysisResult as a human-readable summary string.
   * Suitable for CLI output or documentation headers.
   */
  formatSummary(result: AnalysisResult): string {
    const duration = formatDuration(result.durationMs);
    const lines: string[] = [
      `╔══════════════════════════════════════════════════════╗`,
      `  Analysis ${result.status === "PARTIAL" ? "(PARTIAL)" : "Complete"}`,
      ``,
      `  Repository : ${result.repositoryPath}`,
      `  Status     : ${result.status}`,
      `  Duration   : ${duration}`,
      `  Analysis ID: ${result.analysisId}`,
      ``,
      `  Evidence Sources:`,
      ...result.evidenceSources.map(
        (s) => `    ${s.source.padEnd(12)} ${s.status.padEnd(8)} ${s.findingCount} finding(s)`
      ),
      ``,
      `  Findings    : ${result.findingsCount} (${result.evidenceCount} evidence records)`,
      `  Initiatives : ${result.initiativesCount}`,
      `  Warnings    : ${result.warnings.length}`,
      ``,
    ];

    if (result.rankedInitiatives.length > 0) {
      lines.push(`  Top Initiatives:`);
      for (const ri of result.rankedInitiatives.slice(0, 7)) {
        const score = ri.finalScore;
        const conf = ri.scoreConfidence;
        lines.push(
          `    #${ri.rank} ${ri.initiativeId}: ${ri.initiative.name}`,
          `       Score: ${score}/100 | Confidence: ${conf}`,
        );
      }
    }

    lines.push(`╚══════════════════════════════════════════════════════╝`);
    return lines.join("\n");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildResult(
  analysisId: string,
  repositoryPath: string,
  status: PipelineStatus,
  startedAt: string,
  evidenceSources: PipelineSourceResult[],
  evidenceCount: number,
  findings: Finding[],
  rcaResults: RootCauseAnalysis[],
  opportunities: Opportunity[],
  initiatives: import("../schemas/types.ts").Initiative[],
  rankedInitiatives: RankedInitiativeWithDetails[],
  warnings: string[],
  timedOut: boolean
): AnalysisResult {
  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  return {
    analysisId,
    repositoryPath,
    status,
    startedAt,
    completedAt,
    durationMs,
    timedOut,
    evidenceSources,
    evidenceCount,
    findings,
    rcaResults,
    findingsCount: findings.length,
    opportunities,
    initiatives,
    rankedInitiatives,
    initiativesCount: initiatives.length,
    warnings,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}
