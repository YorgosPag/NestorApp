/**
 * POST /api/catalog/attribute-groups — νέα ομάδα ιδιοτήτων (ADR-923 §5.2).
 * Auth: `catalog:schema:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCatalogAttributeGroup } from '@/server/catalog/attribute-group-writer.server';
import { createAttributeGroupBodySchema } from '@/subapps/catalog/schema/zod/library.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD' }, createAttributeGroupBodySchema, (auth, body) =>
  createCatalogAttributeGroup(auth, body.definition),
);
