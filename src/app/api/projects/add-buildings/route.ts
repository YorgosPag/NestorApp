/**
 * 🛠️ UTILITY: ADD BUILDINGS TO PROJECT
 *
 * Break-glass utility for bulk building assignment to project.
 *
 * @module api/projects/add-buildings
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { BUILDING_IDS } from '@/config/building-ids-config';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function POST(request: NextRequest) {
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      console.log('🏗️ [Projects/AddBuildings] Starting building assignment...');
      console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

      try {
        // ============================================================================
        // STEP 1: GET BUILDINGS FOR CONFIGURED PROJECT
        // ============================================================================

        const buildingsSnapshot = await adminDb
          .collection(COLLECTIONS.BUILDINGS)
          .where('projectId', '==', BUILDING_IDS.PROJECT_ID)
          .get();

        const buildings = buildingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Record<string, unknown> & { id: string; name?: string; description?: string; status?: string; buildingFloors?: unknown[]; floors?: unknown[]; totalArea?: number; units?: number }));

        console.log(`✅ Found ${buildings.length} buildings for project ${BUILDING_IDS.PROJECT_ID}`);

        if (buildings.length === 0) {
          throw new Error(`No buildings found for project ${BUILDING_IDS.PROJECT_ID}`);
        }

        // ============================================================================
        // STEP 2: UPDATE PROJECT WITH BUILDINGS (Admin SDK)
        // ============================================================================

        await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .doc(BUILDING_IDS.PROJECT_ID.toString())
          .update({
            buildings: buildings.map(building => ({
              id: building.id,
              name: building.name,
              description: building.description,
              status: building.status,
              floors: building.buildingFloors || building.floors || [],
              totalArea: building.totalArea,
              units: building.units
            })),
            updatedAt: new Date().toISOString()
          });

        console.log(`✅ [Projects/AddBuildings] Complete: Added ${buildings.length} buildings to project ${BUILDING_IDS.PROJECT_ID}`);

        return NextResponse.json({
          success: true,
          message: 'Buildings added to project successfully',
          projectId: BUILDING_IDS.PROJECT_ID,
          buildings: buildings.map(b => ({ id: b.id, name: b.name })),
          summary: {
            buildingsCount: buildings.length
          }
        });

      } catch (error) {
        console.error('❌ [Projects/AddBuildings] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to add buildings to project',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
}