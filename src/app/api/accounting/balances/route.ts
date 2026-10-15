/**
 * =============================================================================
 * GET + POST /api/accounting/balances — Customer Balances & Reconciliation
 * =============================================================================
 *
 * GET:  List all stored customer balances (open items of ALL fiscal years, with aging)
 * POST: Trigger batch reconciliation (recalculate all from source) as of a day (default: today, Athens)
 *
 * 🔑 ADR-ACC-010 §2.1.1 Φάση 3 (2026-10-15): το υπόλοιπο πελάτη ΔΕΝ είναι ανά χρήση (SAP FI-AR / Xero / QuickBooks)·
 * το `fiscalYear` αφαιρέθηκε — το έγγραφο έχει κλειδί τον πελάτη και κάθε χρήση έσβηνε την άλλη.
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/balances
 * @enterprise DECISIONS-PHASE-1b.md Q1-Q4
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';

import { defineRoute, ok } from '@/lib/api/define-route';
import { isDateKey } from '@/lib/calendar/date-key';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { reconcileAllBalances } from '@/subapps/accounting/services/balance-service';

const ReconcileSchema = z.object({
  asOf: z.string().refine(isDateKey, 'asOf must be an existing YYYY-MM-DD day').optional(),
});

// ── GET: List customer balances ──────────────────────────────────────────────

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list customer balances',
  handler: async ({ auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const balances = await repository.listCustomerBalances();

    return ok({ items: balances, total: balances.length });
  },
});

// ── POST: Trigger batch reconciliation ───────────────────────────────────────

export const POST = defineRoute({
  rateLimit: 'standard',
  schema: ReconcileSchema,
  fallbackError: 'Failed to reconcile balances',
  handler: async ({ auth, body }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const result = await reconcileAllBalances(repository, body.asOf);

    return ok(result);
  },
});
