/**
 * POST /api/catalog/measurement-families — νέα οικογένεια μέτρησης **του χώρου** (ADR-923 §5.2).
 * Οι οικογένειες της πλατφόρμας ζουν σε κώδικα και δεν γράφονται από εδώ.
 * Auth: `catalog:schema:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCatalogMeasurementFamily } from '@/server/catalog/measurement-family-writer.server';
import { createMeasurementFamilyBodySchema } from '@/subapps/catalog/schema/zod/library.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD' }, createMeasurementFamilyBodySchema, (auth, body) =>
  createCatalogMeasurementFamily(auth, body.definition),
);
