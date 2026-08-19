/**
 * @file command-handler.ts
 * @description Implements the seven /codepro commands on top of the real
 * analysis pipeline, document generators, state machine, and register
 * persistence built in Phases 0-2.
 *
 * Two deliberate departures from a literal reading of the Phase 3 spec:
 *
 *  1. `build()` generates the four document types that actually exist
 *     (initiative, epic, tech-spec, tickets). "Release" and "stakeholder"
 *     document generators were never built in Phase 2 — there is nothing
 *     for build() to call, so it does not pretend to call them.
 *
 *  2. `update()` re-runs the real analysis pipeline and matches the result
 *     back to the target initiative by problem statement, because there is
 *     no `EvidenceCollector.collectFresh(problemStatement)` API scoped to a
 *     single finding — evidence collection always operates on a full
 *     RepositoryMap. This is slower than the spec's imagined targeted
 *     refresh but it is real.
 *
 * State transitions go through the actual guarded state machine
 * (src/core/state-machine.ts) rather than assigning `.status` directly, so
 * build() only reports "Planned" when the guards genuinely pass.
 */

import type { Initiative, InitiativeId } from "../schemas/types.ts";
import { ValidationError } from "../schemas/types.ts";
import { transition } from "../core/state-machine.ts";
import { AnalysisPipeline } from "../core/analysis-pipeline.ts";
import { InitiativeGenerator } from "../generators/initiative-generator.ts";
import { EpicGenerator } from "../generators/epic-generator.ts";
import { TechSpecGenerator } from "../generators/tech-spec-generator.ts";
import { TicketGenerator } from "../generators/ticket-generator.ts";
import { renderTicketMarkdown } from "../generators/helpers/ticket-markdown.ts";
import type { PipelineOptions } from "../services/types.ts";
import { FileManager } from "./file-manager.ts";
import { RegisterManager } from "./register-manager.ts";
import { ConsistencyChecker } from "./consistency-checker.ts";
import {
  epicDocPath,
  initiativeDocPath,
  slugifyTicketTitle,
  techSpecDocPath,
  ticketDocPath,
} from "./paths.ts";
import type {
  BuildResult,
  FindResult,
  HelpResult,
  ReAnalysisResult,
  ReviewResult,
  ScoreChange,
  StatusResult,
  UpdateResult,
} from "./types.ts";

const PLANNED_CHAIN: Initiative["status"][] = ["Proposed", "Selected", "Planned"];

