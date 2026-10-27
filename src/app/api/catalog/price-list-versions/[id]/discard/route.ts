/**
 * POST /api/catalog/price-list-versions/[id]/discard — η πρόχειρη εγκαταλείπεται (μένει στο ιστορικό ως `discarded`).
 * Auth: `catalog:pricing:manage` · Rate: standard.
 */

import 'server-only';

import { discardPriceListVersion } from '@/server/catalog/price-version-writer.server';
import { deleteCatalogEntityBodySchema } from '@/subapps/catalog/schema/zod/attribute.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, deleteCatalogEntityBodySchema, (auth, id, body) =>
  discardPriceListVersion(auth, id, body.expectedRevision),
);
