/**
 * POST /api/catalog/discount-conditions — νέα συνθήκη έκπτωσης (ομάδα × κοινό × ισχύς × κανόνας) (ADR-923 §5.11 «3β»).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createDiscountCondition } from '@/server/catalog/discount-condition-writer.server';
import { createDiscountConditionBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'pricing' }, createDiscountConditionBodySchema, (auth, body) =>
  createDiscountCondition(auth, body.definition),
);
