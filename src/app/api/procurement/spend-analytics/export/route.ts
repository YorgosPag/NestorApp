import 'server-only';

/**
 * GET /api/procurement/spend-analytics/export?format=csv|xlsx
 *
 * Streams cross-project spend analytics as CSV or Excel multi-sheet workbook.
 * Auth: super_admin | company_admin only (D10=D).
 * Rate: HeavyRateLimit — 10 req/min (D15=B, heavy aggregation + xlsx generation).
 * Default format: xlsx. Default range: current quarter (D11=C).
 *
 * Query params:
 *   format           — 'csv' | 'xlsx' (default xlsx)
 *   from, to         — YYYY-MM-DD Athens local
 *   projectId        — comma-separated project IDs (empty = all)
 *   supplierId       — comma-separated supplier IDs (empty = all)
 *   categoryCode     — comma-separated ΑΤΟΕ codes (empty = all)
 *   status           — comma-separated PO statuses (empty = all)
 *
 * @see ADR-331 §2.6, §4 D6, D10, D11, D15, D25 — Phase B2
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
import { formatSpendAnalyticsCsv } from '@/lib/export/analytics-csv';
import { buildSpendAnalyticsWorkbook } from '@/lib/export/analytics-xlsx';
import { parseFilterArray } from '@/lib/url-filters/multi-value';

function buildFilename(from: string, to: string, ext: 'csv' | 'xlsx'): string {
  return `spend-analytics-${from}_${to}.${ext}`;
}

function readFilters(request: NextRequest): SpendAnalyticsFilters {
  const p = request.nextUrl.searchParams;
  const defaultRange = getCurrentQuarterRange(new Date());
  return {
    from: p.get('from') ?? defaultRange.from,
    to: p.get('to') ?? defaultRange.to,
    projectId: parseFilterArray(p.get('projectId')),
    supplierId: parseFilterArray(p.get('supplierId')),
    categoryCode: parseFilterArray(p.get('categoryCode')),
    status: parseFilterArray(p.get('status')),
  };
}

async function handleGet(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  if (!canViewSpendAnalytics(ctx.globalRole)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const format = (request.nextUrl.searchParams.get('format') ?? 'xlsx').toLowerCase();
  if (format !== 'csv' && format !== 'xlsx') {
    return NextResponse.json(
      { success: false, error: 'Invalid format. Use csv or xlsx.' },
      { status: 400 },
    );
  }

  const filters = readFilters(request);

  try {
    const data = await computeSpendAnalytics(ctx.companyId, filters);
    if (format === 'csv') {
      return new NextResponse(formatSpendAnalyticsCsv(data), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${buildFilename(filters.from, filters.to, 'csv')}"`,
        },
      });
    }
    const buf = await buildSpendAnalyticsWorkbook(data);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${buildFilename(filters.from, filters.to, 'xlsx')}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export const GET = withHeavyRateLimit(withAuth(handleGet));
