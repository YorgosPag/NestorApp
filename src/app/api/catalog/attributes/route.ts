/**
 * POST /api/catalog/attributes — νέα ιδιότητα στη βιβλιοθήκη (ADR-923 §5.2).
 * Auth: `catalog:schema:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCatalogAttribute } from '@/server/catalog/attribute-writer.server';
import { createAttributeBodySchema } from '@/subapps/catalog/schema/zod/attribute.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD' }, createAttributeBodySchema, (auth, body) =>
  createCatalogAttribute(auth, body.definition),
);
