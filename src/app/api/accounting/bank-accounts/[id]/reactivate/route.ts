/**
 * =============================================================================
 * POST /api/accounting/bank-accounts/[id]/reactivate — Επανενεργοποίηση λογαριασμού
 * =============================================================================
 *
 * Το αντίστροφο του DELETE (απενεργοποίηση): ρήμα-ενέργεια, όπως `POST /v1/invoices/:id/void` στο Stripe — όχι
 * `PATCH { isActive }`, γιατί η μετάβαση έχει δικό της κανόνα. Ο λογαριασμός επιστρέφει **εκτός** τιμολογίων και
 * χωρίς προεπιλογή (το IBAN που βλέπει ο πελάτης αλλάζει μόνο με ρητή απόφαση — αντι-απάτη). Υπάρχει ήδη ενεργός
 * λογαριασμός με το ίδιο IBAN ⇒ 409. Ξένος ή ανύπαρκτος ⇒ 404. Ίχνος `BANK_ACCOUNT_REACTIVATED`.
 *
 * Auth: withAuth · Rate: sensitive
 *
 * @module api/accounting/bank-accounts/[id]/reactivate
 * @enterprise ADR-ACC-008 §2 · ADR-ACC-018 §15 · ADR-603 Route-Handler Factory
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import type { BankAccountConfig } from '@/subapps/accounting/types';
import { withBankAccountErrors, auditedRepositoryOf } from '../../bank-account-schemas';

export const POST = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to reactivate bank account',
  handler: async ({ auth, params }) => {
    const repository = auditedRepositoryOf(auth);
    const account = await withBankAccountErrors(() => repository.reactivateBankAccount(params.id));
    return ok<BankAccountConfig>(account);
  },
});
