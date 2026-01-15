/**
 * 🏗️ PROJECT STRUCTURE ENDPOINT
 *
 * Returns complete project structure: Project → Buildings → Units
 *
 * @module api/projects/structure/[projectId]
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 *
 * 🔒 SECURITY:
 * - Permission: projects:projects:view
 * - Tenant isolation: Verifies project ownership
 * - Filters buildings and units by companyId
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await segmentData.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      console.log(`🏗️ [Projects/Structure] Loading structure for projectId: ${projectId}`);
      console.log(`🔒 Auth Context: User ${ctx.uid}, Company ${ctx.companyId}`);

      try {
        // ============================================================================
        // STEP 1: VERIFY PROJECT OWNERSHIP (Tenant Isolation)
        // ============================================================================

        const projectDoc = await adminDb
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
        let buildingsSnapshot = await adminDb
          .collection(COLLECTIONS.BUILDINGS)
          .where('projectId', '==', projectId)
          .where('companyId', '==', ctx.companyId)
          .get();

        // If no results, try with number projectId
        if (buildingsSnapshot.docs.length === 0) {
          console.log(`🔄 Trying numeric projectId: ${parseInt(projectId)}`);
          buildingsSnapshot = await adminDb
            .collection(COLLECTIONS.BUILDINGS)
            .where('projectId', '==', parseInt(projectId))
            .where('companyId', '==', ctx.companyId)
            .get();
        }

        console.log(`🏢 Found ${buildingsSnapshot.docs.length} buildings (tenant-scoped)`);

        const buildings = [];

        // ============================================================================
        // STEP 3: GET UNITS FOR EACH BUILDING (Admin SDK + Tenant Filter)
        // ============================================================================

        for (const buildingDoc of buildingsSnapshot.docs) {
          const building = { id: buildingDoc.id, ...buildingDoc.data() } as Record<string, unknown> & { id: string; name?: string };

          console.log(`🏠 Fetching units for buildingId: ${building.id}`);
          const unitsSnapshot = await adminDb
            .collection(COLLECTIONS.UNITS)
            .where('buildingId', '==', building.id)
            .where('companyId', '==', ctx.companyId)
            .get();

          const units = unitsSnapshot.docs.map(unitDoc => ({
            id: unitDoc.id,
            ...unitDoc.data()
          }));

          console.log(`🏠 Building ${building.id}: Found ${units.length} units`);
          buildings.push({ ...building, units });
        }

        const structure = {
          project,
          buildings
        };

        const totalUnits = buildings.reduce((sum, b) => sum + b.units.length, 0);
        console.log(`✅ [Projects/Structure] Complete: ${buildings.length} buildings, ${totalUnits} total units`);

        return NextResponse.json({
          success: true,
          structure,
          projectId,
          summary: {
            buildingsCount: buildings.length,
            totalUnits
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
}