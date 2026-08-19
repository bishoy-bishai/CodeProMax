/**
 * @file markdown-utils.ts
 * @description Shared Markdown-building primitives used by all document generators.
 * Centralizes the [PLACEHOLDER]/[UNKNOWN]/[ASSUMPTION] marker conventions,
 * metadata block rendering, and table-of-contents generation so every
 * generated document is structurally consistent.
 */

import type { DocumentMetadata } from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// GAP MARKERS
// ─────────────────────────────────────────────────────────────────────────────

/** Marks a value that must be filled in by a human before this doc is final */
export function placeholder(text: string): string {
  return `[PLACEHOLDER: ${text}]`;
}

/** Marks a gap in available evidence/data — not fabricated, not yet known */
export function unknownMarker(text: string): string {
  return `[UNKNOWN: ${text}]`;
}

/** Marks a stated assumption made in lieu of confirmed data */
export function assumption(text: string): string {
  return `[ASSUMPTION: ${text}]`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTS & TABLES
// ─────────────────────────────────────────────────────────────────────────────

/** Render a Markdown bullet list; falls back to a single placeholder-style line when empty */
export function bulletList(items: readonly string[], emptyText: string): string {
  if (items.length === 0) return `- ${emptyText}`;
  return items.map((item) => `- ${item}`).join("\n");
}

/** Render the standard metadata table shown at the top of every document */
export function metadataBlock(metadata: DocumentMetadata): string {
  const reviewers =
    metadata.reviewers.length > 0
      ? metadata.reviewers.join(", ")
      : placeholder("assign reviewers");

  return [
    "| Field | Value |",
    "|---|---|",
    `| Version | ${metadata.version} |`,
    `| Generated | ${metadata.generatedAt} |`,
    `| Owner | ${metadata.owner} |`,
    `| Reviewers | ${reviewers} |`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE OF CONTENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert a heading string into a GitHub-style Markdown anchor */
function toAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Extract all H2 (`## `) heading titles from a Markdown document, in order */
export function extractH2Headings(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim());
}

/** Build a Markdown table of contents linking to each H2 heading */
export function buildTableOfContents(headings: readonly string[]): string {
  return headings.map((h) => `- [${h}](#${toAnchor(h)})`).join("\n");
}

/**
 * Insert a "Table of Contents" section immediately after the H1 title
 * when the document exceeds `lineThreshold` lines. No-op otherwise.
 */
export function insertTocIfLong(markdown: string, lineThreshold = 500): string {
  const lines = markdown.split("\n");
  if (lines.length <= lineThreshold) return markdown;

  const headings = extractH2Headings(markdown);
  const toc = ["## Table of Contents", "", buildTableOfContents(headings), ""];

  const firstH1Index = lines.findIndex((line) => line.startsWith("# "));
  const insertAt = firstH1Index === -1 ? 0 : firstH1Index + 1;

  lines.splice(insertAt, 0, "", ...toc);
  return lines.join("\n");
}
