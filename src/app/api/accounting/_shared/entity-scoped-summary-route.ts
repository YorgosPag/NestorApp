/**
 * =============================================================================
 * createEntityScopedYearRoute — entity-scoped year-summary route factory (ADR-603)
 * =============================================================================
 *
 * The efka/summary and tax/estimate GET endpoints are structural twins: resolve
 * a year query param, load the company profile, dispatch to one of four
 * per-entity service calls, and emit `{ success, entityType, data }`. Only the
 * param name/label and the four service thunks differ. This factory owns the
 * whole shared shape so each route file declares just its divergences (jscpd
 * sibling clone eliminated, N.18).
 *
 * @module api/accounting/_shared/entity-scoped-summary-route
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { resolveYearInRange } from './fiscal-year-param';
import { resolveEntityScopedData, type EntityScopedResolvers } from './entity-scoped-response';

type AccountingService = ReturnType<typeof createAccountingServices>['service'];

interface EntityScopedYearRouteConfig<TPartnership, TLlc, TCorporation, TSole> {
  /** 500-envelope fallback message (route-specific). */
  fallbackError: string;
  /** Year query param name (e.g. `'year'` | `'fiscalYear'`). */
  param: string;
  /** Human label used in the 400 message (`'<label> must be a valid year …')`. */
  label: string;
  /** Per-entity service thunks, built from the resolved service + year. */
  buildResolvers: (
    service: AccountingService,
    year: number,
  ) => EntityScopedResolvers<TPartnership, TLlc, TCorporation, TSole>;
}

/**
 * Build a `standard`-rate GET route that returns an entity-scoped year summary
 * envelope (`{ success:true, entityType, data }`), byte-identical to the former
 * inline handlers.
 */
export function createEntityScopedYearRoute<TPartnership, TLlc, TCorporation, TSole>(
  config: EntityScopedYearRouteConfig<TPartnership, TLlc, TCorporation, TSole>,
) {
  return defineRoute({
    rateLimit: 'standard',
    fallbackError: config.fallbackError,
    handler: async ({ req, auth }) => {
      const { service, repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
      const year = resolveYearInRange(req, config.param, config.label);
      const profile = await repository.getCompanySetup();
      const { entityType, data } = await resolveEntityScopedData(profile, config.buildResolvers(service, year));
      return NextResponse.json({ success: true, entityType, data });
    },
  });
}
