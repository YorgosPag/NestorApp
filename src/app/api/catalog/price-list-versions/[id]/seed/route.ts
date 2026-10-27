/**
 * POST /api/catalog/price-list-versions/[id]/seed — συνέχιση σποράς από τον δρομέα (ιδεμπότητη· μετά από διακοπή).
 * Auth: `catalog:pricing:manage` · Rate: standard.
 */

import 'server-only';

import { seedPriceListVersion } from '@/server/catalog/price-version-writer.server';
import { emptyBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, emptyBodySchema, (auth, id) =>
  seedPriceListVersion(auth, id),
);
