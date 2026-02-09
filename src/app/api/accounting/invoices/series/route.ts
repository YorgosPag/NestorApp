/**
 * =============================================================================
 * GET /api/accounting/invoices/series — List Invoice Series
 * =============================================================================
 *
 * Returns all configured invoice series (e.g. 'A', 'B', 'CREDIT').
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/invoices/series
 * @enterprise ADR-ACC-002 Invoicing System
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services';

// =============================================================================
// GET — List Invoice Series
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const series = await repository.getInvoiceSeries();

        return NextResponse.json({ success: true, data: series });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list invoice series';
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
