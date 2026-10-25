/**
 * PUT    /api/catalog/measurement-families/[id] — append-only όσο χρησιμοποιείται (CAS στο `expectedRevision`).
 * DELETE /api/catalog/measurement-families/[id]?expectedRevision=N — μόνο αν καμία ιδιότητα δεν τη χρησιμοποιεί.
 * Auth: `catalog:schema:manage` · ADR-923 §5.2.
 */

import 'server-only';

import {
  deleteCatalogMeasurementFamily,
  updateCatalogMeasurementFamily,
} from '@/server/catalog/measurement-family-writer.server';
import { updateMeasurementFamilyBodySchema } from '@/subapps/catalog/schema/zod/library.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD' }, updateMeasurementFamilyBodySchema, (auth, id, body) =>
  updateCatalogMeasurementFamily(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD' }, deleteCatalogMeasurementFamily);
