/**
 * =============================================================================
 * GET /api/accounting/balances/[customerId] — Single Customer Balance
 * =============================================================================
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/balances/[customerId]
 * @enterprise DECISIONS-PHASE-1b.md Q1-Q4
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { getErrorMessage } from '@/lib/error-utils';

// ── GET: Single customer balance ─────────────────────────────────────────────

async function handleGet(
  request: NextRequest,
  segmentData: { params: Promise<{ customerId: string }> }
): Promise<NextResponse> {
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { customerId } = await segmentData.params;

        if (!customerId) {
          return NextResponse.json({ success: false, error: 'Missing customerId' }, { status: 400 });
        }

        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const balance = await repository.getCustomerBalance(customerId);

        if (!balance) {
          return NextResponse.json({ success: false, error: 'Customer balance not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: balance });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get customer balance');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// ── Route exports ─��───────────────────────��──────────────────────────────────

export const GET = withStandardRateLimit(handleGet);
