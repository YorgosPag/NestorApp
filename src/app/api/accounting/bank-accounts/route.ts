/**
 * =============================================================================
 * GET  /api/accounting/bank-accounts — Οι λογαριασμοί της εταιρείας
 * POST /api/accounting/bank-accounts — Νέος λογαριασμός
 * =============================================================================
 *
 * GET:  ενεργοί (προεπιλογή) · `?includeInactive=true` ⇒ και οι απενεργοποιημένοι.
 * POST: IBAN + BIC επικυρώνονται στον διακομιστή· μοναδικό IBAN + ένας προεπιλεγμένος για τιμολόγια επιβάλλονται
 *       από τον ΕΝΑ γραφέα μέσα σε συναλλαγή. Ίχνος `BANK_ACCOUNT_CREATED` (audited repository).
 *
 * Auth: withAuth · Rate: GET → standard | POST → sensitive
 *
 * @module api/accounting/bank-accounts
 * @enterprise ADR-ACC-008 §2 · ADR-ACC-018 §15 · ADR-603 Route-Handler Factory
 */

import 'server-only';

import { defineRoute, ok, created } from '@/lib/api/define-route';
import type { BankAccountConfig } from '@/subapps/accounting/types';
import { CreateBankAccountSchema, withBankAccountErrors, auditedRepositoryOf } from './bank-account-schemas';

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list bank accounts',
  handler: async ({ req, auth }) => {
    const includeInactive = new URL(req.url).searchParams.get('includeInactive') === 'true';
    const repository = auditedRepositoryOf(auth);
    return ok<BankAccountConfig[]>(await repository.listBankAccounts(includeInactive));
  },
});

export const POST = defineRoute({
  rateLimit: 'sensitive',
  schema: CreateBankAccountSchema,
  fallbackError: 'Failed to create bank account',
  handler: async ({ auth, body }) => {
    const repository = auditedRepositoryOf(auth);
    const account = await withBankAccountErrors(() => repository.createBankAccount(body));
    return created<BankAccountConfig>(account);
  },
});
