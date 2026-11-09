/**
 * POST /api/catalog/imports/[id]/memory — ρητή εφαρμογή (`apply`) ή αναίρεση όλων (`undo`) της μνήμης ετικετών σε υπάρχουσα παρτίδα
 * (ADR-923 §5.5.2 Β5.2 · Απόφαση 4): ξαναχτίσιμο πινάκων **χωρίς AI**, ένας πίνακας τη φορά, άρνηση με λόγο όπου δεν γίνεται.
 * Auth: `catalog:products:manage` (τιμή από μνήμη: και `catalog:pricing:manage`) · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { runImportMemoryAction } from '@/server/catalog/import-memory-apply.server';
import { importMemoryActionBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, importMemoryActionBodySchema, (auth, id, body) =>
  runImportMemoryAction(auth, id, body),
);
