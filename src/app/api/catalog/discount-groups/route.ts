/**
 * POST /api/catalog/discount-groups — νέα ομάδα έκπτωσης SKU («TOSH-CARR») (ADR-923 §5.11 «3β»).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createPricingGroup } from '@/server/catalog/pricing-group-writer.server';
import { createDiscountGroupBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'pricing' }, createDiscountGroupBodySchema, (auth, body) =>
  createPricingGroup(auth, 'discountGroup', body.definition),
);
