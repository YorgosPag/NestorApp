/**
 * POST /api/catalog/suppliers/boq-drift — ο έλεγχος τιμών προμηθευτή για γραμμές BOQ (ADR-923 §5.12 Δ9).
 * 🔑 Ο πελάτης στέλνει ποιες γραμμές· προμηθευτή, SKU και ποσότητα τα ξέρει το στιγμιότυπο. Μόνο διαβάζει.
 * Auth: `catalog:pricing:view` · Rate: standard.
 */

import 'server-only';

import { reviewSupplierPrices } from '@/server/supply-relationships/boq-supplier-drift.server';
import { boqSupplierDriftBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogActionRoute } from '../../_shared/catalog-route';

export const POST = catalogActionRoute({ category: 'STANDARD', authority: 'pricingView' }, boqSupplierDriftBodySchema, (auth, body) =>
  reviewSupplierPrices(auth, body.boqItemIds),
);
