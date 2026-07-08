/**
 * =============================================================================
 * GET /api/accounting/balances/[customerId] — Single Customer Balance
 * =============================================================================
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/balances/[customerId]
 * @enterprise DECISIONS-PHASE-1b.md Q1-Q4
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest, notFound } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';

// ── GET: Single customer balance ─────────────────────────────────────────────

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to get customer balance',
  handler: async ({ auth, params }) => {
    const { customerId } = params;

    if (!customerId) badRequest('Missing customerId');

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const balance = await repository.getCustomerBalance(customerId);

    if (!balance) notFound('Customer balance not found');

    return ok(balance);
  },
});