function normalizeForMatch(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function notFound(initiativeId: string): ValidationError {
  return new ValidationError(`Initiative ${initiativeId} not found`, [
    { field: "initiativeId", expected: "An ID present in the register", received: initiativeId, suggestion: "Run /codepro status to list known initiative IDs" },
  ]);
}

export class CommandHandler {
  private readonly pipeline: AnalysisPipeline;
  private readonly initiativeGenerator: InitiativeGenerator;
  private readonly epicGenerator: EpicGenerator;
  private readonly techSpecGenerator: TechSpecGenerator;
  private readonly ticketGenerator: TicketGenerator;
  private readonly fileManager: FileManager;
  private readonly registerManager: RegisterManager;
  private readonly consistencyChecker: ConsistencyChecker;
  private readonly baseDir: string;

  constructor(
    baseDir: string,
    overrides: {
      pipeline?: AnalysisPipeline;
      initiativeGenerator?: InitiativeGenerator;
      epicGenerator?: EpicGenerator;
      techSpecGenerator?: TechSpecGenerator;
      ticketGenerator?: TicketGenerator;
      fileManager?: FileManager;
      registerManager?: RegisterManager;
      consistencyChecker?: ConsistencyChecker;
    } = {}
  ) {
    this.baseDir = baseDir;
    this.pipeline = overrides.pipeline ?? new AnalysisPipeline();
    this.initiativeGenerator = overrides.initiativeGenerator ?? new InitiativeGenerator();
    this.epicGenerator = overrides.epicGenerator ?? new EpicGenerator();
    this.techSpecGenerator = overrides.techSpecGenerator ?? new TechSpecGenerator();
    this.ticketGenerator = overrides.ticketGenerator ?? new TicketGenerator();
    this.fileManager = overrides.fileManager ?? new FileManager();
    this.registerManager = overrides.registerManager ?? new RegisterManager(this.fileManager, baseDir);
    this.consistencyChecker = overrides.consistencyChecker ?? new ConsistencyChecker();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // /codepro find N
  // ─────────────────────────────────────────────────────────────────────────

  async find(n: number, repositoryPath: string, options: PipelineOptions = {}): Promise<FindResult> {
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      throw new ValidationError("N must be an integer between 1 and 10", [
        { field: "n", expected: "integer 1-10", received: n, suggestion: "Try: /codepro find 5" },
      ]);
    }

    const analysis = await this.pipeline.runFullAnalysis(repositoryPath, options);
    await this.registerManager.create(analysis.initiatives);

    const top = analysis.rankedInitiatives.slice(0, n).map((r) => r.initiative);
    const filesCreated: string[] = [];
    for (const init of top) {
      const path = initiativeDocPath(this.baseDir, init.slug);
      await this.fileManager.write(path, this.initiativeGenerator.generate(init));
      filesCreated.push(path);
    }

    return {
      initiatives: top,
      filesCreated,
      analysisId: analysis.analysisId,
      analysisStatus: analysis.status,
      analysisDurationMs: analysis.durationMs,
      evidenceCount: analysis.evidenceCount,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // /codepro build INIT-ID
  // ─────────────────────────────────────────────────────────────────────────

  async build(initiativeId: InitiativeId, triggeredBy = "codepro-cli"): Promise<BuildResult> {
    const init = await this.registerManager.get(initiativeId);
    if (init === null) throw notFound(initiativeId);
    if (init.problemStatement.description.trim() === "") {
      throw new ValidationError("Problem statement required before building documents", [
        { field: "problemStatement.description", expected: "non-empty string", received: "", suggestion: null },
      ]);
    }
    if (init.evidence.length === 0) {
      throw new ValidationError("At least one evidence record is required before building documents", [
        { field: "evidence", expected: "non-empty array", received: [], suggestion: null },
      ]);
    }

    const initiativeDoc = this.initiativeGenerator.generate(init);
    const epicDoc = this.epicGenerator.generate(init);
    const techSpecDoc = this.techSpecGenerator.generate(init);
    const tickets = this.ticketGenerator.generateTickets(init);

    const consistency = this.consistencyChecker.validate(
      { initiative: initiativeDoc, epic: epicDoc, techSpec: techSpecDoc, tickets },
      init
    );

    const filesCreated: string[] = [];

    const iPath = initiativeDocPath(this.baseDir, init.slug);
    await this.fileManager.write(iPath, initiativeDoc);
    filesCreated.push(iPath);

    const ePath = epicDocPath(this.baseDir, init.slug);
    await this.fileManager.write(ePath, epicDoc);
    filesCreated.push(ePath);

    const tPath = techSpecDocPath(this.baseDir, init.slug);
    await this.fileManager.write(tPath, techSpecDoc);
    filesCreated.push(tPath);

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i]!;
      const path = ticketDocPath(this.baseDir, init.slug, i + 1, slugifyTicketTitle(ticket.title));
      await this.fileManager.write(path, renderTicketMarkdown(ticket));
      filesCreated.push(path);
    }

    const { initiative: updatedInit, warnings: transitionWarnings } = this.advanceTowardPlanned(init, triggeredBy);
    await this.registerManager.update(updatedInit);

    return {
      initiativeId,
      filesCreated,
      ticketCount: tickets.length,
      consistencyValid: consistency.valid,
      consistencyErrors: consistency.errors,
      finalStatus: updatedInit.status,
      transitionWarnings,
    };
  }

  /**
   * Walk the fixed Proposed -> Selected -> Planned chain via the guarded
   * state machine, stopping at the first guard failure. Never throws —
   * a partially-advanced initiative is a valid, reportable outcome.
   */
  private advanceTowardPlanned(
    init: Initiative,
    triggeredBy: string
  ): { initiative: Initiative; warnings: string[] } {
    let current = init;
    const warnings: string[] = [];
    const startIdx = PLANNED_CHAIN.indexOf(current.status);

    if (startIdx === -1) {
      // Not on the standard forward path (e.g. already Planned or later) — nothing to advance.
      return { initiative: current, warnings };
    }

    for (let i = startIdx; i < PLANNED_CHAIN.length - 1; i++) {
      const to = PLANNED_CHAIN[i + 1]!;
      try {
        const result = transition(current, to, `Documents generated via /codepro build`, triggeredBy);
        current = result.initiative;
      } catch (err) {
        const message = err instanceof ValidationError ? err.message : String(err);
        warnings.push(`Stopped at "${current.status}": ${message}`);
        break;
      }
    }

    return { initiative: current, warnings };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // /codepro review
  // ─────────────────────────────────────────────────────────────────────────

  async review(): Promise<ReviewResult> {
    const initiatives = await this.registerManager.loadAll();
    const issues: ReviewResult["issues"] = [];
    const now = Date.now();
    const seenProblems = new Map<string, InitiativeId>();

    for (const init of initiatives) {
      const daysOld = (now - new Date(init.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld > 90) {
        issues.push({
          severity: "warning",
          initiativeId: init.id,
          issue: `Evidence may be stale (${Math.round(daysOld)} days since last update)`,
          recommendation: "Re-analyze and update",
        });
      }

      const key = normalizeForMatch(init.problemStatement.description);
      const dupOf = seenProblems.get(key);
      if (dupOf !== undefined) {
        issues.push({
          severity: "error",
          initiativeId: init.id,
          issue: `Potential duplicate of ${dupOf} (identical problem statement)`,
          recommendation: "Review and merge if appropriate",
        });
      } else {
        seenProblems.set(key, init.id);
      }

      if (init.status === "Planned" || init.status === "In Progress") {
        const exists = await this.fileManager.exists(techSpecDocPath(this.baseDir, init.slug));
        if (!exists) {
          issues.push({
            severity: "error",
            initiativeId: init.id,
            issue: "Tech spec missing for planned initiative",
            recommendation: `Run /codepro build ${init.id} or change status`,
          });
        }
      }
    }

    const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => severityOrder[a.severity]! - severityOrder[b.severity]!);

    return { initiativeCount: initiatives.length, issuesFound: issues.length, issues };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // /codepro re-analyze
  // ─────────────────────────────────────────────────────────────────────────

  async reAnalyze(repositoryPath: string, options: PipelineOptions = {}): Promise<ReAnalysisResult> {
    const previous = await this.registerManager.loadAll();
    const analysis = await this.pipeline.runFullAnalysis(repositoryPath, options);
    const fresh = analysis.initiatives;

    const previousByKey = new Map(previous.map((i) => [normalizeForMatch(i.problemStatement.description), i]));
    const freshByKey = new Map(fresh.map((i) => [normalizeForMatch(i.problemStatement.description), i]));

    const newInitiatives: Initiative[] = [];
    const changedDetails: ScoreChange[] = [];
    let unchanged = 0;
    const merged: Initiative[] = [];

    for (const [key, freshInit] of freshByKey) {
      const prev = previousByKey.get(key);
      if (prev === undefined) {
        newInitiatives.push(freshInit);
        merged.push(freshInit);
        continue;
      }
      if (prev.scoring.finalScore !== freshInit.scoring.finalScore) {
        changedDetails.push({
          id: prev.id,
          previousScore: prev.scoring.finalScore,
          newScore: freshInit.scoring.finalScore,
          reason: "Repository or evidence changed since last analysis",
        });
      } else {
        unchanged++;
      }
      merged.push({
        ...prev,
        evidence: freshInit.evidence,
        scoring: freshInit.scoring,
        updatedAt: new Date().toISOString(),
      });
    }

    const resolved = [...previousByKey.entries()].filter(([key]) => !freshByKey.has(key)).map(([, i]) => i.id);

    await this.registerManager.create(merged);

    return {
      newInitiatives: newInitiatives.length,
      resolvedInitiatives: resolved.length,
      changedScores: changedDetails.length,
      unchangedInitiatives: unchanged,
      changedDetails,
      summary:
        `Found ${newInitiatives.length} new opportunit${newInitiatives.length === 1 ? "y" : "ies"}. ` +
        `${resolved.length} resolved. ${changedDetails.length} changed priority. ${unchanged} remain unchanged.`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // /codepro update INIT-ID
  // ─────────────────────────────────────────────────────────────────────────

  async update(initiativeId: InitiativeId, repositoryPath: string, options: PipelineOptions = {}): Promise<UpdateResult> {
    const init = await this.registerManager.get(initiativeId);
    if (init === null) throw notFound(initiativeId);

    const analysis = await this.pipeline.runFullAnalysis(repositoryPath, options);
    const key = normalizeForMatch(init.problemStatement.description);
    const fresh = analysis.initiatives.find((i) => normalizeForMatch(i.problemStatement.description) === key);

    if (fresh === undefined) {
      throw new ValidationError(
        `No matching finding for ${initiativeId} in the current repository state`,
        [
          {
            field: "problemStatement.description",
            expected: "A matching finding in the fresh analysis",
            received: init.problemStatement.description,
            suggestion: "The underlying problem may already be resolved — run /codepro re-analyze to reconcile the full register",
          },
        ]
      );
    }

    const previousScore = init.scoring.finalScore;
    const updated: Initiative = {
      ...init,
      evidence: fresh.evidence,
      scoring: fresh.scoring,
      updatedAt: new Date().toISOString(),
    };
    await this.registerManager.update(updated);

    return {
      initiativeId,
      evidenceCount: updated.evidence.length,
      scoreChanged: updated.scoring.finalScore !== previousScore,
      previousScore,
      newScore: updated.scoring.finalScore,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // /codepro status
  // ─────────────────────────────────────────────────────────────────────────

  async status(): Promise<StatusResult> {
    const register = await this.registerManager.load();
    const proposed = register.initiatives.filter((i) => i.status === "Proposed");
    const top = proposed.slice().sort((a, b) => b.scoring.finalScore - a.scoring.finalScore)[0] ?? null;

    return {
      totalInitiatives: register.stats.total,
      byStatus: register.stats.byStatus,
      topOpportunity: top !== null ? { id: top.id, name: top.name, score: top.scoring.finalScore } : null,
      lastAnalyzed: register.lastUpdated,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // /codepro help
  // ─────────────────────────────────────────────────────────────────────────

  help(): HelpResult {
    return {
      commands: [
        { name: "/codepro find N", description: "Analyze the repository and generate initiative docs for the top N opportunities (1-10)", example: "/codepro find 5" },
        { name: "/codepro build INIT-ID", description: "Generate the initiative, epic, tech-spec, and ticket documents for one initiative", example: "/codepro build INIT-001" },
        { name: "/codepro review", description: "Audit the register for stale evidence, duplicates, and missing documents", example: "/codepro review" },
        { name: "/codepro re-analyze", description: "Re-run analysis and reconcile the register (new/resolved/changed initiatives)", example: "/codepro re-analyze" },
        { name: "/codepro update INIT-ID", description: "Refresh one initiative's evidence and score from a fresh analysis", example: "/codepro update INIT-001" },
        { name: "/codepro status", description: "Show a register overview: totals by status and the top open opportunity", example: "/codepro status" },
        { name: "/codepro help", description: "List all available commands", example: "/codepro help" },
      ],
    };
  }
}
