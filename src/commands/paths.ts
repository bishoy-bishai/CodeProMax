/**
 * @file paths.ts
 * @description Single source of truth for the on-disk layout of generated
 * documents, so every command agrees on where things live.
 *
 *   {base}/documents/initiatives/register.json        — machine-readable register (source of truth)
 *   {base}/documents/initiatives/initiative-register.md — human-readable summary (regenerated, never parsed)
 *   {base}/documents/initiatives/{slug}/initiative.md
 *   {base}/documents/initiatives/{slug}/epic.md
 *   {base}/documents/initiatives/{slug}/tech-spec.md
 *   {base}/documents/initiatives/{slug}/tickets/{NN}-{ticket-slug}.md
 */

import { join } from "path";

export function initiativesDir(base: string): string {
  return join(base, "documents", "initiatives");
}

export function registerJsonPath(base: string): string {
  return join(initiativesDir(base), "register.json");
}

export function registerMarkdownPath(base: string): string {
  return join(initiativesDir(base), "initiative-register.md");
}

export function initiativeFolder(base: string, slug: string): string {
  return join(initiativesDir(base), slug);
}

export function initiativeDocPath(base: string, slug: string): string {
  return join(initiativeFolder(base, slug), "initiative.md");
}

export function epicDocPath(base: string, slug: string): string {
  return join(initiativeFolder(base, slug), "epic.md");
}

export function techSpecDocPath(base: string, slug: string): string {
  return join(initiativeFolder(base, slug), "tech-spec.md");
}

export function ticketsDir(base: string, slug: string): string {
  return join(initiativeFolder(base, slug), "tickets");
}

export function ticketDocPath(base: string, slug: string, index: number, ticketSlug: string): string {
  return join(ticketsDir(base, slug), `${String(index).padStart(2, "0")}-${ticketSlug}.md`);
}

/** kebab-case slug for a ticket title, used only for file naming */
export function slugifyTicketTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}
