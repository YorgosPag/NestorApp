/**
 * POST /api/catalog/visibility-rules — νέος κανόνας ορατότητας (ADR-923 §12 · §5.12 Δ1).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createVisibilityRule } from '@/server/catalog/visibility-rule-writer.server';
import { createVisibilityRuleBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'pricing' }, createVisibilityRuleBodySchema, (auth, body) =>
  createVisibilityRule(auth, body.definition),
);
