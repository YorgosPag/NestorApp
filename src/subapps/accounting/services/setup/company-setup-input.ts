/**
 * @fileoverview **Ο κριτής εισόδου του `PUT /api/accounting/setup`** — υποχρεωτικά πεδία, ΑΦΜ, ΓΕΜΗ (ADR-ACC-000 §2 · ADR-841 §7 Α23).
 * @module subapps/accounting/services/setup/company-setup-input
 *
 * 🔑 Καθαρό module (χωρίς `server-only`): ο **ίδιος** κριτής τρέχει στο route **και** στην άγκυρα συμβολαίου του σπορέα
 *    golden (ADR-875 §10, `scripts/__tests__/i18n-ssr-golden.test.ts`), ώστε σώμα που θα έπαιρνε 400 να κοκκινίζει ΤΟΠΙΚΑ.
 *
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { GREEK_VAT_REGEX } from '@/lib/validation/greek-vat-number';
import type { CompanySetupInput } from '../../types';

/** Ελέγχει αν το ΑΦΜ είναι 9 ψηφία — η μορφή από το SSoT (`greek-vat-number`), χωρίς ψηφίο ελέγχου. */
function isValidVatNumber(vat: string): boolean {
  return GREEK_VAT_REGEX.test(vat);
}

/**
 * Ο αριθμός ΓΕΜΗ όπως τον έγραψε ο άνθρωπος, ή `null` αν λείπει.
 *
 * ⚠️ Κενό ⇒ `null` και **όχι** `''`: ο ελεύθερος επαγγελματίας **δεν έχει** ΓΕΜΗ, και ένα κενό
 * κείμενο θα διαβαζόταν «δηλωμένος αριθμός» από κάθε καταναλωτή που ελέγχει `!== null`.
 */
export function optionalGemiNumber(body: Partial<CompanySetupInput>): string | null {
  const value = (body as { gemiNumber?: unknown }).gemiNumber;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Ελέγχει αν η αίτηση σύνταξης έχει τα απαραίτητα πεδία — μήνυμα 400 ή `null`. */
export function validateSetupInput(data: Partial<CompanySetupInput>): string | null {
  if (!data.businessName?.trim()) return 'businessName is required';
  if (!data.vatNumber?.trim()) return 'vatNumber is required';
  if (!isValidVatNumber(data.vatNumber.trim())) return 'vatNumber must be exactly 9 digits';
  if (!data.taxOffice?.trim()) return 'taxOffice is required';
  if (!data.address?.trim()) return 'address is required';
  if (!data.city?.trim()) return 'city is required';
  if (!data.postalCode?.trim()) return 'postalCode is required';
  if (!data.profession?.trim()) return 'profession is required';
  if (!data.mainKad?.code?.trim()) return 'mainKad.code is required';
  if (!data.mainKad?.description?.trim()) return 'mainKad.description is required';
  const gemiNumber = optionalGemiNumber(data);
  if (gemiNumber !== null && canonicalGemiNumber(gemiNumber) === null) {
    return 'gemiNumber must be a GEMI number (digits only, up to 12)';
  }
  return null;
}
