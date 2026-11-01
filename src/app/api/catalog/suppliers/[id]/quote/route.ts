/**
 * POST /api/catalog/suppliers/[id]/quote — η τιμή ενός SKU για τον αγοραστή (ADR-923 §5.12 Δ4 · Σ7). `id` = η σχέση του.
 * 🔒 Απαντά ΜΟΝΟ `ForeignQuote`: χωρίς ίχνος, καταρράκτη ή ποσό καταλόγου, και ίδια απάντηση για κάθε «όχι».
 * Auth: `catalog:pricing:view` · Rate: standard.
 */

import 'server-only';

import { quoteForeignPrice } from '@/server/supply-relationships/supply-foreign-quote.server';
import { foreignQuoteBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricingView' }, foreignQuoteBodySchema, (auth, id, body) =>
  quoteForeignPrice(auth, { relationshipId: id, variantId: body.variantId, quantity: body.quantity }),
);
