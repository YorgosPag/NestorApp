/**
 * =============================================================================
 * GET /api/accounting/invoices/series — List Invoice Series
 * =============================================================================
 *
 * Returns all configured invoice series (e.g. 'A', 'B', 'CREDIT').
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/invoices/series
 * @enterprise ADR-ACC-002 Invoicing System
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';

// =============================================================================
// GET — List Invoice Series
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list invoice series',
  handler: async ({ auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const series = await repository.getInvoiceSeries();

    return ok(series);
  },
});
