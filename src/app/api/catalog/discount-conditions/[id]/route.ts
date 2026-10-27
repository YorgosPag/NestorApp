/**
 * PUT    /api/catalog/discount-conditions/[id] — αντικατάσταση (CAS).
 * DELETE /api/catalog/discount-conditions/[id]?expectedRevision=N — soft delete (ασάφεια = 422, και υπό ταυτοχρονισμό (υποδοχή)).
 * Auth: `catalog:pricing:manage` · ADR-923 §5.11 «3β».
 */

import 'server-only';

import { deleteDiscountCondition, updateDiscountCondition } from '@/server/catalog/discount-condition-writer.server';
import { updateDiscountConditionBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, updateDiscountConditionBodySchema, (auth, id, body) =>
  updateDiscountCondition(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'pricing' }, deleteDiscountCondition);
