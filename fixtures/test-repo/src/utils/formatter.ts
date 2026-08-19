/**
 * @file formatter.ts (FIXTURE — used for duplicate code detection)
 * Contains formatting utilities. Intentionally duplicates sanitizeString from validator.ts.
 */

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(date: Date, locale = "en-US"): string {
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

// ── DUPLICATED BLOCK (intentionally copied from validator.ts) ─────────────
// This is an exact duplicate of sanitizeString in validator.ts
export function sanitizeOutput(input: string): string {
  if (!input) return "";
  let result = input.trim();
  result = result.replace(/[<>'"&]/g, (char) => {
    switch (char) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "'": return "&#39;";
      case '"': return "&quot;";
      case "&": return "&amp;";
      default: return char;
    }
  });
  result = result.replace(/\s+/g, " ");
  return result;
}

export function padNumber(n: number, width: number): string {
  return String(n).padStart(width, "0");
}
