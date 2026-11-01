/**
 * POST /api/catalog/suppliers/[id]/search — τα SKU που βλέπει ο αγοραστής σε έναν ξένο κατάλογο (ADR-923 §5.12 τμήμα 4). `id` = η σχέση του.
 * 🔒 Απαντά ΜΟΝΟ `ForeignSkuSearch`: κρυφό ≡ ανύπαρκτο, και τίποτα δεν λέει πόσα έμειναν έξω.
 * Auth: `catalog:pricing:view` · Rate: high (πληκτρολόγηση, με καθυστέρηση στον πελάτη).
 */

import 'server-only';

import { searchForeignCatalog } from '@/server/supply-relationships/supply-foreign-quote.server';
import { foreignSkuSearchBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'HIGH', authority: 'pricingView' }, foreignSkuSearchBodySchema, (auth, id, body) =>
  searchForeignCatalog(auth, { relationshipId: id, term: body.term }),
);
