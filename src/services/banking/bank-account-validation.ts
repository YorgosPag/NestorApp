/**
 * @fileoverview Επικύρωση πεδίων τραπεζικού λογαριασμού — εισαγωγή & μερική ενημέρωση
 *
 * Εξήχθη από το `bank-accounts-server.service.ts` όταν εκείνο πέρασε τις 500
 * γραμμές (N.7.1). Είναι **καθαρές** συναρτήσεις: κανένα Firestore, κανένας
 * μισθωτής, καμία καταγραφή — άρα ελέγχονται χωρίς να στηθεί υπηρεσία.
 */

import 'server-only';

import { validateIBAN, isCurrencyCode } from '@/types/contacts/banking';
import type { BankAccountInput, BankAccountUpdate } from '@/types/contacts/banking';

/**
 * Validate bank account input fields.
 * @param skipChecksumValidation - When true (AI extraction flows), MOD97 failure is a soft warning
 *   rather than a hard block. Format/length errors still fail hard.
 * Returns null on success, or an error string.
 */
export function validateAccountInput(
  data: BankAccountInput,
  skipChecksumValidation = false,
): string | null {
  if (!data.bankName || typeof data.bankName !== 'string' || data.bankName.trim().length === 0) {
    return 'bankName is required';
  }

  if (!data.iban || typeof data.iban !== 'string') {
    return 'iban is required';
  }

  const ibanResult = validateIBAN(data.iban);
  if (!ibanResult.valid) {
    const isLenientBypassable =
      ibanResult.error === 'Μη έγκυρος αριθμός ελέγχου IBAN' ||
      (typeof ibanResult.error === 'string' &&
        ibanResult.error.startsWith('Το IBAN για ') &&
        ibanResult.error.includes('χαρακτήρες'));
    if (skipChecksumValidation && isLenientBypassable) {
      // Allow through — caller annotates with ibanChecksumWarning flag
    } else {
      return ibanResult.error ?? 'Invalid IBAN';
    }
  }

  if (!isCurrencyCode(data.currency)) {
    return `Invalid currency: ${data.currency}`;
  }

  return null;
}

/**
 * Validate partial update fields.
 * Returns null on success, or an error string.
 */
export function validateAccountUpdate(data: BankAccountUpdate): string | null {
  if (data.bankName !== undefined) {
    if (typeof data.bankName !== 'string' || data.bankName.trim().length === 0) {
      return 'bankName must be a non-empty string';
    }
  }

  if (data.iban !== undefined) {
    if (typeof data.iban !== 'string') {
      return 'iban must be a string';
    }
    const ibanResult = validateIBAN(data.iban);
    if (!ibanResult.valid) {
      return ibanResult.error ?? 'Invalid IBAN';
    }
  }

  if (data.currency !== undefined && !isCurrencyCode(data.currency)) {
    return `Invalid currency: ${data.currency}`;
  }

  return null;
}
