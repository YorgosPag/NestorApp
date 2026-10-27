/**
 * PUT    /api/catalog/discount-groups/[id] — αντικατάσταση (CAS).
 * DELETE /api/catalog/discount-groups/[id]?expectedRevision=N — soft delete (διαγραφή μόνο όταν καμία γραμμή/συνθήκη δεν τη φέρει).
 * Auth: `catalog:pricing:manage` · ADR-923 §5.11 «3β».
 */

import 'server-only';

import { deletePricingGroup, updatePricingGroup } from '@/server/catalog/pricing-group-writer.server';
import { updateDiscountGroupBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, updateDiscountGroupBodySchema, (auth, id, body) =>
  updatePricingGroup(auth, 'discountGroup', id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'pricing' }, (auth, id, expectedRevision) => deletePricingGroup(auth, 'discountGroup', id, expectedRevision));
