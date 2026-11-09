/**
 * POST /api/catalog/import-label-memory/clear — άδειασμα όλης της μνήμης ενός προμηθευτή (ADR-923 §5.5.2 Β5.2, Akeneo «clear all
 * mapping memory»), σε δέσμες συναλλαγών. Ιδεμπότητο: δεύτερη φορά ⇒ `deleted: 0`.
 * Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { clearLabelMemory } from '@/server/catalog/import-label-memory.server';
import { clearLabelMemoryBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogActionRoute } from '../../_shared/catalog-route';

export const POST = catalogActionRoute({ category: 'STANDARD', authority: 'products' }, clearLabelMemoryBodySchema, (auth, body) =>
  clearLabelMemory(auth, body.supplierContactId),
);
