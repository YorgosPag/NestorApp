/**
 * POST /api/trash/{entityType}/{entityId}/archive
 *
 * Αρχειοθέτηση: η έξοδος όταν η διαγραφή μπλοκάρεται από αναφορές (ADR-329 §3.9).
 * Η εγγραφή φεύγει από την καθημερινή λίστα και μένει για πάντα· ό,τι την αναφέρει τη βρίσκει.
 *
 * Διαθέσιμη μόνο για οντότητες με `SOFT_DELETE_CONFIG[…].archive`.
 *
 * @module api/trash/[entityType]/[entityId]/archive
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9
 */

import { createLifecycleMutationRoute } from '@/lib/api/lifecycle-mutation-route';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { archive } from '@/lib/firestore/soft-delete-engine';

export const POST = withStandardRateLimit(createLifecycleMutationRoute({
  permissionOf: (config) => config.archive?.permission,
  run: async ({ db, entityType, entityId, ctx }) => {
    await archive(db, entityType, entityId, ctx.uid, ctx.companyId, ctx.email ?? undefined);
    return { archived: true };
  },
  securityAction: 'data_updated',
  outcome: (labelEn) => `${labelEn} archived`,
}));
