/**
 * POST /api/catalog/suppliers/[id]/boq-price — SKU προμηθευτή σε γραμμή BOQ (ADR-923 §5.12 Δ7). `id` = η σχέση του αγοραστή.
 * 🔴 Ο πελάτης στέλνει ποια γραμμή και ποιο SKU, ποτέ ποσό: η τιμή ξαναϋπολογίζεται εδώ.
 * Auth: `catalog:pricing:view` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { applySupplierPrice } from '@/server/supply-relationships/boq-supplier-price.server';
import { boqSupplierPriceBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricingView' }, boqSupplierPriceBodySchema, (auth, id, body) =>
  applySupplierPrice(auth, { relationshipId: id, boqItemId: body.boqItemId, variantId: body.variantId }),
);
