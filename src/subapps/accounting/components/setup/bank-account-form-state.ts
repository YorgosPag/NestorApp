/**
 * @fileoverview Κατάσταση της φόρμας τραπεζικού λογαριασμού — καθαρές συναρτήσεις (ADR-ACC-018 §15)
 * @description Από/προς `BankAccountConfig` και `CreateBankAccountInput`, και ο έλεγχος πριν από την αποστολή.
 *   Ο διακομιστής ξαναελέγχει τα πάντα· εδώ ο έλεγχος υπάρχει για να πει στον άνθρωπο **τι** λείπει πριν πατήσει.
 */

import { cleanBIC, cleanIBAN, isValidBIC, validateIBAN } from '@/types/contacts/banking';
import { bicAgreementWithIBAN, getBankByIBAN } from '@/constants/greek-banks';
import {
  BANK_ACCOUNT_TYPES,
  type BankAccountConfig, type BankAccountType, type CreateBankAccountInput, type UpdateBankAccountInput,
} from '../../types';

/**
 * Από πού ήρθαν τράπεζα + BIC: `derived` = από το IBAN (τα ξαναγράφει κάθε αλλαγή IBAN) · `manual` = τα έγραψε ή τα
 * διάλεξε ο χρήστης (δεν τα αγγίζει τίποτα). Πρότυπο «παράγωγο μέχρι να το παρακάμψεις» — ποτέ μπαγιάτικο.
 */
export type BankDetailsSource = 'derived' | 'manual';

export interface BankAccountFormState {
  iban: string;
  bankName: string;
  bankCode: string;
  bankSource: BankDetailsSource;
  holderName: string;
  label: string;
  type: BankAccountType;
  showOnInvoices: boolean;
  isDefaultForInvoices: boolean;
  notes: string;
}

/** Τα κλειδιά i18n των σφαλμάτων (`setup.bankAccounts.errors.*`). */
export type BankAccountFormError =
  | 'ibanInvalid' | 'bicInvalid' | 'bicMismatch' | 'bankNameRequired' | 'holderNameRequired'
  | 'duplicateIban' | 'notFound' | 'saveFailed';

/** Νέος λογαριασμός: τυπώνεται στα τιμολόγια — ο πρώτος γίνεται αυτόματα και προεπιλεγμένος (από τον γραφέα). */
export function emptyBankAccountForm(defaultHolderName: string): BankAccountFormState {
  return {
    iban: '', bankName: '', bankCode: '', bankSource: 'derived', holderName: defaultHolderName, label: '', type: 'business',
    showOnInvoices: true, isDefaultForInvoices: false, notes: '',
  };
}

export function bankAccountFormOf(account: BankAccountConfig, defaultHolderName: string): BankAccountFormState {
  return {
    // Αποθηκευμένος λογαριασμός: το IBAN κλειδώνει, άρα τράπεζα + BIC είναι πια δική του απόφαση του χρήστη.
    iban: account.iban, bankName: account.bankName, bankCode: account.bankCode ?? '', bankSource: 'manual',
    holderName: account.holderName ?? defaultHolderName, label: account.label, type: account.type,
    showOnInvoices: account.showOnInvoices === true, isDefaultForInvoices: account.isDefaultForInvoices === true,
    notes: account.notes ?? '',
  };
}

/**
 * Πληκτρολογήθηκε IBAN: όσο τράπεζα + BIC είναι **παράγωγα** (ή άδεια), ακολουθούν το νέο IBAN — και αδειάζουν αν ο
 * κατάλογος δεν το αναγνωρίζει, ώστε να μη μείνει η τράπεζα του προηγούμενου IBAN. Χειροκίνητη επιλογή δεν αγγίζεται.
 */
export function withDetectedBank(form: BankAccountFormState, iban: string): BankAccountFormState {
  const follows = form.bankSource === 'derived' || (!form.bankName.trim() && !form.bankCode.trim());
  if (!follows) return { ...form, iban };
  const bank = validateIBAN(iban).valid ? getBankByIBAN(iban) : undefined;
  return { ...form, iban, bankName: bank?.name ?? '', bankCode: bank?.code ?? '', bankSource: 'derived' };
}

/** Ο χρήστης έγραψε ή διάλεξε τράπεζα/BIC: από εδώ και πέρα δεν τα ξαναγράφει το IBAN. */
export function withManualBank(changes: Pick<Partial<BankAccountFormState>, 'bankName' | 'bankCode'>): Partial<BankAccountFormState> {
  return { ...changes, bankSource: 'manual' };
}

/** Το πρώτο πρόβλημα της φόρμας, ή `null`. Το IBAN ελέγχεται μόνο στη δημιουργία (δεν αλλάζει ποτέ). */
export function bankAccountFormError(form: BankAccountFormState, isCreate: boolean): BankAccountFormError | null {
  if (isCreate && !validateIBAN(form.iban).valid) return 'ibanInvalid';
  if (!form.bankName.trim()) return 'bankNameRequired';
  if (form.bankCode.trim() && !isValidBIC(form.bankCode)) return 'bicInvalid';
  if (form.bankCode.trim() && bicAgreementWithIBAN(form.iban, form.bankCode) === 'mismatch') return 'bicMismatch';
  if (!form.holderName.trim()) return 'holderNameRequired';
  return null;
}

export function createInputOf(form: BankAccountFormState): CreateBankAccountInput {
  return { ...updateInputOf(form), iban: cleanIBAN(form.iban), currency: 'EUR' };
}

export function updateInputOf(form: BankAccountFormState): Required<Omit<UpdateBankAccountInput, 'sortOrder'>> {
  return {
    bankName: form.bankName.trim(),
    bankCode: form.bankCode.trim() ? cleanBIC(form.bankCode) : null,
    holderName: form.holderName.trim(),
    label: form.label.trim(),
    type: form.type,
    showOnInvoices: form.showOnInvoices,
    isDefaultForInvoices: form.showOnInvoices && form.isDefaultForInvoices,
    notes: form.notes.trim() || null,
  };
}

/** Φρουρός για την τιμή του επιλογέα τύπου (string του Radix Select). */
export function isBankAccountType(value: string): value is BankAccountType {
  return (BANK_ACCOUNT_TYPES as readonly string[]).includes(value);
}

/** Ο κωδικός HTTP της αποτυχίας ως κλειδί σφάλματος της φόρμας. */
export function bankAccountErrorOfStatus(statusCode: number | null): BankAccountFormError {
  if (statusCode === 409) return 'duplicateIban';
  if (statusCode === 404) return 'notFound';
  if (statusCode === 422) return 'bicMismatch';
  return 'saveFailed';
}
