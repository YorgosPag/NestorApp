/**
 * =============================================================================
 * 🏢 ENTERPRISE: BUILDING CASCADE DELETE PREVIEW ENDPOINT
 * =============================================================================
 *
 * Returns a summary of all child entities that would be cascade-deleted
 * if this building is deleted. Used by the frontend to show a confirmation
 * dialog with full cascade impact.
 *
 * @route GET /api/buildings/[buildingId]/cascade-preview
 * @permission buildings:buildings:delete
 * @security Admin SDK + withAuth + Tenant Isolation
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingCascadePreview');

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// TYPES
// ============================================================================

interface CascadeChildItem {
  id: string;
  name: string;
}

interface BuildingCascadePreviewResponse {
  buildingId: string;
  buildingName: string;
  children: {
    units: CascadeChildItem[];
    parking: CascadeChildItem[];
    storage: CascadeChildItem[];
    floors: CascadeChildItem[];
  };
  totals: {
    units: number;
    parking: number;
    storage: number;
    floors: number;
    total: number;
  };
}

// ============================================================================
// HANDLER
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingCascadePreviewResponse>>(
    async (
      _request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      const url = new URL(_request.url);
      const pathParts = url.pathname.split('/');
      // URL: /api/buildings/[buildingId]/cascade-preview
      const buildingId = pathParts[pathParts.length - 2];

      if (!buildingId) {
        throw new ApiError(400, 'Building ID is required');
      }

      const db = getAdminFirestore();

      // 1. Verify building exists + tenant isolation
      const buildingDoc = await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
      if (!buildingDoc.exists) {
        throw new ApiError(404, 'Building not found');
      }

      const buildingData = buildingDoc.data();
      const isSuperAdmin = isRoleBypass(ctx.globalRole);
      if (!isSuperAdmin && buildingData?.companyId !== ctx.companyId) {
        throw new ApiError(403, 'Access denied - Building not found');
      }

      // 2. Query all children in parallel
      const [unitsSnap, parkingSnap, storageSnap, floorsSnap] = await Promise.all([
        db.collection(COLLECTIONS.UNITS).where('buildingId', '==', buildingId).get(),
        db.collection(COLLECTIONS.PARKING_SPACES).where('buildingId', '==', buildingId).get(),
        db.collection(COLLECTIONS.STORAGE).where('buildingId', '==', buildingId).get(),
        db.collection(COLLECTIONS.FLOORS).where('buildingId', '==', buildingId).get(),
      ]);

      const units = unitsSnap.docs.map(d => ({ id: d.id, name: d.data()?.name ?? d.data()?.unitCode ?? d.id }));
      const parking = parkingSnap.docs.map(d => ({ id: d.id, name: d.data()?.name ?? d.data()?.spotNumber ?? d.id }));
      const storage = storageSnap.docs.map(d => ({ id: d.id, name: d.data()?.name ?? d.data()?.storageCode ?? d.id }));
      const floors = floorsSnap.docs.map(d => ({ id: d.id, name: d.data()?.name ?? d.data()?.floorNumber?.toString() ?? d.id }));

      const totals = {
        units: units.length,
        parking: parking.length,
        storage: storage.length,
        floors: floors.length,
        total: units.length + parking.length + storage.length + floors.length,
      };

      logger.info('[BuildingCascadePreview] Preview generated', { buildingId, totals });

      return apiSuccess<BuildingCascadePreviewResponse>(
        {
          buildingId,
          buildingName: buildingData?.name ?? '',
          children: { units, parking, storage, floors },
          totals,
        },
        'Building cascade preview generated'
      );
    },
    { permissions: 'buildings:buildings:delete' }
  )
);
