/**
 * 📧 COMMUNICATION ARRAY VALIDATION — Form-level validation for arrays
 *
 * Validates communication arrays (emails, phones, websites) before submission.
 * Catches invalid entries, duplicates, and primary field violations that the
 * component-level validation may miss.
 *
 * @module utils/contactForm/communication-array-validation
 * @enterprise ADR-280 — Communication Field Impact Detection
 */

import { isValidEmail } from '@/lib/validation/email-validation';
import { isValidPhone, cleanPhoneNumber } from '@/lib/validation/phone-validation';
import { isValidUrl } from '@/lib/validation/email-validation';
import type { EmailInfo, PhoneInfo, WebsiteInfo } from '@/types/contacts/contracts';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// TYPES
// ============================================================================

export interface ArrayValidationResult {
  readonly valid: boolean;
  /** i18n key for the error, null when valid */
  readonly errorKey: string | null;
}

const VALID: ArrayValidationResult = { valid: true, errorKey: null };

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

/**
 * Validate emails array:
 * - Each email must be valid format
 * - No duplicate emails (case-insensitive)
 * - Exactly one isPrimary when entries exist
 */
export function validateEmailsArray(emails: ReadonlyArray<EmailInfo>): ArrayValidationResult {
  if (emails.length === 0) return VALID;

  // Check each email is valid
  for (const entry of emails) {
    if (!entry.email || !isValidEmail(entry.email)) {
      return { valid: false, errorKey: 'validation.contacts.arrayValidation.invalidEmail' };
    }
  }

  // Check for duplicates (case-insensitive)
  const seen = new Set<string>();
  for (const entry of emails) {
    const normalized = entry.email.trim().toLowerCase();
    if (seen.has(normalized)) {
      return { valid: false, errorKey: 'validation.contacts.arrayValidation.duplicateEmail' };
    }
    seen.add(normalized);
  }

  // Check primary constraints
  const primaryCount = emails.filter((e) => e.isPrimary).length;
  if (primaryCount === 0) {
    return { valid: false, errorKey: 'validation.contacts.arrayValidation.missingPrimaryEmail' };
  }
  if (primaryCount > 1) {
    return { valid: false, errorKey: 'validation.contacts.arrayValidation.multiplePrimaryEmails' };
  }

  return VALID;
}

// ============================================================================
// PHONE VALIDATION
// ============================================================================

/**
 * Validate phones array:
 * - Each phone number must be valid format
 * - No duplicate numbers (after normalization)
 * - Exactly one isPrimary when entries exist
 */
export function validatePhonesArray(phones: ReadonlyArray<PhoneInfo>): ArrayValidationResult {
  if (phones.length === 0) return VALID;

  // Check each phone is valid
  for (const entry of phones) {
    if (!entry.number || !isValidPhone(entry.number)) {
      return { valid: false, errorKey: 'validation.contacts.arrayValidation.invalidPhone' };
    }
  }

  // Check for duplicates (after cleaning)
  const seen = new Set<string>();
  for (const entry of phones) {
    const normalized = cleanPhoneNumber(entry.number);
    if (seen.has(normalized)) {
      return { valid: false, errorKey: 'validation.contacts.arrayValidation.duplicatePhone' };
    }
    seen.add(normalized);
  }

  // Check primary constraints
  const primaryCount = phones.filter((p) => p.isPrimary).length;
  if (primaryCount === 0) {
    return { valid: false, errorKey: 'validation.contacts.arrayValidation.missingPrimaryPhone' };
  }
  if (primaryCount > 1) {
    return { valid: false, errorKey: 'validation.contacts.arrayValidation.multiplePrimaryPhones' };
  }

  return VALID;
}

// ============================================================================
// WEBSITE VALIDATION
// ============================================================================

/**
 * Validate websites array:
 * - Each URL must be valid HTTP/HTTPS
 * - No duplicate URLs
 */
export function validateWebsitesArray(websites: ReadonlyArray<WebsiteInfo>): ArrayValidationResult {
  if (websites.length === 0) return VALID;

  // Check each URL is valid
  for (const entry of websites) {
    if (!entry.url || !isValidUrl(entry.url)) {
      return { valid: false, errorKey: 'validation.contacts.arrayValidation.invalidUrl' };
    }
  }

  // Check for duplicates (case-insensitive, trimmed)
  const seen = new Set<string>();
  for (const entry of websites) {
    const normalized = entry.url.trim().toLowerCase();
    if (seen.has(normalized)) {
      return { valid: false, errorKey: 'validation.contacts.arrayValidation.duplicateUrl' };
    }
    seen.add(normalized);
  }

  return VALID;
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Validate all communication arrays in the form data.
 * Returns the first validation failure, or valid if all pass.
 */
export function validateCommunicationArrays(formData: ContactFormData): ArrayValidationResult {
  const emailResult = validateEmailsArray(formData.emails ?? []);
  if (!emailResult.valid) return emailResult;

  const phoneResult = validatePhonesArray(formData.phones ?? []);
  if (!phoneResult.valid) return phoneResult;

  const websiteResult = validateWebsitesArray(formData.websites ?? []);
  if (!websiteResult.valid) return websiteResult;

  return VALID;
}
