/**
 * POST /api/catalog/price-lists/[id]/versions — νέα πρόχειρη έκδοση (κενή ή «από την τρέχουσα»· η σπορά τρέχει αμέσως).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth` (η επανάληψη δεν γεννά δεύτερη έκδοση).
 */

import 'server-only';

import { createPriceListVersion } from '@/server/catalog/price-version-writer.server';
import { createPriceVersionBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, createPriceVersionBodySchema, (auth, id, body) =>
  createPriceListVersion(auth, id, body),
);
