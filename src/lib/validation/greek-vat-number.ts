/**
 * @module greek-vat-number
 * @description **Ο ΑΦΜ ως αριθμός** — μορφή και ψηφίο ελέγχου, χωρίς καμία εξάρτηση.
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΕ ΑΠΟ ΤΟ `vat-validation.ts`** (ADR-861 Φ1, 2026-09-15): εκείνο το αρχείο
 * εισάγει `@/lib/firebase`, που κάνει `initializeApp()` **τη στιγμή της εισαγωγής**. Άρα
 * ο έλεγχος ενός αριθμού έφερνε μαζί τον client της Firebase σε όποιον τον ζητούσε — και
 * η εκκίνηση του διακομιστή (`instrumentation.ts`) που κρίνει τον ΑΦΜ του φορέα της
 * πλατφόρμας **δεν** επιτρέπεται να αρχικοποιεί client SDK για να μετρήσει ψηφία.
 *
 * ⚠️ **ΜΙΑ ΑΛΗΘΕΙΑ**: το `vat-validation.ts` **επανεξάγει** από εδώ — οι υπάρχοντες
 * καταναλωτές δεν άλλαξαν. Μην ξαναγράψεις τον αλγόριθμο αλλού.
 *
 * **Layering**: leaf, καθαρή — πελάτης, διακομιστής, εκκίνηση.
 */

/** Greek VAT number: exactly 9 digits */
export const GREEK_VAT_REGEX = /^\d{9}$/;

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
 * Normalize a VAT number: trim whitespace, strip internal spaces.
 */
export function normalizeVat(vat: string): string {
  return vat.replace(/\s/g, '').trim();
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
