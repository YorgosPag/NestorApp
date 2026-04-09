/**
 * @module vat-validation
 * @description Canonical VAT (ΑΦΜ) validation & uniqueness checking — Single Source of Truth
 *
 * ALL VAT validation in the app MUST import from here.
 * Pattern follows phone-validation.ts (ADR-212).
 *
 * Two categories:
 * 1. VALIDATION (anchored) — for form inputs, zod schemas
 * 2. EXTRACTION (non-anchored) — for AI pipeline text parsing
 * 3. UNIQUENESS CHECK — Firestore cross-type query
 */

import {
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Contact, ContactType } from '@/types/contacts';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';

// ============================================================================
// VALIDATION REGEXES (anchored — form inputs)
// ============================================================================

/** Greek VAT number: exactly 9 digits */
export const GREEK_VAT_REGEX = /^\d{9}$/;

// ============================================================================
// EXTRACTION REGEXES (non-anchored — AI pipeline text parsing)
// ============================================================================

/** Extract 9-digit VAT number from free text */
export const VAT_EXTRACT_REGEX = /\b\d{9}\b/;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Verify the check digit of a Greek VAT number using the official
 * mod-11 weighted algorithm.
 *
 * Algorithm: Multiply digits 1–8 by 2^8, 2^7, ... 2^1 respectively,
 * sum the products, take mod 11. If result is 10, check digit is 0.
 * The 9th digit must equal the computed check digit.
 *
 * @param vat - Normalized 9-digit string (caller must ensure format)
 */
export function isValidGreekVatCheckDigit(vat: string): boolean {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += Number(vat[i]) * (1 << (8 - i)); // 2^8, 2^7, ..., 2^1
  }
  const remainder = sum % 11;
  const checkDigit = remainder === 10 ? 0 : remainder;
  return Number(vat[8]) === checkDigit;
}

/**
 * Validate a Greek VAT number: format (9 digits) + check digit algorithm.
 * Strips spaces before testing.
 */
export function isValidGreekVat(vat: string): boolean {
  const normalized = normalizeVat(vat);
  if (!GREEK_VAT_REGEX.test(normalized)) return false;
  if (normalized === '000000000') return false;
  return isValidGreekVatCheckDigit(normalized);
}

/**
 * Normalize a VAT number: trim whitespace, strip internal spaces.
 */
export function normalizeVat(vat: string): string {
  return vat.replace(/\s/g, '').trim();
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/** Extract the first 9-digit VAT number from free text, or null */
export function extractVatFromText(text: string): string | null {
  const match = text.match(VAT_EXTRACT_REGEX);
  return match ? match[0] : null;
}

// ============================================================================
// UNIQUENESS CHECK (Firestore cross-type query)
// ============================================================================

/**
 * Result of a VAT uniqueness check
 */
export interface VatUniquenessResult {
  isUnique: boolean;
  existingContact: {
    id: string;
    name: string;
    type: ContactType;
  } | null;
}

// SSoT: Collection name from centralized config
import { COLLECTIONS } from '@/config/firestore-collections';
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;

/**
 * Check if a VAT number is already used by another contact.
 * Performs a CROSS-TYPE query (no type filter) to catch duplicates
 * across individual, company, and service contacts.
 *
 * @param vatNumber - The VAT number to check (must be 9 digits)
 * @param excludeContactId - Optional ID to exclude (self-exclusion during edit)
 * @returns VatUniquenessResult indicating if the VAT is unique
 */
export async function checkVatUniqueness(
  vatNumber: string,
  excludeContactId?: string
): Promise<VatUniquenessResult> {
  const normalized = normalizeVat(vatNumber);

  // Only check valid 9-digit VAT numbers
  if (!GREEK_VAT_REGEX.test(normalized)) {
    return { isUnique: true, existingContact: null };
  }

  try {
    const colRef = collection(db, CONTACTS_COLLECTION).withConverter(contactConverter);

    // Cross-type query: NO type filter — catches ALL contact types
    const q = query(
      colRef,
      where('vatNumber', '==', normalized),
      limit(2) // Get up to 2 to handle self-exclusion
    );

    const snapshot = await getDocs(q);

    for (const doc of snapshot.docs) {
      const contact = doc.data();
      const contactId = doc.id;

      // Skip self (during edit)
      if (excludeContactId && contactId === excludeContactId) {
        continue;
      }

      // Build display name based on contact type
      const displayName = getContactDisplayName(contact);

      return {
        isUnique: false,
        existingContact: {
          id: contactId,
          name: displayName,
          type: contact.type,
        },
      };
    }

    return { isUnique: true, existingContact: null };
  } catch (error) {
    // Fail-open: if Firestore query fails, don't block the user
    console.error('[vat-validation] checkVatUniqueness error:', error);
    return { isUnique: true, existingContact: null };
  }
}

/**
 * Get a human-readable display name from a contact document.
 */
function getContactDisplayName(contact: Contact): string {
  switch (contact.type) {
    case 'individual': {
      const first = contact.firstName;
      const last = contact.lastName;
      if (first && last) return `${first} ${last}`;
      if (first) return first;
      if (last) return last;
      return contact.name ?? 'Άγνωστη Επαφή';
    }
    case 'company':
      return contact.companyName ?? contact.name ?? 'Άγνωστη Εταιρεία';
    case 'service':
      return contact.serviceName ?? contact.name ?? 'Άγνωστη Υπηρεσία';
  }
}
