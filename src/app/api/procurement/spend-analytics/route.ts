import 'server-only';

/**
 * GET /api/procurement/spend-analytics
 *
 * Server-side aggregated spend analytics (cross-project, company-wide).
 * Auth: super_admin | company_admin only (D10=D).
 * Rate: HeavyRateLimit — 15 req/min (D15=B).
 * Default date range: current quarter (D11=C).
 *
 * Query params:
 *   from, to         — YYYY-MM-DD Athens local (defaults: current quarter)
 *   projectId        — comma-separated project IDs (empty = all)
 *   supplierId       — comma-separated supplier IDs (empty = all)
 *   categoryCode     — comma-separated ΑΤΟΕ codes (empty = all)
 *   status           — comma-separated PO statuses (empty = all)
 *
 * @see ADR-331 §4 D3, D10, D11, D15, D25
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import {
  computeSpendAnalytics,
  type SpendAnalyticsFilters,
} from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import { canViewSpendAnalytics } from '@/lib/auth/permissions/spend-analytics';
import { getCurrentQuarterRange } from '@/lib/date/quarter-helpers';

// ============================================================================
// HELPERS
// ============================================================================

function parseArray(param: string | null): string[] {
  if (!param) return [];
  return param.split(',').map(s => s.trim()).filter(Boolean);
}

// ============================================================================
// GET
// ============================================================================

async function handleGet(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  if (!canViewSpendAnalytics(ctx.globalRole)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const p = request.nextUrl.searchParams;
  const defaultRange = getCurrentQuarterRange(new Date());

  const filters: SpendAnalyticsFilters = {
    from: p.get('from') ?? defaultRange.from,
    to: p.get('to') ?? defaultRange.to,
    projectId: parseArray(p.get('projectId')),
    supplierId: parseArray(p.get('supplierId')),
    categoryCode: parseArray(p.get('categoryCode')),
    status: parseArray(p.get('status')),
  };

  try {
    const data = await computeSpendAnalytics(ctx.companyId, filters);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export const GET = withHeavyRateLimit(withAuth(handleGet));
