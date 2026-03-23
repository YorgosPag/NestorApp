/**
 * =============================================================================
 * PATCH /api/admin/role-management/users/[uid]/role — Change User Global Role
 * =============================================================================
 *
 * Atomically updates a user's global role in:
 * 1. Firestore: companies/{companyId}/members/{uid}
 * 2. Firebase Auth: Custom Claims
 *
 * Security:
 * - super_admin only
 * - Self-protection: cannot change own role
 * - Tenant isolation: target must exist in company members
 * - No-op prevention: newRole must differ from current
 *
 * Auth: withAuth (super_admin)
 * Rate: withSensitiveRateLimit
 *
 * @module api/admin/role-management/users/[uid]/role
 * @enterprise ADR-244 Role Management Admin Console
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logRoleChange, logClaimsUpdated } from '@/lib/auth';
import type { AuthContext, PermissionCache, GlobalRole } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminAuth, getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { extractUidFromPath } from '@/lib/api/route-helpers';

const logger = createModuleLogger('RoleManagement:ChangeRole');

// =============================================================================
// VALIDATION
// =============================================================================

const ChangeRoleSchema = z.object({
  newRole: z.enum(['super_admin', 'company_admin', 'internal_user', 'external_user']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

type ChangeRoleInput = z.infer<typeof ChangeRoleSchema>;

// =============================================================================
// HELPERS
// =============================================================================

// =============================================================================
// PATCH — Change Global Role
// =============================================================================

export const PATCH = withSensitiveRateLimit(
  withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      const targetUid = extractUidFromPath(request, 'role');

      if (!targetUid) {
        return NextResponse.json(
          { success: false, error: 'Missing target uid in URL path' },
          { status: 400 }
        );
      }

      try {
        // Parse and validate request body
        let body: ChangeRoleInput;
        try {
          const rawBody: unknown = await request.json();
          body = ChangeRoleSchema.parse(rawBody);
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            return NextResponse.json(
              { success: false, error: 'Validation failed', details: validationError.errors },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
          );
        }

        // Self-protection: cannot change own role
        if (targetUid === ctx.uid) {
          return NextResponse.json(
            { success: false, error: 'Cannot change your own role' },
            { status: 403 }
          );
        }

        const db = getAdminFirestore();
        const auth = getAdminAuth();

        // Tenant isolation: verify target exists in company members
        const memberPath = `${COLLECTIONS.COMPANIES}/${ctx.companyId}/${SUBCOLLECTIONS.COMPANY_MEMBERS}/${targetUid}`;
        const memberSnap = await db.doc(memberPath).get();

        if (!memberSnap.exists) {
          return NextResponse.json(
            { success: false, error: 'User not found in this company' },
            { status: 404 }
          );
        }

        const memberData = memberSnap.data();
        const existingRole = (memberData?.globalRole as GlobalRole) ?? 'internal_user';

        // Prevent no-op
        if (body.newRole === existingRole) {
          return NextResponse.json(
            { success: false, error: `User already has role '${existingRole}'` },
            { status: 409 }
          );
        }

        // Atomic dual-write: Firestore + Firebase Auth custom claims
        // 1. Update Firestore member document
        await db.doc(memberPath).update({
          globalRole: body.newRole,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: ctx.uid,
        });

        // 2. Update Firebase Auth custom claims
        const existingUser = await auth.getUser(targetUid);
        const existingClaims = (existingUser.customClaims ?? {}) as Record<string, unknown>;
        await auth.setCustomUserClaims(targetUid, {
          ...existingClaims,
          globalRole: body.newRole,
        });

        // Audit logging
        await logRoleChange(ctx, targetUid, existingRole, body.newRole, body.reason);
        await logClaimsUpdated(
          ctx,
          targetUid,
          { ...existingClaims, globalRole: existingRole },
          { ...existingClaims, globalRole: body.newRole },
          body.reason
        );

        logger.info('User role changed', {
          targetUid,
          oldRole: existingRole,
          newRole: body.newRole,
          changedBy: ctx.uid,
          companyId: ctx.companyId,
        });

        return NextResponse.json({
          success: true,
          data: {
            uid: targetUid,
            previousRole: existingRole,
            newRole: body.newRole,
          },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to change user role');
        logger.error('Role change failed', {
          error: message,
          targetUid,
          companyId: ctx.companyId,
        });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
    { requiredGlobalRoles: ['super_admin'] }
  )
);
