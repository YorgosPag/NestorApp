/**
 * =============================================================================
 * DEBUG PROJECTS - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Debugs projects with buildings structure
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin
 * @classification Debug utility (read-only data inspection)
 *
 * This endpoint inspects project data for debugging purposes:
 * - Lists all projects
 * - Shows buildings structure
 * - Counts buildings per project
 *
 * @method GET - Debug projects data (read-only)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:debug:read permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - NO audit logging (read-only operation)
 *
 * @technology Client-side Firestore
 * @classification Debug utility (read-only)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/**
 * GET - Debug Projects (withAuth protected)
 * Read-only inspection of projects and buildings structure.
 *
 * @security withAuth + super_admin check + admin:debug:read permission
 */
export const GET = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleDebugProjects(req, ctx);
  },
  { permissions: 'admin:debug:read' }
);

/**
 * Internal handler for GET (debug projects).
 */
async function handleDebugProjects(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [GET /api/debug-projects] BLOCKED: Non-super_admin attempted projects debug`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole }
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    console.log('🔍 Debugging projects with buildings...');

    // Get all projects to see what's available
    const projectsQuery = query(collection(db, COLLECTIONS.PROJECTS));
    
    const projectsSnapshot = await getDocs(projectsQuery);
    const projects = projectsSnapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${projects.length} projects in database`);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      projects: projects,
      debug: {
        projectCount: projects.length,
        projectBuildings: projects.map(p => ({
          docId: p.docId,
          id: p.id,
          name: p.name,
          buildings: p.buildings ? p.buildings.length : 0,
          buildingNames: p.buildings ? p.buildings.map((b: { name?: string }) => b.name) : []
        }))
      },
      executionTimeMs: duration,
    });

  } catch (error: unknown) {
    console.error('❌ Error debugging projects:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      error: 'Failed to debug projects',
      details: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: duration,
    }, { status: 500 });
  }
}