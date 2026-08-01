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

/** Combined: Greek OR international phone */
export const PHONE_REGEX = /^(\+30)?(69\d{8}|2\d{9})$|^\+[1-9]\d{9,14}$/;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Normalize a phone number by stripping spaces, dashes, parentheses.
 * SSoT for phone cleaning — used by validators and storage.
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
}

/**
 * Validate any phone number (Greek or international).
 * Strips spaces, dashes, parentheses before testing.
 */
export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(cleanPhoneNumber(phone));
}

/**
 * Validate specifically a Greek phone number (mobile or landline).
 * Strips spaces, dashes, parentheses before testing.
 */
export function isValidGreekPhone(phone: string): boolean {
  return GREEK_PHONE_REGEX.test(cleanPhoneNumber(phone));
}

// ============================================================================
// EXTRACTION REGEXES (non-anchored — AI pipeline text parsing)
// ============================================================================

/** Extract Greek phone from free text */
export const GREEK_PHONE_EXTRACT_REGEX = /(?:\+30)?(?:\s?)(?:69\d{8}|2\d{9})/;

/** Extract email from free text */
export const EMAIL_EXTRACT_REGEX = /[\w.+-]+@[\w.-]+\.\w{2,}/;

/** Extract 9-digit VAT number from free text — re-exported from vat-validation.ts (SSoT) */
export { VAT_EXTRACT_REGEX } from './vat-validation';

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

// ============================================================================
// EXHAUSTIVE EXTRACTION (all occurrences — CAD title blocks, letterheads, OCR)
// ============================================================================

/**
 * A run that could be a written phone number: digits plus the separators people type.
 * Deliberately excludes `.` — `cleanPhoneNumber` does not strip it, so allowing it here
 * would build candidates that can never validate.
 */
const PHONE_CANDIDATE_RUN = /[+\d][+\d\s\-()]*/g;

/** Preserve first-seen order while removing repeats. */
function distinct(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Every Greek phone number in free text, in order of appearance.
 *
 * Written phones carry separators the anchored validator rejects (`2310-788493`), so each
 * candidate run is cleaned through {@link cleanPhoneNumber} before validation. When a run
 * holds two numbers separated only by whitespace, the whole run fails and the run is retried
 * per whitespace-separated part — otherwise both numbers would be lost together.
 */
export function extractAllPhonesFromText(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(PHONE_CANDIDATE_RUN)) {
    const whole = cleanPhoneNumber(match[0]);
    if (isValidPhone(whole)) {
      found.push(whole);
      continue;
    }
    for (const part of match[0].split(/\s+/)) {
      const cleaned = cleanPhoneNumber(part);
      if (isValidPhone(cleaned)) found.push(cleaned);
    }
  }
  return distinct(found);
}

/** Every email address in free text, lowercased, in order of appearance. */
export function extractAllEmailsFromText(text: string): string[] {
  const global = new RegExp(EMAIL_EXTRACT_REGEX.source, 'g');
  return distinct([...text.matchAll(global)].map((m) => m[0].toLowerCase()));
}

/** Extract the first 9-digit VAT number from free text — re-exported from vat-validation.ts (SSoT) */
export { extractVatFromText } from './vat-validation';
