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
