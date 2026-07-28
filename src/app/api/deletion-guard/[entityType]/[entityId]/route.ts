/**
 * 🛡️ Deletion Guard Preview API
 *
 * GET /api/deletion-guard/{entityType}/{entityId}
 *
 * Returns dependency check for an entity — used by the frontend
 * to show a "blocked" dialog or confirm deletion.
 *
 * Permission: same delete permission as the entity's own DELETE endpoint.
 *
 * @module api/deletion-guard/[entityType]/[entityId]
 * @enterprise ADR-226 — Deletion Guard (Phase 1)
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache, PermissionId } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { extractSegmentFromEnd } from '@/lib/api/route-helpers';
import { checkDeletionDependencies } from '@/lib/firestore/deletion-guard';
import {
  isDeletableEntityType,
  DELETION_REGISTRY,
  type EntityType,
  type DependencyCheckResult,
} from '@/config/deletion-registry';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('DeletionGuardRoute');

// ============================================================================
// PERMISSION MAP — entityType → required delete permission
// ============================================================================

const ENTITY_PERMISSION_MAP: Record<EntityType, PermissionId> = {
  contact: 'crm:contacts:delete',
  property: 'properties:properties:delete',
  floor: 'projects:floors:delete',
  project: 'projects:projects:delete',
  building: 'buildings:buildings:delete',
  company: 'projects:projects:delete',
  parking: 'units:units:delete',
  storage: 'units:units:delete',
};

// ============================================================================
// GET — Preview dependency check
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<DependencyCheckResult>>(
    async (
      request: NextRequest,
      ctx: AuthContext,
      cache: PermissionCache
    ) => {
      const db = requireAdminFirestore();

      // ── Extract route params from URL: /api/deletion-guard/{entityType}/{entityId} ──
      const entityTypeParam = extractSegmentFromEnd(request.url, 1);
      const entityId = extractSegmentFromEnd(request.url, 0);

      if (!entityTypeParam || !entityId) {
        throw new ApiError(400, 'Missing entityType or entityId', 'INVALID_PARAMS');
      }

      if (!isDeletableEntityType(entityTypeParam)) {
        // The accepted list is read from the registry, not hand-written: the
        // literal here said "unit" while the registry has said "property" for
        // as long as it has existed, so the error told the caller to send a
        // value the route would reject.
        throw new ApiError(
          400,
          `Μη έγκυρος τύπος entity: ${entityTypeParam}. Αποδεκτοί: ${Object.keys(DELETION_REGISTRY).join(', ')}`,
          'INVALID_ENTITY_TYPE'
        );
      }

      const entityType: EntityType = entityTypeParam;

      // ── Permission check — require the matching delete permission ──
      const requiredPermission = ENTITY_PERMISSION_MAP[entityType];
      const permitted = await hasPermission(ctx, requiredPermission, {}, cache);

      if (!permitted) {
        throw new ApiError(403, 'Permission denied', 'FORBIDDEN');
      }

      // ── Run dependency check ──
      const { companyId } = ctx;

      logger.info(`[DeletionGuard] Checking ${entityType}/${entityId}`, {
        entityType,
        entityId,
        userId: ctx.uid,
        companyId,
      });

      const result = await checkDeletionDependencies(db, entityType, entityId, companyId);

      return apiSuccess(result, result.message);
    }
  )
);
