/**
 * POST /api/catalog/imports/[id]/pages — ανάγνωση **μίας** σελίδας PDF από το μοντέλο (ADR-923 §5.5 · ~$0,024/σελίδα, §21.3).
 * Ιδεμπότητη: διαβασμένη σελίδα δεν ξαναπληρώνεται.
 * Auth: `catalog:products:manage` · Rate: sensitive (πληρωμένη κλήση AI) · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { readImportPage } from '@/server/catalog/import-readers.server';
import { readImportPageBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

/** Μία σελίδα με μία επανάληψη: ~2 × 120s στο χειρότερο (OPENAI_TIMEOUT_MS). */
export const maxDuration = 300;

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'products' }, readImportPageBodySchema, (auth, id, body) =>
  readImportPage(auth, id, body.page),
);
