/**
 * PUT    /api/catalog/price-lists/[id] — αντικατάσταση (CAS· είδος/τύπος τιμής κλειδώνουν όταν υπάρχει έκδοση).
 * DELETE /api/catalog/price-lists/[id]?expectedRevision=N — soft delete· αποδεσμεύει το κοινό.
 * Auth: `catalog:pricing:manage` · ADR-923 §5.11 «3β».
 */

import 'server-only';

import { deleteCatalogPriceList, updateCatalogPriceList } from '@/server/catalog/price-list-writer.server';
import { updatePriceListBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, updatePriceListBodySchema, (auth, id, body) =>
  updateCatalogPriceList(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'pricing' }, deleteCatalogPriceList);
