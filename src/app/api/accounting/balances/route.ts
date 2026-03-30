/**
 * =============================================================================
 * GET + POST /api/accounting/balances — Customer Balances & Reconciliation
 * =============================================================================
 *
 * GET:  List all customer balances for a fiscal year (with aging)
 * POST: Trigger batch reconciliation (recalculate all from source)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/balances
 * @enterprise DECISIONS-PHASE-1b.md Q1-Q4
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { reconcileAllBalances } from '@/subapps/accounting/services/balance-service';
import { getErrorMessage } from '@/lib/error-utils';

// ── GET: List customer balances ────��─────────────────────────────────────────

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const fiscalYearParam = url.searchParams.get('fiscalYear');
        const fiscalYear = fiscalYearParam ? parseInt(fiscalYearParam, 10) : new Date().getFullYear();

        if (isNaN(fiscalYear)) {
          return NextResponse.json({ success: false, error: 'Invalid fiscalYear' }, { status: 400 });
        }

        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const balances = await repository.listCustomerBalances(fiscalYear);

        return NextResponse.json({
          success: true,
          data: { items: balances, total: balances.length, fiscalYear },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list customer balances');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// ── POST: Trigger batch reconciliation ─────────��─────────────────────────────

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = await req.json() as { fiscalYear?: number };
        const fiscalYear = body.fiscalYear ?? new Date().getFullYear();

        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const result = await reconcileAllBalances(repository, fiscalYear);

        return NextResponse.json({
          success: true,
          data: { ...result, fiscalYear },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to reconcile balances');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// ── Route exports ────────────────────────────────────────────────────────────

export const GET = withStandardRateLimit(handleGet);
export const POST = withStandardRateLimit(handlePost);
