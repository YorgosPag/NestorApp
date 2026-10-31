/**
 * GET /api/catalog/cost-rates?projectId=… — το βιβλίο τιμών κόστους του προϋπολογισμού: master του χώρου + λίστες του έργου,
 * ό,τι ισχύει τώρα και ό,τι έρχεται (ADR-923 §5.11 «3ε»). Auth: `catalog:pricing:view` · Rate: standard.
 */

import 'server-only';

import { badRequest } from '@/lib/api/define-route';
import { readCostRateBook } from '@/server/catalog/cost-rates.server';
import { COST_RATES_PROJECT_PARAM } from '@/subapps/catalog/catalog-routes';
import { entityIdSchema } from '@/subapps/catalog/schema/zod/common.schema';
import { catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'STANDARD', authority: 'pricingView' }, (auth, _params, search) => {
  const parsed = entityIdSchema.safeParse(search.get(COST_RATES_PROJECT_PARAM));
  if (!parsed.success) badRequest(`${COST_RATES_PROJECT_PARAM} is invalid`);
  return readCostRateBook(auth, parsed.data);
});
