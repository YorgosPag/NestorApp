/**
 * @fileoverview Κατάσταση της φόρμας τραπεζικού λογαριασμού — καθαρές συναρτήσεις (ADR-ACC-018 §15)
 * @description Από/προς `BankAccountConfig` και `CreateBankAccountInput`, και ο έλεγχος πριν από την αποστολή.
 *   Ο διακομιστής ξαναελέγχει τα πάντα· εδώ ο έλεγχος υπάρχει για να πει στον άνθρωπο **τι** λείπει πριν πατήσει.
 */

import { cleanBIC, cleanIBAN, isValidBIC, validateIBAN } from '@/types/contacts/banking';
import { getBankByIBAN } from '@/constants/greek-banks';
import {
  BANK_ACCOUNT_TYPES,
  type BankAccountConfig, type BankAccountType, type CreateBankAccountInput, type UpdateBankAccountInput,
} from '../../types';

export interface BankAccountFormState {
  iban: string;
  bankName: string;
  bankCode: string;
  holderName: string;
  label: string;
  type: BankAccountType;
  showOnInvoices: boolean;
  isDefaultForInvoices: boolean;
  notes: string;
}

/** Τα κλειδιά i18n των σφαλμάτων (`setup.bankAccounts.errors.*`). */
export type BankAccountFormError =
  | 'ibanInvalid' | 'bicInvalid' | 'bankNameRequired' | 'holderNameRequired'
  | 'duplicateIban' | 'notFound' | 'saveFailed';

/** Νέος λογαριασμός: τυπώνεται στα τιμολόγια — ο πρώτος γίνεται αυτόματα και προεπιλεγμένος (από τον γραφέα). */
export function emptyBankAccountForm(defaultHolderName: string): BankAccountFormState {
  return {
    iban: '', bankName: '', bankCode: '', holderName: defaultHolderName, label: '', type: 'business',
    showOnInvoices: true, isDefaultForInvoices: false, notes: '',
  };
}

export function bankAccountFormOf(account: BankAccountConfig, defaultHolderName: string): BankAccountFormState {
  return {
    iban: account.iban, bankName: account.bankName, bankCode: account.bankCode ?? '',
    holderName: account.holderName ?? defaultHolderName, label: account.label, type: account.type,
    showOnInvoices: account.showOnInvoices === true, isDefaultForInvoices: account.isDefaultForInvoices === true,
    notes: account.notes ?? '',
  };
}

/** Πληκτρολογήθηκε IBAN: συμπληρώνει τράπεζα + BIC από τον κατάλογο **μόνο** αν ο χρήστης δεν τα έγραψε ήδη. */
export function withDetectedBank(form: BankAccountFormState, iban: string): BankAccountFormState {
  const bank = validateIBAN(iban).valid ? getBankByIBAN(iban) : undefined;
  return {
    ...form,
    iban,
    bankName: form.bankName.trim() ? form.bankName : bank?.name ?? form.bankName,
    bankCode: form.bankCode.trim() ? form.bankCode : bank?.code ?? form.bankCode,
  };
}

/** Το πρώτο πρόβλημα της φόρμας, ή `null`. Το IBAN ελέγχεται μόνο στη δημιουργία (δεν αλλάζει ποτέ). */
export function bankAccountFormError(form: BankAccountFormState, isCreate: boolean): BankAccountFormError | null {
  if (isCreate && !validateIBAN(form.iban).valid) return 'ibanInvalid';
  if (!form.bankName.trim()) return 'bankNameRequired';
  if (form.bankCode.trim() && !isValidBIC(form.bankCode)) return 'bicInvalid';
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
  return 'saveFailed';
}
