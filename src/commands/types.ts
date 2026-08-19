/**
 * @file types.ts (commands layer)
 * @description Return types for every /codepro command.
 */

import type { Initiative, InitiativeId, InitiativeStatus, ISOTimestamp, StatusBreakdown } from "../schemas/types.ts";
import type { PipelineStatus } from "../services/types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// find
// ─────────────────────────────────────────────────────────────────────────────

export interface FindResult {
  initiatives: Initiative[];
  filesCreated: string[];
  analysisId: string;
  analysisStatus: PipelineStatus;
  analysisDurationMs: number;
  evidenceCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// build
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildResult {
  initiativeId: InitiativeId;
  filesCreated: string[];
  ticketCount: number;
  consistencyValid: boolean;
  consistencyErrors: string[];
  finalStatus: InitiativeStatus;
  /** Explains why the status did not advance further (empty if it reached "Planned") */
  transitionWarnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// review
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewSeverity = "error" | "warning" | "info";

export interface ReviewIssue {
  severity: ReviewSeverity;
  initiativeId: InitiativeId;
  issue: string;
  recommendation: string;
}

export interface ReviewResult {
  initiativeCount: number;
  issuesFound: number;
  issues: ReviewIssue[];
}

// ─────────────────────────────────────────────────────────────────────────────
// re-analyze
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreChange {
  id: InitiativeId;
  previousScore: number;
  newScore: number;
  reason: string;
}

export interface ReAnalysisResult {
  newInitiatives: number;
  resolvedInitiatives: number;
  changedScores: number;
  unchangedInitiatives: number;
  changedDetails: ScoreChange[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// update
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdateResult {
  initiativeId: InitiativeId;
  evidenceCount: number;
  scoreChanged: boolean;
  previousScore: number;
  newScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// status
// ─────────────────────────────────────────────────────────────────────────────

export interface TopOpportunity {
  id: InitiativeId;
  name: string;
  score: number;
}

export interface StatusResult {
  totalInitiatives: number;
  byStatus: StatusBreakdown;
  topOpportunity: TopOpportunity | null;
  lastAnalyzed: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// help
// ─────────────────────────────────────────────────────────────────────────────

export interface HelpCommand {
  name: string;
  description: string;
  example: string;
}

export interface HelpResult {
  commands: HelpCommand[];
}
