/**
 * GET /api/catalog/suppliers — η όψη `supply` του αγοραστή: οι προμηθευτές του χώρου (ADR-923 §5.12).
 * Auth: `catalog:pricing:view` · Rate: high (ξαναζητείται με σήμα όψης, ADR-905).
 */

import 'server-only';

import { readBuyerSupplyView } from '@/server/supply-relationships/supply-views.server';
import { catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'HIGH', authority: 'pricingView' }, (auth) => readBuyerSupplyView(auth));
