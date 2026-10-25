/**
 * PUT    /api/catalog/attributes/[id] — αντικατάσταση ορισμού (CAS στο `expectedRevision`).
 * DELETE /api/catalog/attributes/[id]?expectedRevision=N — soft delete, μόνο αν καμία οικογένεια δεν τη χρησιμοποιεί.
 * Auth: `catalog:schema:manage` · ADR-923 §5.2.
 */

import 'server-only';

import { deleteCatalogAttribute, updateCatalogAttribute } from '@/server/catalog/attribute-writer.server';
import { updateAttributeBodySchema } from '@/subapps/catalog/schema/zod/attribute.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD' }, updateAttributeBodySchema, (auth, id, body) =>
  updateCatalogAttribute(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD' }, deleteCatalogAttribute);
