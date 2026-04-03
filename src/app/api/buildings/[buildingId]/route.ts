import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { softDelete } from '@/lib/firestore/soft-delete-engine';

const logger = createModuleLogger('BuildingByIdRoute');

interface BuildingDeleteResponse {
  buildingId: string;
  deleted: boolean;
}

/**
 * 🏢 ENTERPRISE: DELETE /api/buildings/[buildingId]
 *
 * Deletes a building using Admin SDK (bypasses Firestore rules).
 * Includes tenant isolation and audit logging.
 */
export const DELETE = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingDeleteResponse>>(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        logger.error('Firebase Admin not initialized');
        throw new ApiError(503, 'Database unavailable');
      }

      // Extract buildingId from URL path: /api/buildings/[buildingId]
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const buildingId = pathParts[pathParts.length - 1];

      if (!buildingId) {
        throw new ApiError(400, 'Building ID is required');
      }

      // Verify building exists and check ownership
      const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();

      if (!buildingDoc.exists) {
        throw new ApiError(404, 'Building not found');
      }

      const buildingData = buildingDoc.data();
      const isSuperAdmin = isRoleBypass(ctx.globalRole);

      // 🔒 TENANT ISOLATION: Check ownership (unless super_admin)
      if (!isSuperAdmin && buildingData?.companyId !== ctx.companyId) {
        logger.warn('Unauthorized delete attempt', { email: ctx.email, buildingId });
        throw new ApiError(403, 'Unauthorized: Building belongs to different company');
      }

      logger.info('Moving building to trash (soft-delete)', { buildingId, companyId: ctx.companyId });

      // 🗑️ ADR-281: Soft-delete — move to trash (status='deleted')
      await softDelete(adminDb, 'building', buildingId, ctx.uid, ctx.companyId);

      logger.info('Building moved to trash', { buildingId, email: ctx.email });

      // 📊 Auth audit (soft-delete engine handles entity audit)
      await logAuditEvent(ctx, 'soft_deleted', 'buildings', 'api', {
        newValue: {
          type: 'building_delete',
          value: {
            buildingId,
            name: buildingData?.name ?? '',
          },
        },
        metadata: { reason: 'Building moved to trash via API' },
      });

      return apiSuccess<BuildingDeleteResponse>(
        { buildingId, deleted: true },
        'Building moved to trash'
      );
    },
    { permissions: 'buildings:buildings:delete' }
  )
);
