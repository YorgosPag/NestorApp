/**
 * 🏗️ PROJECT STRUCTURE ENDPOINT
 *
 * Returns complete project structure: Project → Buildings → (Units | Storage | Parking)
 *
 * @module api/projects/structure/[projectId]
 * @version 3.0.0
 * @updated 2026-01-21 - Added Storage and Parking to building hierarchy
 *
 * 🔒 SECURITY:
 * - Permission: projects:projects:view
 * - Tenant isolation: Verifies project ownership
 * - Filters buildings, units, storage, and parking by companyId
 *
 * 🏢 ARCHITECTURE (from BuildingSpacesTabs):
 * ❌ NO: Parking/Storage as "attachments" or children of Units
 * ✅ YES: Parking/Storage/Units as equal parallel categories in Building context
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export const dynamic = 'force-dynamic';

// Response types for type-safe withAuth
type StructureSuccess = {
  success: true;
  structure: {
    project: Record<string, unknown> & { id: string; name?: string };
    buildings: Array<{
      units: Array<{ id: string }>;
      storages: Array<{ id: string; name?: string }>;
      parkingSpots: Array<{ id: string; code?: string }>;
      id: string;
      name?: string;
    }>;
  };
  projectId: string;
  summary: {
    buildingsCount: number;
    totalUnits: number;
    totalStorages: number;
    totalParkingSpots: number;
  };
};

type StructureError = {
  success: false;
  error: string;
  projectId: string;
};

type StructureResponse = StructureSuccess | StructureError;

/**
 * @rateLimit STANDARD (60 req/min) - Project structure με multi-level queries
 */
export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await segmentData.params;

  const handler = withAuth<StructureResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<StructureResponse>> => {
      console.log(`🏗️ [Projects/Structure] Loading structure for projectId: ${projectId}`);
      console.log(`🔒 Auth Context: User ${ctx.uid}, Company ${ctx.companyId}`);

      try {
        // ============================================================================
        // STEP 1: VERIFY PROJECT OWNERSHIP (Tenant Isolation)
        // ============================================================================

        const projectDoc = await getAdminFirestore()
          .collection(COLLECTIONS.PROJECTS)
          .doc(projectId)
          .get();

        if (!projectDoc.exists) {
          console.log(`⚠️ Project not found: ${projectId}`);
          return NextResponse.json({
            success: false,
            error: 'Project not found',
            projectId
          }, { status: 404 });
        }

        const projectData = projectDoc.data();
        if (projectData?.companyId !== ctx.companyId) {
          console.warn(`🚫 TENANT ISOLATION VIOLATION: User ${ctx.uid} (company ${ctx.companyId}) attempted to access project ${projectId} (company ${projectData?.companyId})`);
          return NextResponse.json({
            success: false,
            error: 'Access denied - Project not found',
            projectId
          }, { status: 403 });
        }

        const project = { id: projectDoc.id, ...projectData } as Record<string, unknown> & { id: string; name?: string };
        console.log(`✅ Project found and ownership verified: ${project.name || 'Unnamed Project'}`);

        // ============================================================================
        // STEP 2: GET BUILDINGS (Admin SDK + Tenant Filter)
        // ============================================================================

        console.log(`🏢 Fetching buildings for projectId: ${projectId}`);

        // Try with string projectId first
        let buildingsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.BUILDINGS)
          .where('projectId', '==', projectId)
          .where('companyId', '==', ctx.companyId)
          .get();

        // If no results, try with number projectId
        if (buildingsSnapshot.docs.length === 0) {
          console.log(`🔄 Trying numeric projectId: ${parseInt(projectId)}`);
          buildingsSnapshot = await getAdminFirestore()
            .collection(COLLECTIONS.BUILDINGS)
            .where('projectId', '==', parseInt(projectId))
            .where('companyId', '==', ctx.companyId)
            .get();
        }

        console.log(`🏢 Found ${buildingsSnapshot.docs.length} buildings (tenant-scoped)`);

        const buildings = [];

        // ============================================================================
        // STEP 3: GET UNITS, STORAGE, PARKING FOR EACH BUILDING
        // ============================================================================

        for (const buildingDoc of buildingsSnapshot.docs) {
          const building = { id: buildingDoc.id, ...buildingDoc.data() } as Record<string, unknown> & { id: string; name?: string };

          // 🏠 UNITS
          console.log(`🏠 Fetching units for buildingId: ${building.id}`);
          const unitsSnapshot = await getAdminFirestore()
            .collection(COLLECTIONS.UNITS)
            .where('buildingId', '==', building.id)
            .where('companyId', '==', ctx.companyId)
            .get();

          const units = unitsSnapshot.docs.map(unitDoc => ({
            id: unitDoc.id,
            ...unitDoc.data()
          }));

          // 📦 STORAGE - Query by buildingId (from migration 006)
          console.log(`📦 Fetching storage for buildingId: ${building.id}`);
          const storageSnapshot = await getAdminFirestore()
            .collection(COLLECTIONS.STORAGE)
            .where('buildingId', '==', building.id)
            .get();

          const storages = storageSnapshot.docs.map(storageDoc => {
            const data = storageDoc.data();
            return {
              id: storageDoc.id,
              name: data.name || data.code || `Storage ${storageDoc.id.slice(-4)}`,
              type: data.type,
              status: data.status,
              area: data.area,
              floor: data.floor
            };
          });

          // 🚗 PARKING - Query by buildingId
          console.log(`🚗 Fetching parking for buildingId: ${building.id}`);
          const parkingSnapshot = await getAdminFirestore()
            .collection(COLLECTIONS.PARKING_SPACES)
            .where('buildingId', '==', building.id)
            .get();

          const parkingSpots = parkingSnapshot.docs.map(parkingDoc => {
            const data = parkingDoc.data();
            return {
              id: parkingDoc.id,
              code: data.code || data.number || `P${parkingDoc.id.slice(-4)}`,
              type: data.type,
              status: data.status,
              level: data.level,
              area: data.area
            };
          });

          console.log(`🏢 Building ${building.id}: ${units.length} units, ${storages.length} storages, ${parkingSpots.length} parking`);
          buildings.push({ ...building, units, storages, parkingSpots });
        }

        const structure = {
          project,
          buildings
        };

        const totalUnits = buildings.reduce((sum, b) => sum + b.units.length, 0);
        const totalStorages = buildings.reduce((sum, b) => sum + b.storages.length, 0);
        const totalParkingSpots = buildings.reduce((sum, b) => sum + b.parkingSpots.length, 0);
        console.log(`✅ [Projects/Structure] Complete: ${buildings.length} buildings, ${totalUnits} units, ${totalStorages} storages, ${totalParkingSpots} parking`);

        return NextResponse.json({
          success: true,
          structure,
          projectId,
          summary: {
            buildingsCount: buildings.length,
            totalUnits,
            totalStorages,
            totalParkingSpots
          }
        });

      } catch (error) {
        console.error('❌ [Projects/Structure] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          projectId,
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load project structure',
          projectId
        }, { status: 500 });
      }
    },
    { permissions: 'projects:projects:view' }
  );

  return handler(request);
});
