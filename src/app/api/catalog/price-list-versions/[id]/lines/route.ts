/**
 * GET /api/catalog/price-list-versions/[id]/lines?cursor=<id> — μία σελίδα γραμμών + η έκδοση (όψη `list:{id}`,
 * ADR-923 §5.11 «3δ» Ζ). Auth: `catalog:pricing:view` · Rate: high.
 *
 * PUT /api/catalog/price-list-versions/[id]/lines — η δέσμη γραμμών (επικόλληση): μία συναλλαγή, CAS στο `linesRevision`,
 * μόνο σε πρόχειρη έκδοση (`versionNotDraft`).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { savePriceLines } from '@/server/catalog/price-line-writer.server';
import { readPriceLinesPage } from '@/server/catalog/pricing-views.server';
import { priceLineBatchBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import type { PriceLinesPageView } from '@/subapps/catalog/types/pricing-views';
import { catalogEntityRoute, catalogReadRoute, cursorParamOf } from '../../../_shared/catalog-route';

export const GET = catalogReadRoute<PriceLinesPageView, { id: string }>(
  { category: 'HIGH', authority: 'pricingView' },
  (auth, params, search) => readPriceLinesPage(auth, params.id, cursorParamOf(search)),
);

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, priceLineBatchBodySchema, (auth, id, body) =>
  savePriceLines(auth, id, body),
);
