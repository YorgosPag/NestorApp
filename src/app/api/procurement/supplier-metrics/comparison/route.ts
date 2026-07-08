/**
 * GET /api/procurement/supplier-metrics/comparison
 *
 * Returns all suppliers ranked by performance metrics.
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-267 Phase C (Supplier Comparison)
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import { getSupplierComparison } from '@/services/procurement/supplier-metrics-service';

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Unknown error',
  handler: async ({ auth }) => ok(await getSupplierComparison(auth.companyId)),
});
