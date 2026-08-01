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
