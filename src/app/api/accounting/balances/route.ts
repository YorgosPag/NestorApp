/**
 * =============================================================================
 * GET + POST /api/accounting/balances — Customer Balances & Reconciliation
 * =============================================================================
 *
 * GET:  List all customer balances for a fiscal year (with aging)
 * POST: Trigger batch reconciliation (recalculate all from source)
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/balances
 * @enterprise DECISIONS-PHASE-1b.md Q1-Q4
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { reconcileAllBalances } from '@/subapps/accounting/services/balance-service';
import { resolveFiscalYearParam } from '../_shared/fiscal-year-param';

// ── GET: List customer balances ──────────────────────────────────────────────

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list customer balances',
  handler: async ({ req, auth }) => {
    const fiscalYear = resolveFiscalYearParam(req);

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const balances = await repository.listCustomerBalances(fiscalYear);

    return ok({ items: balances, total: balances.length, fiscalYear });
  },
});

// ── POST: Trigger batch reconciliation ───────────────────────────────────────

export const POST = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to reconcile balances',
  handler: async ({ req, auth }) => {
    const body = await req.json() as { fiscalYear?: number };
    const fiscalYear = body.fiscalYear ?? new Date().getFullYear();

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const result = await reconcileAllBalances(repository, fiscalYear);

    return ok({ ...result, fiscalYear });
  },
});
