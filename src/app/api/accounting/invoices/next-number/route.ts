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
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/invoices/next-number
 * @enterprise ADR-ACC-002 Invoicing System
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services';

// =============================================================================
// GET — Next Invoice Number (Preview)
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const { searchParams } = new URL(req.url);

        const seriesCode = searchParams.get('seriesCode');
        if (!seriesCode) {
          return NextResponse.json(
            { success: false, error: 'seriesCode query parameter is required' },
            { status: 400 }
          );
        }

        const nextNumber = await repository.getNextInvoiceNumber(seriesCode);

        return NextResponse.json({
          success: true,
          data: { seriesCode, nextNumber },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get next invoice number';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
