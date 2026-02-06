/**
 * =============================================================================
 * FIX UNIT PROJECT - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Fixes projectId for a specific unit
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Targeted data fix
 *
 * This endpoint updates a single unit's projectId field.
 *
 * @method POST - Execute projectId fix for unit
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @classification Targeted data fix (single entity update)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * POST - Execute Unit ProjectId Fix (withAuth protected)
 * Updates a single unit's projectId field.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleFixUnitProjectExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for POST (fix unit projectId).
 */
async function handleFixUnitProjectExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [POST /api/admin/fix-unit-project] BLOCKED: Non-super_admin attempted unit projectId fix`,
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
    const { unitId, newProjectId } = await request.json();

    if (!unitId || !newProjectId) {
      return NextResponse.json(
        { success: false, error: 'Missing unitId or newProjectId' },
        { status: 400 }
      );
    }

    console.log(`🔧 Updating unit ${unitId} with projectId: ${newProjectId}`);

    const unitRef = doc(db, COLLECTIONS.UNITS, unitId);
    await updateDoc(unitRef, {
      projectId: newProjectId,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ Unit ${unitId} updated successfully`);

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'fix_unit_project_id',
      {
        operation: 'fix-unit-project',
        unitId,
        newProjectId,
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Unit projectId fix by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({
      success: true,
      message: `Unit ${unitId} updated with projectId: ${newProjectId}`,
      unitId,
      newProjectId,
      executionTimeMs: duration,
    });
  } catch (error: unknown) {
    console.error('❌ Error updating unit:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update unit',
        details: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: duration,
      },
      { status: 500 }
    );
  }
}
