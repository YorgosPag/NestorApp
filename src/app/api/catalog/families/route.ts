/**
 * POST /api/catalog/families — νέα οικογένεια προϊόντων, επικυρωμένη ολόκληρη απέναντι στη βιβλιοθήκη
 * (ADR-923 §5.2). Auth: `catalog:schema:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCatalogFamily } from '@/server/catalog/family-writer.server';
import { createFamilyBodySchema } from '@/subapps/catalog/schema/zod/family.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD' }, createFamilyBodySchema, (auth, body) => createCatalogFamily(auth, body.definition));
