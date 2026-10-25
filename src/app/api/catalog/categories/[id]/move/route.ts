/**
 * POST /api/catalog/categories/[id]/move — αλλαγή γονέα και/ή θέσης ανάμεσα στα αδέλφια (ADR-923 §5.2).
 * Ολόκληρο το υποδέντρο ξαναγράφεται στην **ίδια** συναλλαγή· κύκλος/βάθος απορρίπτονται πριν από κάθε εγγραφή.
 * Auth: `catalog:schema:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { moveCatalogCategory } from '@/server/catalog/category-writer.server';
import { moveCategoryBodySchema } from '@/subapps/catalog/schema/zod/library.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD' }, moveCategoryBodySchema, (auth, id, body) =>
  moveCatalogCategory(auth, id, body.expectedRevision, { parentId: body.parentId, orderKey: body.orderKey }),
);
