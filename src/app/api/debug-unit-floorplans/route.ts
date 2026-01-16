/**
 * =============================================================================
 * DEBUG UNIT FLOORPLANS - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Debugs unit floorplans from documents collection
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin
 * @classification Debug utility (read-only data inspection)
 *
 * This endpoint inspects unit floorplan documents for debugging purposes:
 * - Lists all floorplan documents
 * - Shows floorplan metadata (unitId, type, fileName)
 * - Checks for scene data
 *
 * @method GET - Debug floorplans data (read-only)
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
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/**
 * GET - Debug Unit Floorplans (withAuth protected)
 * Read-only inspection of unit floorplan documents.
 *
 * @security withAuth + super_admin check + admin:debug:read permission
 */
export const GET = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleDebugUnitFloorplans(req, ctx);
  },
  { permissions: 'admin:debug:read' }
);

/**
 * Internal handler for GET (debug unit floorplans).
 */
async function handleDebugUnitFloorplans(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [GET /api/debug-unit-floorplans] BLOCKED: Non-super_admin attempted floorplans debug`,
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
    console.log('🔍 Debugging unit floorplans...');

    // Get all unit floorplans from Firestore
    const floorplansQuery = query(
      collection(db, COLLECTIONS.DOCUMENTS),
      orderBy('updatedAt', 'desc')
    );
    
    const floorplansSnapshot = await getDocs(floorplansQuery);
    const floorplans = floorplansSnapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${floorplans.length} unit floorplans`);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      floorplans: floorplans.map(f => ({
        docId: f.docId,
        unitId: f.unitId,
        type: f.type,
        fileName: f.fileName,
        updatedAt: f.updatedAt,
        hasScene: !!f.scene
      })),
      count: floorplans.length,
      sampleFloorplan: floorplans[0] ? {
        docId: floorplans[0].docId,
        unitId: floorplans[0].unitId,
        type: floorplans[0].type,
        fileName: floorplans[0].fileName,
        sceneKeysCount: floorplans[0].scene ? Object.keys(floorplans[0].scene).length : 0
      } : null,
      executionTimeMs: duration,
    });

  } catch (error: unknown) {
    console.error('❌ Error debugging unit floorplans:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      error: 'Failed to debug unit floorplans',
      details: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: duration,
    }, { status: 500 });
  }
}