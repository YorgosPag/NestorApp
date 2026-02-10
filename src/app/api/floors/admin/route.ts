/**
 * 🛠️ UTILITY: FLOORS ADMIN API
 *
 * Admin SDK access to floors with elevated permissions.
 *
 * @module api/floors/admin
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
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FloorsAdminRoute');

/** Floor document from Firestore */
interface AdminFloorDocument {
  id: string;
  number?: number;
  name?: string;
  buildingId: string;
  projectId?: string;
  [key: string]: unknown;
}

// Response types for type-safe withAuth
type AdminFloorsSuccess = {
  success: true;
  floors: AdminFloorDocument[];
  floorsByBuilding?: Record<string, AdminFloorDocument[]>;
  stats: {
    totalFloors: number;
    buildingId?: string;
    projectId?: string;
    buildingsWithFloors?: number;
  };
};

type AdminFloorsError = {
  success: false;
  error: string;
  details?: string;
  usage?: string;
};

type AdminFloorsResponse = AdminFloorsSuccess | AdminFloorsError;

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export async function GET(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth<AdminFloorsResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<AdminFloorsResponse>> => {
      try {
        const { searchParams } = new URL(request.url);
        const buildingId = searchParams.get('buildingId');
        const projectId = searchParams.get('projectId');

        logger.info('[Floors/Admin] Starting Admin SDK operations', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        // Validate required parameters
        if (!buildingId && !projectId) {
          return NextResponse.json({
            success: false,
            error: 'Either buildingId or projectId parameter is required',
            usage: 'GET /api/floors/admin?buildingId=<id> or GET /api/floors/admin?projectId=<id>'
          }, { status: 400 });
        }

        logger.info('[Admin] Loading floors', { buildingId, projectId });

        // ============================================================================
        // ADMIN SDK QUERY (No tenant isolation - super_admin has full access)
        // ============================================================================

        let floors: AdminFloorDocument[] = [];

        if (buildingId) {
          // Query floors by buildingId (Enterprise foreign key relationship)
          const floorsSnapshot = await getAdminFirestore().collection(COLLECTIONS.FLOORS)
            .where('buildingId', '==', buildingId)
            .get();

          floors = floorsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as AdminFloorDocument));

          // Sort by floor number in code (to avoid index requirements)
          floors.sort((a, b) => (a.number || 0) - (b.number || 0));

        } else if (projectId) {
          // Query floors by projectId
          const floorsSnapshot = await getAdminFirestore().collection(COLLECTIONS.FLOORS)
            .where('projectId', '==', projectId)
            .get();

          floors = floorsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as AdminFloorDocument));

          // Sort by building and then by floor number
          floors.sort((a, b) => {
            if (a.buildingId !== b.buildingId) {
              return a.buildingId.localeCompare(b.buildingId);
            }
            return (a.number || 0) - (b.number || 0);
          });
        }

        logger.info('[Floors/Admin] Complete', { floorCount: floors.length });

        // Group floors by building if querying by projectId
        if (projectId) {
          const floorsByBuilding = floors.reduce((groups: Record<string, AdminFloorDocument[]>, floor: AdminFloorDocument) => {
            const bId = floor.buildingId;
            if (!groups[bId]) {
              groups[bId] = [];
            }
            groups[bId].push(floor);
            return groups;
          }, {} as Record<string, AdminFloorDocument[]>);

          return NextResponse.json({
            success: true,
            floors,
            floorsByBuilding,
            stats: {
              totalFloors: floors.length,
              buildingsWithFloors: Object.keys(floorsByBuilding).length,
              projectId
            }
          });
        } else {
          return NextResponse.json({
            success: true as const,
            floors,
            stats: {
              totalFloors: floors.length,
              buildingId: buildingId ?? undefined  // 🏢 ENTERPRISE: undefined for optional fields
            }
          });
        }

      } catch (error) {
        logger.error('[Floors/Admin] Error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to fetch admin floors',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  ));

  return handler(request);
}
