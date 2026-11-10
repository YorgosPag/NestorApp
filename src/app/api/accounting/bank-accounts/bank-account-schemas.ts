/**
 * @fileoverview Bank accounts API — σχήματα · audited repository · μετάφραση σφαλμάτων (ΕΝΑ σημείο για όλα τα ρήματα)
 * @description Ο διακομιστής ξαναελέγχει IBAN (ISO 13616, mod 97) και BIC (ISO 9362) — ποτέ εμπιστοσύνη στη φόρμα.
 * @module api/accounting/bank-accounts/bank-account-schemas
 * @see ADR-ACC-008 §2 · ADR-ACC-018 §15
 */

import { z } from 'zod';

import { conflict, httpError, notFound } from '@/lib/api/define-route';
import type { AuthContext } from '@/lib/auth';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { createAuditedRepository } from '@/subapps/accounting/services/audited-repository-wrapper';
import {
  BANK_ACCOUNT_CURRENCIES, isCurrencyCode, isValidBIC, validateIBAN, type CurrencyCode,
} from '@/types/contacts/banking';
import { BANK_ACCOUNT_TYPES } from '@/subapps/accounting/types';
import {
  BicIbanMismatchError, DuplicateBankAccountError,
} from '@/subapps/accounting/services/repository/accounting-repo-bank-accounts';
import { OwnedDocumentNotFoundError } from '@/subapps/accounting/services/repository/tenant-owned-doc';

const bic = z
  .string()
  .max(20)
  .nullable()
  .refine((value) => value === null || value.trim() === '' || isValidBIC(value), { message: 'bankCode is not a valid BIC (ISO 9362)' })
  .transform((value) => (value === null || value.trim() === '' ? null : value));

const mutableFields = {
  bankName: z.string().trim().min(1).max(120),
  bankCode: bic,
  /** Η επωνυμία όπως είναι γνωστή στην τράπεζα — EPC QR «Name» έως 70 χαρακτήρες. */
  holderName: z.string().trim().min(1).max(70),
  label: z.string().trim().max(80),
  type: z.enum(BANK_ACCOUNT_TYPES),
  showOnInvoices: z.boolean(),
  isDefaultForInvoices: z.boolean(),
  notes: z.string().max(1000).nullable(),
};

export const CreateBankAccountSchema = z.object({
  ...mutableFields,
  iban: z.string().max(42).refine((value) => validateIBAN(value).valid, { message: 'iban is not a valid IBAN (ISO 13616)' }),
  currency: z.custom<CurrencyCode>((value) => typeof value === 'string' && isCurrencyCode(value), {
    message: `currency must be one of ${BANK_ACCOUNT_CURRENCIES.join(', ')}`,
  }).default('EUR'),
}).strict();

/** Το IBAN και το νόμισμα δεν αλλάζουν: άλλο IBAN = άλλος λογαριασμός (ίχνος + κινήσεις δεμένες στο παλιό). */
export const UpdateBankAccountSchema = z.object({
  bankName: mutableFields.bankName.optional(),
  bankCode: mutableFields.bankCode.optional(),
  holderName: mutableFields.holderName.optional(),
  label: mutableFields.label.optional(),
  type: mutableFields.type.optional(),
  showOnInvoices: mutableFields.showOnInvoices.optional(),
  isDefaultForInvoices: mutableFields.isDefaultForInvoices.optional(),
  notes: mutableFields.notes.optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
}).strict();

/** Κάθε εγγραφή λογαριασμού αφήνει ίχνος — ο wrapper είναι ρητός ανά διαδρομή (όπως στο `/setup`). */
export function auditedRepositoryOf(auth: AuthContext) {
  const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
  return createAuditedRepository(repository, auth.uid, auth.companyId);
}

/** Τα σφάλματα του γραφέα ως απαντήσεις HTTP — ξένο ≡ ανύπαρκτο (404), διπλό IBAN = 409, BIC άλλης τράπεζας = 422. */
export async function withBankAccountErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DuplicateBankAccountError) conflict('An active bank account with this IBAN already exists');
    if (error instanceof BicIbanMismatchError) httpError(422, error.message);
    if (error instanceof OwnedDocumentNotFoundError) notFound('Bank account not found');
    throw error;
  }
}
