/**
 * 🛠️ UTILITY: TEST UNITS-BUILDINGS CONNECTION
 *
 * Diagnostic endpoint to test units and buildings connection status.
 *
 * @module api/units/test-connection
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 *
 * @rateLimit STANDARD (60 req/min) - Unit connection diagnostic utility
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { BUILDING_IDS, BuildingIdUtils } from '@/config/building-ids-config';
import { COLLECTIONS } from '@/config/firestore-collections';

// Response types for type-safe withAuth
type TestConnectionSuccess = {
  success: true;
  buildings: Array<{ id: string; name: string; projectId: string }>;
  sampleUnits: Array<{
    id: string;
    name: string;
    buildingId: string;
    building: unknown;
    project: unknown;
  }>;
  totalUnits: number;
  unitsWithBuildingId: number;
  unitsWithLegacyBuilding1: number;
  unitsWithLegacyBuilding2: number;
  unitsWithLegacyIds: number;
};

type TestConnectionError = {
  success: false;
  error: string;
  details?: string;
};

type TestConnectionResponse = TestConnectionSuccess | TestConnectionError;

const getHandler = async (request: NextRequest) => {
  const handler = withAuth<TestConnectionResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<TestConnectionResponse>> => {
      try {
        console.log('🔍 [Units/TestConnection] Starting Admin SDK operations...');
        console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

        // ============================================================================
        // STEP 1: GET BUILDINGS FOR CONFIGURED PROJECT (Admin SDK)
        // ============================================================================

        console.log(`🏢 Getting buildings for project ${BUILDING_IDS.PROJECT_ID}...`);
        const buildingsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.BUILDINGS)
          .where('projectId', '==', BUILDING_IDS.PROJECT_ID)
          .get();

        const buildings = buildingsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unknown Building',
            projectId: data.projectId || 'Unknown Project'
          };
        });

        console.log(`Found ${buildings.length} buildings for project ${BUILDING_IDS.PROJECT_ID}`);

        // ============================================================================
        // STEP 2: GET SAMPLE UNITS (Admin SDK)
        // ============================================================================

        console.log('🏠 Getting sample units...');
        const unitsSnapshot = await getAdminFirestore().collection(COLLECTIONS.UNITS).get();

        const allUnits = unitsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unknown Unit',
            buildingId: data.buildingId || '',
            building: data.building,
            project: data.project
          };
        });

        const sampleUnits = allUnits.slice(0, 10);

        // ============================================================================
        // STEP 3: CALCULATE STATISTICS (Admin SDK)
        // ============================================================================

        const stats = {
          totalUnits: allUnits.length,
          unitsWithBuildingId: allUnits.filter(u => u.buildingId).length,
          unitsWithLegacyBuilding1: allUnits.filter(u => u.buildingId === BUILDING_IDS.LEGACY_BUILDING_1).length,
          unitsWithLegacyBuilding2: allUnits.filter(u => u.buildingId === BUILDING_IDS.LEGACY_BUILDING_2).length,
          unitsWithLegacyIds: allUnits.filter(u => BuildingIdUtils.isLegacyBuildingId(u.buildingId)).length
        };

        console.log(`✅ [Units/TestConnection] Complete: ${stats.totalUnits} units analyzed`);

        return NextResponse.json({
          success: true,
          buildings: buildings,
          sampleUnits: sampleUnits,
          totalUnits: stats.totalUnits,
          unitsWithBuildingId: stats.unitsWithBuildingId,
          unitsWithLegacyBuilding1: stats.unitsWithLegacyBuilding1,
          unitsWithLegacyBuilding2: stats.unitsWithLegacyBuilding2,
          unitsWithLegacyIds: stats.unitsWithLegacyIds
        });

      } catch (error) {
        console.error('❌ [Units/TestConnection] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to test connection',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
};

export const GET = withStandardRateLimit(getHandler);
