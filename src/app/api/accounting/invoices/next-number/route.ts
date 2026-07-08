/**
 * =============================================================================
 * GET /api/accounting/invoices/next-number — Preview Next Invoice Number
 * =============================================================================
 *
 * Returns the next available invoice number for a given series.
 * This is a READ-ONLY preview — the actual increment happens atomically
 * inside createInvoice().
 *
 * Query params:
 *   - seriesCode (required): Invoice series code (e.g. 'A', 'B')
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/invoices/next-number
 * @enterprise ADR-ACC-002 Invoicing System
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';

// =============================================================================
// GET — Next Invoice Number (Preview)
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to get next invoice number',
  handler: async ({ req, auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const { searchParams } = new URL(req.url);

    const seriesCode = searchParams.get('seriesCode');
    if (!seriesCode) {
      badRequest('seriesCode query parameter is required');
    }

    const nextNumber = await repository.getNextInvoiceNumber(seriesCode);

    return ok({ seriesCode, nextNumber });
  },
});
