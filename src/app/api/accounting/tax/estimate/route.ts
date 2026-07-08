/**
 * =============================================================================
 * GET /api/accounting/tax/estimate — Tax Estimate (Real-time Projection)
 * =============================================================================
 *
 * Returns a real-time tax estimate for the given fiscal year based on
 * current income, expenses, EFKA contributions, and applicable tax scales.
 *
 * Query params:
 *   - fiscalYear (optional): Defaults to current year
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/tax/estimate
 * @enterprise ADR-ACC-009 Tax Engine
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { createEntityScopedYearRoute } from '../../_shared/entity-scoped-summary-route';

// ── GET: Tax Estimate (entity-scoped, ΟΕ/ΕΠΕ/ΑΕ/ατομική) ─────────────────────

export const GET = createEntityScopedYearRoute({
  fallbackError: 'Failed to get tax estimate',
  param: 'fiscalYear',
  label: 'fiscalYear',
  buildResolvers: (service, year) => ({
    partnership: () => service.calculatePartnershipTax(year),
    llc: () => service.calculateEPETax(year),
    corporation: () => service.calculateAETax(year),
    soleProprietor: () => service.getTaxEstimate(year),
  }),
});
