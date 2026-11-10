/**
 * =============================================================================
 * PATCH  /api/accounting/bank-accounts/[id] — Αλλαγή λογαριασμού (όχι IBAN/νόμισμα)
 * DELETE /api/accounting/bank-accounts/[id] — Απενεργοποίηση (ποτέ διαγραφή)
 * =============================================================================
 *
 * Ξένος ή ανύπαρκτος λογαριασμός ⇒ 404 (ο γραφέας ελέγχει `companyId` μέσα στη συναλλαγή).
 * DELETE = απενεργοποίηση: οι τραπεζικές κινήσεις και τα ίχνη κρατούν `accountId` (ADR-ACC-008).
 * Ίχνος `BANK_ACCOUNT_UPDATED` / `BANK_ACCOUNT_DEACTIVATED` (audited repository).
 *
 * Auth: withAuth · Rate: sensitive
 *
 * @module api/accounting/bank-accounts/[id]
 * @enterprise ADR-ACC-008 §2 · ADR-ACC-018 §15 · ADR-603 Route-Handler Factory
 */

import 'server-only';

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import type { BankAccountConfig } from '@/subapps/accounting/types';
import { UpdateBankAccountSchema, withBankAccountErrors, auditedRepositoryOf } from '../bank-account-schemas';

export const PATCH = defineRoute({
  rateLimit: 'sensitive',
  schema: UpdateBankAccountSchema,
  fallbackError: 'Failed to update bank account',
  handler: async ({ auth, body, params }) => {
    if (Object.keys(body).length === 0) badRequest('No update fields provided');
    const repository = auditedRepositoryOf(auth);
    const account = await withBankAccountErrors(() => repository.updateBankAccount(params.id, body));
    return ok<BankAccountConfig>(account);
  },
});

export const DELETE = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to deactivate bank account',
  handler: async ({ auth, params }) => {
    const repository = auditedRepositoryOf(auth);
    const account = await withBankAccountErrors(() => repository.deactivateBankAccount(params.id));
    return ok<BankAccountConfig>(account);
  },
});
