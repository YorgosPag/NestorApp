/**
 * GET /api/catalog/imports — οι πρόσφατες παρτίδες εισαγωγής του χώρου (ADR-923 §5.5.1).
 * Auth: `catalog:products:manage` · Rate: high (ανάγνωση).
 *
 * POST /api/catalog/imports — νέα παρτίδα. Ιδεμπότητη δομικά: ίδιο αρχείο + στόχος + έκδοση προφίλ + εκτέλεση ⇒ η ίδια παρτίδα.
 * Auth: `catalog:products:manage` (τιμές: και `catalog:pricing:manage`) · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createImportBatch } from '@/server/catalog/import-batch-writer.server';
import { listImportBatches } from '@/server/catalog/import-reads.server';
import { createImportBatchBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogCreateRoute, catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'HIGH', authority: 'products' }, (auth) => listImportBatches(auth));

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'products' }, createImportBatchBodySchema, (auth, body) =>
  createImportBatch(auth, body),
);
