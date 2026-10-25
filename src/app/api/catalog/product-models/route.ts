/**
 * POST /api/catalog/product-models — νέο μοντέλο (ρίζα) ή υπο-μοντέλο, κριμένο μέσα στο σύνολο του (ADR-923 §5.10 Δ2).
 * Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCatalogProductModel } from '@/server/catalog/product-model-writer.server';
import { createProductModelBodySchema } from '@/subapps/catalog/schema/zod/product.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'products' }, createProductModelBodySchema, (auth, body) =>
  createCatalogProductModel(auth, body.definition),
);
