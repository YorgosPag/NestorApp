/**
 * `POST /api/catalog/editions/[id]/withdraw` — «Απόσυρση» δημοσιευμένης έκδοσης (ADR-923 §5.15).
 * Το έντυπο κλείνει για κάθε θεατή· αν ήταν το ισχύον, ο προκάτοχός του ξαναγίνεται ισχύων. Ιδεμπότητο.
 * Auth: `catalog:pricing:publish` · Rate: sensitive.
 * @module app/api/catalog/editions/[id]/withdraw/route
 */

import 'server-only';

import { withdrawCatalogEdition } from '@/server/catalog/editions/catalog-edition-writer.server';
import { withdrawCatalogEditionBodySchema } from '@/subapps/catalog/schema/zod/catalog-edition.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'pricingPublish' }, withdrawCatalogEditionBodySchema, async (auth, id) => ({
  editionId: (await withdrawCatalogEdition(auth, id)).id,
}));
