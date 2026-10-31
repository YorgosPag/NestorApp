/**
 * POST /api/catalog/supply-invitations/[id]/revoke — ανάκληση πρόσκλησης σε εκκρεμότητα (ADR-923 §5.12 Σ2).
 * Auth: `catalog:pricing:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { revokeSupplyInvitation } from '@/server/supply-relationships/supply-invitation-issue.server';
import { emptySupplyBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'pricing' }, emptySupplyBodySchema, async (auth, id) => {
  await revokeSupplyInvitation(auth, id);
  return { revoked: true };
});
