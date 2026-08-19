/**
 * @file ticket-markdown.ts
 * @description Renders a single Ticket as a standalone Markdown file, for
 * writing into a {slug}/tickets/{NN}-{ticket-slug}.md path.
 */

import type { Ticket } from "../ticket-types.ts";
import { bulletList } from "./markdown-utils.ts";

export function renderTicketMarkdown(ticket: Ticket): string {
  const deps = ticket.dependencies.length > 0 ? ticket.dependencies.join(", ") : "None";

  return `# ${ticket.id}: ${ticket.title}

**Effort:** ${ticket.effortLabel} — **Dependencies:** ${deps}

## Story

\`\`\`
${ticket.story}
\`\`\`

## Acceptance Criteria

\`\`\`gherkin
${ticket.acceptanceCriteria}
\`\`\`

## Technical Notes

${ticket.technicalNotes}

## Definition of Done

${bulletList(ticket.definitionOfDone, "None recorded")}
`;
}
