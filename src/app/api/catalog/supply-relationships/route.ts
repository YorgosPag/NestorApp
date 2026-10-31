/**
 * GET /api/catalog/supply-relationships — η όψη `supply` του προμηθευτή: σχέσεις · προσκλήσεις · ο σύνδεσμος (ADR-923 §5.12).
 * Auth: `catalog:pricing:view` · Rate: high (ξαναζητείται με σήμα όψης, ADR-905).
 */

import 'server-only';

import { readSupplierSupplyView } from '@/server/supply-relationships/supply-views.server';
import { catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'HIGH', authority: 'pricingView' }, (auth) => readSupplierSupplyView(auth));
