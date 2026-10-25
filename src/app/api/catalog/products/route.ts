/**
 * POST /api/catalog/products — νέο SKU (ή απλό προϊόν, `modelId: null`), κριμένο μέσα στο σύνολο του μοντέλου του
 * (ADR-923 §5.10 Δ2–Δ3). Προαιρετικό προ-γεννημένο `id` (αισιόδοξη οθόνη) — ελέγχεται, δεν εμπιστεύεται.
 * Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCatalogProduct } from '@/server/catalog/product-writer.server';
import { createProductRequestSchema } from '@/subapps/catalog/schema/zod/product-requests.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'products' }, createProductRequestSchema, (auth, body) =>
  createCatalogProduct(auth, body.definition, body.id ?? null),
);
