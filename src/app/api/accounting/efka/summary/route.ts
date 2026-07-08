/**
 * =============================================================================
 * GET /api/accounting/efka/summary — EFKA Annual Summary
 * =============================================================================
 *
 * Returns the annual EFKA (social security) contributions summary
 * including monthly breakdown, payments, and balance.
 *
 * Query params:
 *   - year (optional): Fiscal year, defaults to current year
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/efka/summary
 * @enterprise ADR-ACC-006 EFKA Contributions
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { createEntityScopedYearRoute } from '../../_shared/entity-scoped-summary-route';

// ── GET: EFKA Annual Summary (entity-scoped, ΟΕ/ΕΠΕ/ΑΕ/ατομική) ──────────────

export const GET = createEntityScopedYearRoute({
  fallbackError: 'Failed to get EFKA summary',
  param: 'year',
  label: 'year',
  buildResolvers: (service, year) => ({
    partnership: () => service.getPartnershipEfkaSummary(year),
    llc: () => service.getEPEEfkaSummary(year),
    corporation: () => service.getAEEfkaSummary(year),
    soleProprietor: () => service.getEfkaAnnualSummary(year),
  }),
});
