/**
 * GET /api/catalog/import-label-memory?supplier=… — η μνήμη ετικετών γραμμής ενός προμηθευτή (ADR-923 §5.5.2 Β5.2), η πιο
 * στηριγμένη πρώτα, με ρητή ένδειξη όταν κόπηκε. Auth: `catalog:products:manage` · Rate: high (ανάγνωση).
 */

import 'server-only';

import { badRequest } from '@/lib/api/define-route';
import { listLabelMemory } from '@/server/catalog/import-label-memory.server';
import { LABEL_MEMORY_SUPPLIER_PARAM } from '@/subapps/catalog/catalog-routes';
import { entityIdSchema } from '@/subapps/catalog/schema/zod/common.schema';
import { catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'HIGH', authority: 'products' }, (auth, _params, search) => {
  const parsed = entityIdSchema.safeParse(search.get(LABEL_MEMORY_SUPPLIER_PARAM));
  if (!parsed.success) badRequest(`${LABEL_MEMORY_SUPPLIER_PARAM} is invalid`);
  return listLabelMemory(auth, parsed.data);
});
