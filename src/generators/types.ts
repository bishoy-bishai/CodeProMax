/**
 * @file types.ts (generators layer)
 * @description Type definitions for the document generation layer.
 * Sits above the services layer; converts an Initiative into human-readable
 * Markdown planning artifacts.
 */

import type { ISOTimestamp } from "../schemas/types.ts";
import type { RootCauseAnalysis } from "../analyzers/types.ts";

/** Metadata block rendered at the top of every generated document */
export interface DocumentMetadata {
  version: string;
  generatedAt: ISOTimestamp;
  owner: string;
  reviewers: string[];
}

/** Options accepted by every document generator */
export interface GeneratorOptions {
  /**
   * Root cause analysis for the initiative's originating finding.
   * Optional — Initiative does not persist RCA data. When omitted, the
   * Root Cause section falls back to the problem statement and is marked
   * with an explicit [UNKNOWN] marker.
   */
  rca?: RootCauseAnalysis | null;
  /** Reviewer handles/names; defaults to the initiative's stakeholders */
  reviewers?: string[];
  /** Document version string; defaults to "0.1.0" */
  version?: string;
}
