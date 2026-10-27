/**
 * PUT /api/catalog/price-list-versions/[id] — από πότε ισχύει (μόνο πρόχειρη· CAS).
 * Auth: `catalog:pricing:manage` · ADR-923 §5.11 «3β».
 */

import 'server-only';

import { updatePriceListVersion } from '@/server/catalog/price-version-writer.server';
import { updatePriceVersionBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, updatePriceVersionBodySchema, (auth, id, body) =>
  updatePriceListVersion(auth, id, body),
);
