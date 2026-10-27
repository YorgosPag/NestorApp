/**
 * POST /api/catalog/price-lists — νέος τιμοκατάλογος (κοινό · φράχτης · ADR-923 §5.11 «3β»).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCatalogPriceList } from '@/server/catalog/price-list-writer.server';
import { createPriceListBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'pricing' }, createPriceListBodySchema, (auth, body) =>
  createCatalogPriceList(auth, body.definition),
);
