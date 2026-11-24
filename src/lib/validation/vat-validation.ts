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
import type { IdentifierHolder } from '@/lib/contacts/contact-identifier-duplicate-policy';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { liveIdentifierHolders } from '@/lib/contacts/live-identifier-holders';
import { GREEK_VAT_REGEX, normalizeVat } from '@/lib/validation/greek-vat-number';

// ============================================================================
// VALIDATION (anchored — form inputs) — ζει στο καθαρό `greek-vat-number.ts`
// ============================================================================

// ⚠️ Επανεξαγωγή, όχι αντίγραφο: ο αλγόριθμος μετακόμισε επειδή αυτό το αρχείο εισάγει
//    `@/lib/firebase` (αρχικοποίηση client στην εισαγωγή) — ADR-861 Φ1.
export {
  GREEK_VAT_REGEX,
  isValidGreekVat,
  isValidGreekVatCheckDigit,
  normalizeVat,
} from '@/lib/validation/greek-vat-number';

// ============================================================================
// EXTRACTION REGEXES (non-anchored — AI pipeline text parsing)
// ============================================================================

/** Extract 9-digit VAT number from free text */
export const VAT_EXTRACT_REGEX = /\b\d{9}\b/;

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

/** Ως 5 κάτοχοι + ενδεχομένως η ίδια η επαφή (εξαιρείται) — αρκετό για να κριθεί «υπάρχει φυσικό πρόσωπο;». */
const VAT_HOLDER_LIMIT = 6;

/**
 * **Όλες** οι άλλες επαφές του χώρου που έχουν αυτό το ΑΦΜ (ADR-944 §9) — όχι μόνο η πρώτη: η απόφαση
 * «απαγόρευση ή επιβεβαίωση» (`decideVatDuplicate`) εξαρτάται από το αν **κάποια** είναι φυσικό πρόσωπο.
 *
 * Ερώτημα χωρίς φίλτρο τύπου (φυσικά πρόσωπα και εταιρείες γράφουν το ΑΦΜ στο `vatNumber`).
 * 🔑 **Fail-open**: αποτυχία ερωτήματος ⇒ κανένας κάτοχος — ο έλεγχος δεν κλειδώνει ποτέ τη φόρμα.
 *
 * @param vatNumber - Το ΑΦΜ (9 ψηφία· αλλιώς καμία ερώτηση)
 * @param companyId - Ο χώρος (απομόνωση μισθωτή)
 * @param excludeContactId - Η επαφή που επεξεργάζεται — δεν είναι κάτοχος του εαυτού της
 */
export async function findVatHolders(
  vatNumber: string,
  companyId: string,
  excludeContactId?: string
): Promise<readonly IdentifierHolder[]> {
  const normalized = normalizeVat(vatNumber);
  if (!GREEK_VAT_REGEX.test(normalized)) return [];

  try {
    const colRef = collection(db, CONTACTS_COLLECTION).withConverter(contactConverter);
    const snapshot = await getDocs(query(
      colRef,
      where('companyId', '==', companyId),
      where('vatNumber', '==', normalized),
      limit(VAT_HOLDER_LIMIT)
    ));
    return liveIdentifierHolders(snapshot.docs, excludeContactId, getContactDisplayName);
  } catch (error) {
    console.error('[vat-validation] findVatHolders error:', error);
    return [];
  }
}

/**
 * Check if a VAT number is already used by another contact within the same company.
 * Λεπτό περιτύλιγμα του {@link findVatHolders}: ο **πρώτος** άλλος κάτοχος, για όσους ρωτούν μόνο «υπάρχει;».
 *
 * @param vatNumber - The VAT number to check (must be 9 digits)
 * @param companyId - Tenant company identifier (required for tenant isolation)
 * @param excludeContactId - Optional ID to exclude (self-exclusion during edit)
 * @returns VatUniquenessResult indicating if the VAT is unique
 */
export async function checkVatUniqueness(
  vatNumber: string,
  companyId: string,
  excludeContactId?: string
): Promise<VatUniquenessResult> {
  return vatUniquenessOf(await findVatHolders(vatNumber, companyId, excludeContactId));
}

/** Οι κάτοχοι στο παλιό σχήμα «υπάρχει; ποιος;» — ο **πρώτος**. Ένα σημείο για τη συνάρτηση και το hook. */
export function vatUniquenessOf(holders: readonly IdentifierHolder[]): VatUniquenessResult {
  const [first] = holders;
  return first === undefined
    ? { isUnique: true, existingContact: null }
    : { isUnique: false, existingContact: { id: first.id, name: first.name, type: first.type } };
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
