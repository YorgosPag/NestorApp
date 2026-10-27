/**
 * PUT /api/catalog/price-list-versions/[id]/lines — η δέσμη γραμμών (επικόλληση): μία συναλλαγή, CAS στο `linesRevision`,
 * μόνο σε πρόχειρη έκδοση (`versionNotDraft`).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { savePriceLines } from '@/server/catalog/price-line-writer.server';
import { priceLineBatchBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, priceLineBatchBodySchema, (auth, id, body) =>
  savePriceLines(auth, id, body),
);
