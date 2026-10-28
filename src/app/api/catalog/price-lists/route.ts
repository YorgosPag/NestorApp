/**
 * GET /api/catalog/price-lists — η όψη `lists`: τιμοκατάλογοι + εκδόσεις (ADR-923 §5.11 «3δ» Ζ).
 * Auth: `catalog:pricing:view` · Rate: high (ανάγνωση· ξαναζητείται με σήμα όψης, ADR-905).
 *
 * POST /api/catalog/price-lists — νέος τιμοκατάλογος (κοινό · φράχτης · ADR-923 §5.11 «3β»).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCatalogPriceList } from '@/server/catalog/price-list-writer.server';
import { readPriceListsView } from '@/server/catalog/pricing-views.server';
import { createPriceListBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogCreateRoute, catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'HIGH', authority: 'pricingView' }, (auth) => readPriceListsView(auth));

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'pricing' }, createPriceListBodySchema, (auth, body) =>
  createCatalogPriceList(auth, body.definition),
);
