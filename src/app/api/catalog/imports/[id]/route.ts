/**
 * GET /api/catalog/imports/[id] — η παρτίδα και οι προτάσεις της (ADR-923 §5.5.1).
 * Auth: `catalog:products:manage` (τιμές: και `catalog:pricing:manage`) · Rate: high.
 */

import 'server-only';

import { readImportBatchDetail } from '@/server/catalog/import-reads.server';
import { catalogReadRoute } from '../../_shared/catalog-route';

export const GET = catalogReadRoute<Awaited<ReturnType<typeof readImportBatchDetail>>, { id: string }>({ category: 'HIGH', authority: 'products' }, (auth, params) =>
  readImportBatchDetail(auth, params.id),
);
