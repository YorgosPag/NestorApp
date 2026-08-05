/**
 * @module email-validation
 * @description Canonical email validation — Single Source of Truth (ADR-209 Phase 8)
 *
 * ALL email validation in the app MUST import from here.
 * Re-exported via `@/components/ui/email-sharing/types` for backward compatibility.
 */

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

/**
 * Standard email validation regex.
 * Covers typical user@domain.tld patterns. For RFC 5322 full compliance,
 * server-side validation is the authoritative check.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email address string.
 * Trims whitespace before testing.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Validate that a string is a well-formed HTTP/HTTPS URL.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A bare host (`www.nikolaou.com.gr`) → a URL that {@link isValidUrl} accepts.
 *
 * 🔴 **Why this exists in the same house as `isValidUrl`.** `extractAllUrlsFromText` deliberately
 * accepts a bare `www.` host — see the note below — so everything it extracts from a drawing,
 * an e-mail body or a scanned document arrives **without a scheme** and is therefore rejected by
 * the very validator that guards the write. Producer and validator disagreed by construction,
 * and every caller closed the gap privately: measured 2026-08-05, four call sites each carried
 * their own `startsWith('http') ? v : \`https://${v}\`` (`UniversalClickableField`,
 * `EmailContentRenderer` ×2, `contact-handler`). One question, one answer.
 *
 * `https` and not `http`: a site reachable over plain HTTP is reachable over neither more nor
 * less than what the user typed, while the reverse choice would silently downgrade every link
 * the app stores. Anything already carrying a scheme is returned untouched.
 */
export function ensureHttpUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Extract a web address from free text — scheme, or a bare `www.` host.
 *
 * A scheme or a `www.` prefix is **required**, which deliberately misses `example.gr`
 * written without either. That is the safe direction: Greek technical text is dense with
 * dotted abbreviations (`Ο.Τ.`, `Α.Π.Θ.`, `Δ.Ε.`), and a bare-domain rule turns every one
 * of them into a phantom website. It also means an email address never registers as a URL,
 * because its host carries neither marker.
 */
export const WEB_URL_EXTRACT_REGEX =
  /(?:https?:\/\/|www\.)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,6}(?:\/\S*)?/;

/** Every web address in free text, in order of appearance, without repeats. */
export function extractAllUrlsFromText(text: string): string[] {
  const global = new RegExp(WEB_URL_EXTRACT_REGEX.source, 'g');
  return [...new Set([...text.matchAll(global)].map((m) => m[0]))];
}
