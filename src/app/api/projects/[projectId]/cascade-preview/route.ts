/**
 * =============================================================================
 * 🏢 ENTERPRISE: CASCADE DELETE PREVIEW ENDPOINT
 * =============================================================================
 *
 * Returns a summary of all child entities that would be cascade-deleted
 * if this project is deleted. Used by the frontend to show a confirmation
 * dialog with full cascade impact.
 *
 * @route GET /api/projects/[projectId]/cascade-preview
 * @permission projects:projects:delete
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

const logger = createModuleLogger('CascadePreview');

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// TYPES
// ============================================================================

interface CascadeChildItem {
  id: string;
  name: string;
}

interface CascadePreviewResponse {
  projectId: string;
  projectName: string;
  buildings: Array<CascadeChildItem & {
    units: CascadeChildItem[];
    parking: CascadeChildItem[];
    storage: CascadeChildItem[];
    floors: CascadeChildItem[];
  }>;
  totals: {
    buildings: number;
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
  withAuth<ApiSuccessResponse<CascadePreviewResponse>>(
    async (
      _request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      const url = new URL(_request.url);
      const pathParts = url.pathname.split('/');
      // URL: /api/projects/[projectId]/cascade-preview
      const projectId = pathParts[pathParts.length - 2];

      if (!projectId) {
        throw new ApiError(400, 'Project ID is required');
      }

      const db = getAdminFirestore();

      // 1. Verify project exists + tenant isolation
      const projectDoc = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
      if (!projectDoc.exists) {
        throw new ApiError(404, 'Project not found');
      }

      const projectData = projectDoc.data();
      const isSuperAdmin = isRoleBypass(ctx.globalRole);
      if (!isSuperAdmin && projectData?.companyId !== ctx.companyId) {
        throw new ApiError(403, 'Access denied - Project not found');
      }

      // 2. Query all buildings for this project
      const buildingsSnap = await db
        .collection(COLLECTIONS.BUILDINGS)
        .where('projectId', '==', projectId)
        .get();

      const totals = { buildings: 0, units: 0, parking: 0, storage: 0, floors: 0, total: 0 };
      const buildings: CascadePreviewResponse['buildings'] = [];

      for (const buildingDoc of buildingsSnap.docs) {
        const bData = buildingDoc.data();
        const buildingId = buildingDoc.id;

        // Query children in parallel for each building
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

        buildings.push({
          id: buildingId,
          name: bData?.name ?? buildingId,
          units,
          parking,
          storage,
          floors,
        });

        totals.units += units.length;
        totals.parking += parking.length;
        totals.storage += storage.length;
        totals.floors += floors.length;
      }

      totals.buildings = buildings.length;
      totals.total = totals.buildings + totals.units + totals.parking + totals.storage + totals.floors;

      logger.info('[CascadePreview] Preview generated', { projectId, totals });

      return apiSuccess<CascadePreviewResponse>(
        {
          projectId,
          projectName: projectData?.name ?? '',
          buildings,
          totals,
        },
        'Cascade preview generated'
      );
    },
    { permissions: 'projects:projects:delete' }
  )
);
