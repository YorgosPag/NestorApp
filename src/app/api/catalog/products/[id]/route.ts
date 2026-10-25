/**
 * PUT    /api/catalog/products/[id] — αντικατάσταση τιμών SKU (CAS· κρίση όλου του συνόλου).
 * DELETE /api/catalog/products/[id]?expectedRevision=N — soft delete· απελευθερώνει τις κρατήσεις του.
 * Auth: `catalog:products:manage` · ADR-923 §5.10.
 */

import 'server-only';

import { deleteCatalogProduct, updateCatalogProduct } from '@/server/catalog/product-writer.server';
import { updateProductBodySchema } from '@/subapps/catalog/schema/zod/product.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, updateProductBodySchema, (auth, id, body) =>
  updateCatalogProduct(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'products' }, deleteCatalogProduct);
