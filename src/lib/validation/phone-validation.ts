/**
 * @module phone-validation
 * @description Canonical phone validation & text extraction — Single Source of Truth (ADR-212)
 *
 * ALL phone validation in the app MUST import from here.
 * Based on RelationshipValidationService regex (best coverage: Greek + international).
 *
 * Two categories:
 * 1. VALIDATION (anchored) — for form inputs, zod schemas
 * 2. EXTRACTION (non-anchored) — for AI pipeline text parsing
 */

// ============================================================================
// VALIDATION REGEXES (anchored — form inputs)
// ============================================================================

/** Greek mobile (69XXXXXXXX) and landline (2XXXXXXXXX), with optional +30 prefix */
export const GREEK_PHONE_REGEX = /^(\+30)?(69\d{8}|2\d{9})$/;

/** International phones in E.164-like format: +<country><number> (10-15 digits) */
export const INTERNATIONAL_PHONE_REGEX = /^\+[1-9]\d{9,14}$/;

/** Combined: Greek OR international phone */
export const PHONE_REGEX = /^(\+30)?(69\d{8}|2\d{9})$|^\+[1-9]\d{9,14}$/;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate any phone number (Greek or international).
 * Strips spaces, dashes, parentheses before testing.
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return PHONE_REGEX.test(cleaned);
}

/**
 * Validate specifically a Greek phone number (mobile or landline).
 * Strips spaces, dashes, parentheses before testing.
 */
export function isValidGreekPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return GREEK_PHONE_REGEX.test(cleaned);
}

// ============================================================================
// EXTRACTION REGEXES (non-anchored — AI pipeline text parsing)
// ============================================================================

/** Extract Greek phone from free text */
export const GREEK_PHONE_EXTRACT_REGEX = /(?:\+30)?(?:\s?)(?:69\d{8}|2\d{9})/;

/** Extract email from free text */
export const EMAIL_EXTRACT_REGEX = /[\w.+-]+@[\w.-]+\.\w{2,}/;

/** Extract 9-digit VAT number from free text */
export const VAT_EXTRACT_REGEX = /\b\d{9}\b/;

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/** Extract the first Greek phone number from free text, or null */
export function extractPhoneFromText(text: string): string | null {
  const match = text.match(GREEK_PHONE_EXTRACT_REGEX);
  return match ? match[0].replace(/\s/g, '').trim() : null;
}

/** Extract the first email address from free text, or null */
export function extractEmailFromText(text: string): string | null {
  const match = text.match(EMAIL_EXTRACT_REGEX);
  return match ? match[0].toLowerCase().trim() : null;
}

/** Extract the first 9-digit VAT number from free text, or null */
export function extractVatFromText(text: string): string | null {
  const match = text.match(VAT_EXTRACT_REGEX);
  return match ? match[0] : null;
}
