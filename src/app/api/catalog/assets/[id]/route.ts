/**
 * PUT    /api/catalog/assets/[id] — αλλαγή μέσου (CAS· το είδος κλειδώνει όσο το χρησιμοποιεί προϊόν).
 * DELETE /api/catalog/assets/[id]?expectedRevision=N — soft delete, μόνο αν κανείς δεν το χρησιμοποιεί.
 * Auth: `catalog:products:manage` · ADR-923 §5.10 Δ9.
 */

import 'server-only';

import { deleteCatalogAsset, updateCatalogAsset } from '@/server/catalog/asset-writer.server';
import { updateAssetBodySchema } from '@/subapps/catalog/schema/zod/asset.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, updateAssetBodySchema, (auth, id, body) =>
  updateCatalogAsset(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'products' }, deleteCatalogAsset);
