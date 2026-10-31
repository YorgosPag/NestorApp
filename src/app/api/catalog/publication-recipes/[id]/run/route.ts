/**
 * POST /api/catalog/publication-recipes/[id]/run — ζητά έκδοση από την αποθηκευμένη συνταγή (ADR-923 §5.6).
 * Ιδεμπότητη από κατασκευή: ίδιες είσοδοι ⇒ η ίδια έκδοση. Η απόδοση γίνεται **μετά** την απάντηση (`after`).
 * Auth: `catalog:pricing:manage` · Rate: sensitive (CPU διακομιστή).
 */

import 'server-only';

import { after } from 'next/server';

import { executePublicationRun, requestPublicationRun } from '@/server/catalog/publishing/publication-run.server';
import { runPublicationBodySchema } from '@/subapps/catalog/schema/zod/publication.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'pricing' }, runPublicationBodySchema, async (auth, id) => {
  const requested = await requestPublicationRun(auth, id);
  if (requested.mustExecute) after(() => executePublicationRun(requested));
  return requested.run;
});
