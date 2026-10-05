/**
 * POST /api/trash/{entityType}/{entityId}/restore
 *
 * Centralized restore endpoint for ALL soft-deletable entities.
 *
 * @module api/trash/[entityType]/[entityId]/restore
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { createLifecycleMutationRoute } from '@/lib/api/lifecycle-mutation-route';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { restoreFromTrash } from '@/lib/firestore/soft-delete-engine';

export const POST = withStandardRateLimit(createLifecycleMutationRoute({
  run: async ({ db, entityType, entityId, ctx }) => {
    const { restoredStatus } = await restoreFromTrash(
      db, entityType, entityId, ctx.uid, ctx.companyId, ctx.email ?? undefined,
    );
    return { restoredStatus };
  },
  securityAction: 'restored',
  outcome: (labelEn) => `${labelEn} restored from trash`,
}));
