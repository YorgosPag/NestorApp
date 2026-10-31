/**
 * POST /api/catalog/imports/[id]/file — σύνδεση του ανεβασμένου αρχείου με την παρτίδα: το sha256 μετριέται από τα bytes (ADR-923 §5.5.1).
 * Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { attachImportBatchFile } from '@/server/catalog/import-batch-writer.server';
import { attachImportFileBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, attachImportFileBodySchema, (auth, id, body) =>
  attachImportBatchFile(auth, id, body.expectedRevision, body.fileId),
);
