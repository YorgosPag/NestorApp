/**
 * PUT    /api/catalog/visibility-rules/[id] — αλλαγή απάντησης (CAS).
 * DELETE /api/catalog/visibility-rules/[id]?expectedRevision=N — soft delete.
 * Το αντικείμενο και το κοινό είναι η ταυτότητα του κανόνα: δεν αλλάζουν. Auth: `catalog:pricing:manage` · ADR-923 §5.12 Δ1.
 */

import 'server-only';

import { deleteVisibilityRule, updateVisibilityRule } from '@/server/catalog/visibility-rule-writer.server';
import { updateVisibilityRuleBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogDeleteRoute, catalogEntityRoute } from '../../_shared/catalog-route';

export const PUT = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, updateVisibilityRuleBodySchema, (auth, id, body) =>
  updateVisibilityRule(auth, id, body.expectedRevision, body.definition),
);

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'pricing' }, deleteVisibilityRule);
