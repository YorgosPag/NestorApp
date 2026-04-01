/**
 * 🛠️ UTILITY: CONNECT UNITS TO BUILDINGS
 *
 * Connects properties to configured primary project buildings based on legacy IDs.
 *
 * @module api/properties/connect-to-buildings
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
import { FIELDS } from '@/config/firestore-field-constants';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertiesConnectBuildingsRoute');

// Response types for type-safe withAuth
type ConnectPropertiesSuccess = {
  success: true;
  message: string;
  results: Array<{
    propertyId: string;
    propertyName: string;
    buildingId: string;
    buildingName: string;
    status: string;
  }>;
  summary: {
    totalPropertiesConnected: number;
    buildings: Array<{ id: string; name: string }>;
  };
};

type ConnectPropertiesError = {
  success: false;
  error: string;
  details?: string;
};

type ConnectPropertiesResponse = ConnectPropertiesSuccess | ConnectPropertiesError;

/**
 * @rateLimit HEAVY (10 req/min) - Resource-intensive operation
 */
export const POST = withHeavyRateLimit(
  async (request: NextRequest) => {
  const handler = withAuth<ConnectPropertiesResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ConnectPropertiesResponse>> => {
      try {
        logger.info('[Properties/ConnectToBuildings] Starting Admin SDK operations', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        // ============================================================================
        // STEP 1: GET BUILDINGS FOR CONFIGURED PROJECT (Admin SDK)
        // ============================================================================

        logger.info('[Properties/ConnectToBuildings] Getting buildings for project', { projectId: BUILDING_IDS.PROJECT_ID });
        const buildingsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.BUILDINGS)
          .where(FIELDS.PROJECT_ID, '==', BUILDING_IDS.PROJECT_ID)
          .get();

        const buildings = buildingsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Unknown Building'
        }));

        logger.info('[Properties/ConnectToBuildings] Found buildings', { count: buildings.length, projectId: BUILDING_IDS.PROJECT_ID });

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

        logger.info('[Properties/ConnectToBuildings] Getting all properties from database');
        const propertiesSnapshot = await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).get();

        const properties = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          buildingId: doc.data().buildingId,
          name: doc.data().name,
          propertyName: doc.data().propertyName
        }));

        logger.info('[Properties/ConnectToBuildings] Total properties in database', { count: properties.length });

        // ============================================================================
        // STEP 3: FIND UNITS TO CONNECT (Admin SDK)
        // ============================================================================

        const projectSearchKeyword = process.env.NEXT_PUBLIC_PROJECT_SEARCH_KEYWORD?.toLowerCase() || 'παλαιολόγου';

        const propertiesToConnect = properties.filter(property => {
          const isLegacy = BuildingIdUtils.isLegacyBuildingId(property.buildingId);
          const hasNoBuildingId = !property.buildingId || property.buildingId === '';
          const matchesKeyword =
            (property.name && property.name.toLowerCase().includes(projectSearchKeyword)) ||
            (property.propertyName && property.propertyName.toLowerCase().includes(projectSearchKeyword));

          return isLegacy || hasNoBuildingId || matchesKeyword;
        });

        logger.info('[Properties/ConnectToBuildings] Properties to potentially connect', { count: propertiesToConnect.length });

        if (propertiesToConnect.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No properties need connecting',
            results: [],
            summary: {
              totalPropertiesConnected: 0,
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

        for (const property of propertiesToConnect) {
          // 🏢 ENTERPRISE: Map legacy building IDs to new building IDs
          let targetBuilding;
          if (property.buildingId === BUILDING_IDS.LEGACY_BUILDING_1) {
            targetBuilding = buildingA; // legacy building-1 -> ΚΤΙΡΙΟ Α
          } else if (property.buildingId === BUILDING_IDS.LEGACY_BUILDING_2) {
            targetBuilding = buildingB; // legacy building-2 -> ΚΤΙΡΙΟ Β
          } else {
            // For properties without buildingId, alternate between buildings
            targetBuilding = results.length % 2 === 0 ? buildingA : buildingB;
          }

          if (targetBuilding) {
            logger.info('[Properties/ConnectToBuildings] Connecting property to building', { propertyId: property.id, buildingId: targetBuilding.id });

            await getAdminFirestore().collection(COLLECTIONS.PROPERTIES).doc(property.id).update({
              buildingId: targetBuilding.id,
              projectId: BUILDING_IDS.PROJECT_ID,
              updatedAt: new Date().toISOString()
            });

            results.push({
              propertyId: property.id,
              propertyName: property.name || property.propertyName || 'Unknown Property',
              buildingId: targetBuilding.id,
              buildingName: targetBuilding.name,
              status: 'connected'
            });
          }
        }

        logger.info('[Properties/ConnectToBuildings] Complete', { connectedCount: results.length });

        return NextResponse.json({
          success: true,
          message: 'Properties connected to buildings successfully',
          results,
          summary: {
            totalPropertiesConnected: results.length,
            buildings: buildings
          }
        });

      } catch (error) {
        logger.error('[Properties/ConnectToBuildings] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to connect properties to buildings',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
  }
);
