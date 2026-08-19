/**
 * @file validator.ts (FIXTURE — used for duplicate code detection)
 * Contains validation utilities. Intentionally similar to formatter.ts.
 */

export function validateEmail(email: string): boolean {
  if (!email || email.trim() === "") return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length === 0) return false;
  if (!domain || !domain.includes(".")) return false;
  if (domain.endsWith(".")) return false;
  return true;
}

export function validatePhoneNumber(phone: string): boolean {
  if (!phone || phone.trim() === "") return false;
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.length < 7 || cleaned.length > 15) return false;
  return /^\+?[0-9]+$/.test(cleaned);
}

export function validatePostalCode(code: string, country: string): boolean {
  if (!code || code.trim() === "") return false;
  if (country === "US") return /^\d{5}(-\d{4})?$/.test(code);
  if (country === "UK") return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(code);
  return code.length >= 3 && code.length <= 10;
}

// ── DUPLICATED BLOCK (intentionally duplicated in formatter.ts) ─────────────
export function sanitizeString(input: string): string {
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

export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
