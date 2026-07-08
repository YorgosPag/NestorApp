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
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import { defineRoute, ok, httpError } from '@/lib/api/define-route';
import {
  computeSpendAnalytics,
  type SpendAnalyticsFilters,
} from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import { canViewSpendAnalytics } from '@/lib/auth/permissions/spend-analytics';
import { getCurrentQuarterRange } from '@/lib/date/quarter-helpers';
import { parseFilterArray } from '@/lib/url-filters/multi-value';

// ============================================================================
// GET
// ============================================================================

export const GET = defineRoute({
  rateLimit: 'heavy',
  fallbackError: 'Unknown error',
  handler: async ({ req, auth }) => {
    if (!canViewSpendAnalytics(auth.globalRole)) httpError(403, 'Forbidden');

    const p = req.nextUrl.searchParams;
    const defaultRange = getCurrentQuarterRange(new Date());

    const filters: SpendAnalyticsFilters = {
      from: p.get('from') ?? defaultRange.from,
      to: p.get('to') ?? defaultRange.to,
      projectId: parseFilterArray(p.get('projectId')),
      supplierId: parseFilterArray(p.get('supplierId')),
      categoryCode: parseFilterArray(p.get('categoryCode')),
      status: parseFilterArray(p.get('status')),
    };

    return ok(await computeSpendAnalytics(auth.companyId, filters));
  },
});
