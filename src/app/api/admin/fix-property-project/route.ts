/**
 * =============================================================================
 * FIX PROPERTY PROJECT - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Fixes projectId for a specific property
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Targeted data fix
 *
 * This endpoint updates a single property's projectId field.
 *
 * @method POST - Execute projectId fix for property
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
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('FixPropertyProjectRoute');

/**
 * POST - Execute Property ProjectId Fix (withAuth protected)
 * Updates a single property's projectId field.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleFixPropertyProjectExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for POST (fix property projectId).
 */
async function handleFixPropertyProjectExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted property projectId fix', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });
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
    const { propertyId, newProjectId } = await request.json();

    if (!propertyId || !newProjectId) {
      return NextResponse.json(
        { success: false, error: 'Missing propertyId or newProjectId' },
        { status: 400 }
      );
    }

    logger.info('Updating property projectId', { propertyId, newProjectId });

    const db = getAdminFirestore();
    const propertyRef = db.collection(COLLECTIONS.PROPERTIES).doc(propertyId);
    await propertyRef.update({
      projectId: newProjectId,
      updatedAt: new Date().toISOString(),
    });

    logger.info('Property updated successfully', { propertyId });

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'fix_property_project_id',
      {
        operation: 'fix-property-project',
        propertyId,
        newProjectId,
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Property projectId fix by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      message: `Property ${propertyId} updated with projectId: ${newProjectId}`,
      propertyId,
      newProjectId,
      executionTimeMs: duration,
    });
  } catch (error: unknown) {
    logger.error('Error updating property', { error });
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update property',
        details: getErrorMessage(error),
        executionTimeMs: duration,
      },
      { status: 500 }
    );
  }
}
