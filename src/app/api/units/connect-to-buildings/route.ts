/**
 * 🛠️ UTILITY: CONNECT UNITS TO BUILDINGS
 *
 * Connects units to configured primary project buildings based on legacy IDs.
 *
 * @module api/units/connect-to-buildings
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { BUILDING_IDS, BuildingIdUtils } from '@/config/building-ids-config';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UnitsConnectBuildingsRoute');

// Response types for type-safe withAuth
type ConnectUnitsSuccess = {
  success: true;
  message: string;
  results: Array<{
    unitId: string;
    unitName: string;
    buildingId: string;
    buildingName: string;
    status: string;
  }>;
  summary: {
    totalUnitsConnected: number;
    buildings: Array<{ id: string; name: string }>;
  };
};

type ConnectUnitsError = {
  success: false;
  error: string;
  details?: string;
};

type ConnectUnitsResponse = ConnectUnitsSuccess | ConnectUnitsError;

/**
 * @rateLimit HEAVY (10 req/min) - Resource-intensive operation
 */
export const POST = withHeavyRateLimit(
  async (request: NextRequest) => {
  const handler = withAuth<ConnectUnitsResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ConnectUnitsResponse>> => {
      try {
        logger.info('[Units/ConnectToBuildings] Starting Admin SDK operations', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        // ============================================================================
        // STEP 1: GET BUILDINGS FOR CONFIGURED PROJECT (Admin SDK)
        // ============================================================================

        logger.info('[Units/ConnectToBuildings] Getting buildings for project', { projectId: BUILDING_IDS.PROJECT_ID });
        const buildingsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.BUILDINGS)
          .where('projectId', '==', BUILDING_IDS.PROJECT_ID)
          .get();

        const buildings = buildingsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Unknown Building'
        }));

        logger.info('[Units/ConnectToBuildings] Found buildings', { count: buildings.length, projectId: BUILDING_IDS.PROJECT_ID });

        if (buildings.length === 0) {
          return NextResponse.json({
            success: false,
            error: `No buildings found for project ${BUILDING_IDS.PROJECT_ID}`,
            details: 'Ensure project has buildings configured'
          }, { status: 404 });
        }

        // ============================================================================
        // STEP 2: GET ALL UNITS (Admin SDK)
        // ============================================================================

        logger.info('[Units/ConnectToBuildings] Getting all units from database');
        const unitsSnapshot = await getAdminFirestore().collection(COLLECTIONS.UNITS).get();

        const units = unitsSnapshot.docs.map(doc => ({
          id: doc.id,
          buildingId: doc.data().buildingId,
          name: doc.data().name,
          unitName: doc.data().unitName
        }));

        logger.info('[Units/ConnectToBuildings] Total units in database', { count: units.length });

        // ============================================================================
        // STEP 3: FIND UNITS TO CONNECT (Admin SDK)
        // ============================================================================

        const projectSearchKeyword = process.env.NEXT_PUBLIC_PROJECT_SEARCH_KEYWORD?.toLowerCase() || 'παλαιολόγου';

        const unitsToConnect = units.filter(unit => {
          const isLegacy = BuildingIdUtils.isLegacyBuildingId(unit.buildingId);
          const hasNoBuildingId = !unit.buildingId || unit.buildingId === '';
          const matchesKeyword =
            (unit.name && unit.name.toLowerCase().includes(projectSearchKeyword)) ||
            (unit.unitName && unit.unitName.toLowerCase().includes(projectSearchKeyword));

          return isLegacy || hasNoBuildingId || matchesKeyword;
        });

        logger.info('[Units/ConnectToBuildings] Units to potentially connect', { count: unitsToConnect.length });

        if (unitsToConnect.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No units need connecting',
            results: [],
            summary: {
              totalUnitsConnected: 0,
              buildings: buildings
            }
          });
        }

        // ============================================================================
        // STEP 4: CONNECT UNITS TO BUILDINGS (Admin SDK)
        // ============================================================================

        const buildingAPattern = process.env.NEXT_PUBLIC_BUILDING_A_SEARCH_PATTERN || 'ΚΤΙΡΙΟ Α';
        const buildingBPattern = process.env.NEXT_PUBLIC_BUILDING_B_SEARCH_PATTERN || 'ΚΤΙΡΙΟ Β';

        const buildingA = buildings.find(b => b.name.includes(buildingAPattern));
        const buildingB = buildings.find(b => b.name.includes(buildingBPattern));

        const results = [];

        for (const unit of unitsToConnect) {
          // 🏢 ENTERPRISE: Map legacy building IDs to new building IDs
          let targetBuilding;
          if (unit.buildingId === BUILDING_IDS.LEGACY_BUILDING_1) {
            targetBuilding = buildingA; // legacy building-1 -> ΚΤΙΡΙΟ Α
          } else if (unit.buildingId === BUILDING_IDS.LEGACY_BUILDING_2) {
            targetBuilding = buildingB; // legacy building-2 -> ΚΤΙΡΙΟ Β
          } else {
            // For units without buildingId, alternate between buildings
            targetBuilding = results.length % 2 === 0 ? buildingA : buildingB;
          }

          if (targetBuilding) {
            logger.info('[Units/ConnectToBuildings] Connecting unit to building', { unitId: unit.id, buildingId: targetBuilding.id });

            await getAdminFirestore().collection(COLLECTIONS.UNITS).doc(unit.id).update({
              buildingId: targetBuilding.id,
              projectId: BUILDING_IDS.PROJECT_ID,
              updatedAt: new Date().toISOString()
            });

            results.push({
              unitId: unit.id,
              unitName: unit.name || unit.unitName || 'Unknown Unit',
              buildingId: targetBuilding.id,
              buildingName: targetBuilding.name,
              status: 'connected'
            });
          }
        }

        logger.info('[Units/ConnectToBuildings] Complete', { connectedCount: results.length });

        return NextResponse.json({
          success: true,
          message: 'Units connected to buildings successfully',
          results,
          summary: {
            totalUnitsConnected: results.length,
            buildings: buildings
          }
        });

      } catch (error) {
        logger.error('[Units/ConnectToBuildings] Error', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to connect units to buildings',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
  }
);
