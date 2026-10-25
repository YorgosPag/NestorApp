/**
 * POST /api/catalog/categories — νέος κόμβος στο δέντρο κατηγοριών (ADR-923 §5.2). Ο `ancestorIds` τον
 * υπολογίζει ο γραφέας από τον γονέα — ποτέ ο πελάτης.
 * Auth: `catalog:schema:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createCatalogCategory } from '@/server/catalog/category-writer.server';
import { createCategoryBodySchema } from '@/subapps/catalog/schema/zod/library.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD' }, createCategoryBodySchema, createCatalogCategory);
