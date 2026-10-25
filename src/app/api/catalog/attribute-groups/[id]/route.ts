/**
 * PUT    /api/catalog/attribute-groups/[id] — ετικέτα/σειρά (CAS στο `expectedRevision`).
 * DELETE /api/catalog/attribute-groups/[id]?expectedRevision=N — μόνο άδεια ομάδα.
 * Auth: `catalog:schema:manage` · ADR-923 §5.2.
 */

import 'server-only';

import { deleteCatalogAttributeGroup, updateCatalogAttributeGroup } from '@/server/catalog/attribute-group-writer.server';
import { updateAttributeGroupBodySchema } from '@/subapps/catalog/schema/zod/library.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD' }, updateAttributeGroupBodySchema, (auth, id, body) =>
  updateCatalogAttributeGroup(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD' }, deleteCatalogAttributeGroup);
