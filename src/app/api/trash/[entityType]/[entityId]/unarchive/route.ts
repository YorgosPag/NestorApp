/**
 * POST /api/trash/{entityType}/{entityId}/unarchive
 *
 * Επαναφορά από το αρχείο στην τελευταία ζωντανή κατάσταση (ADR-329 §3.9).
 *
 * @module api/trash/[entityType]/[entityId]/unarchive
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9
 */

import { createLifecycleMutationRoute } from '@/lib/api/lifecycle-mutation-route';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { restoreFromArchive } from '@/lib/firestore/soft-delete-engine';

export const POST = withStandardRateLimit(createLifecycleMutationRoute({
  permissionOf: (config) => config.archive?.permission,
  run: async ({ db, entityType, entityId, ctx }) => {
    const { restoredStatus, outcomes } = await restoreFromArchive(
      db, entityType, entityId, ctx.uid, ctx.companyId, ctx.email ?? undefined,
    );
    // `outcomes`: ό,τι άλλο έκανε η επαναφορά (π.χ. «εκτός αγοράς») — η οθόνη το λέει, δεν το μαντεύει.
    return { restoredStatus, outcomes };
  },
  securityAction: 'restored',
  outcome: (labelEn) => `${labelEn} restored from archive`,
}));
