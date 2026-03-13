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
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { checkDeletionDependencies } from '@/lib/firestore/deletion-guard';
import { isValidEntityType, type EntityType, type DependencyCheckResult } from '@/config/deletion-registry';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('DeletionGuardRoute');

// ============================================================================
// PERMISSION MAP — entityType → required delete permission
// ============================================================================

const ENTITY_PERMISSION_MAP: Record<EntityType, PermissionId> = {
  contact: 'crm:contacts:delete',
  unit: 'units:units:delete',
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
      const db = getAdminFirestore();
      if (!db) {
        throw new ApiError(503, 'Firestore not available', 'DB_UNAVAILABLE');
      }

      // ── Extract route params from URL ──
      const url = new URL(request.url);
      const segments = url.pathname.split('/').filter(Boolean);
      // URL: /api/deletion-guard/{entityType}/{entityId}
      const entityTypeParam = segments[segments.length - 2];
      const entityId = segments[segments.length - 1];

      if (!entityTypeParam || !entityId) {
        throw new ApiError(400, 'Missing entityType or entityId', 'INVALID_PARAMS');
      }

      if (!isValidEntityType(entityTypeParam)) {
        throw new ApiError(
          400,
          `Μη έγκυρος τύπος entity: ${entityTypeParam}. Αποδεκτοί: contact, unit, floor, project, building, company, parking, storage`,
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
