/**
 * PUT    /api/catalog/product-models/[id] — αντικατάσταση τιμών μοντέλου (CAS· ξαναϋπολογίζει όλους τους απογόνους).
 * DELETE /api/catalog/product-models/[id]?expectedRevision=N — soft delete **σε καταρράκτη** (Akeneo).
 * Auth: `catalog:products:manage` · ADR-923 §5.10.
 */

import 'server-only';

import { deleteCatalogProductModel, updateCatalogProductModel } from '@/server/catalog/product-model-writer.server';
import { updateProductModelBodySchema } from '@/subapps/catalog/schema/zod/product.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, updateProductModelBodySchema, (auth, id, body) =>
  updateCatalogProductModel(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'products' }, deleteCatalogProductModel);
