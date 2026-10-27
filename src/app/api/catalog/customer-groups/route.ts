/**
 * POST /api/catalog/customer-groups — νέα ομάδα πελάτη («χονδρέμπορος») (ADR-923 §5.11 «3β»).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createPricingGroup } from '@/server/catalog/pricing-group-writer.server';
import { createCustomerGroupBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'pricing' }, createCustomerGroupBodySchema, (auth, body) =>
  createPricingGroup(auth, 'customerGroup', body.definition),
);
