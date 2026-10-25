/**
 * PUT    /api/catalog/categories/[id] — ετικέτα/αντιστοιχίσεις (CAS στο `expectedRevision`).
 * DELETE /api/catalog/categories/[id]?expectedRevision=N — μόνο φύλλο (χωρίς παιδιά).
 * Η μετακίνηση/αναδιάταξη ζει στο `…/[id]/move`. Auth: `catalog:schema:manage` · ADR-923 §5.2.
 */

import 'server-only';

import { deleteCatalogCategory, updateCatalogCategory } from '@/server/catalog/category-writer.server';
import { updateCategoryBodySchema } from '@/subapps/catalog/schema/zod/library.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD' }, updateCategoryBodySchema, (auth, id, body) =>
  updateCatalogCategory(auth, id, body.expectedRevision, { labels: body.labels, mappings: body.mappings }),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD' }, deleteCatalogCategory);
