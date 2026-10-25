/**
 * PUT    /api/catalog/families/[id] — αντικατάσταση ορισμού (CAS στο `expectedRevision`).
 * DELETE /api/catalog/families/[id]?expectedRevision=N — soft delete.
 * Auth: `catalog:schema:manage` · ADR-923 §5.2.
 */

import 'server-only';

import { deleteCatalogFamily, updateCatalogFamily } from '@/server/catalog/family-writer.server';
import { updateFamilyBodySchema } from '@/subapps/catalog/schema/zod/family.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD' }, updateFamilyBodySchema, (auth, id, body) =>
  updateCatalogFamily(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD' }, deleteCatalogFamily);
