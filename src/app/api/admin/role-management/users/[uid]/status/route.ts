/**
 * =============================================================================
 * PATCH /api/admin/role-management/users/[uid]/status — Suspend/Reactivate User
 * =============================================================================
 *
 * Suspends or reactivates a user by:
 * 1. Firebase Auth: updateUser({ disabled }) — blocks/unblocks sign-in
 * 2. Firestore: companies/{companyId}/members/{uid} — updates status field
 *
 * Security:
 * - super_admin only
 * - Self-protection: cannot suspend yourself
 * - Tenant isolation: target must exist in company members
 *
 * Auth: withAuth (super_admin)
 * Rate: withSensitiveRateLimit
 *
 * @module api/admin/role-management/users/[uid]/status
 * @enterprise ADR-244 Role Management Admin Console
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminAuth, getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('RoleManagement:UserStatus');

// =============================================================================
// VALIDATION
// =============================================================================

const StatusChangeSchema = z.object({
  action: z.enum(['suspend', 'reactivate']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

type StatusChangeInput = z.infer<typeof StatusChangeSchema>;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract target uid from the request URL path.
 * Path format: /api/admin/role-management/users/[uid]/status
 */
function extractUidFromPath(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/');
  const usersIdx = segments.lastIndexOf('users');
  if (usersIdx === -1 || usersIdx + 1 >= segments.length) return null;
  const uid = segments[usersIdx + 1];
  return uid && uid !== 'status' ? uid : null;
}

// =============================================================================
// PATCH — Suspend / Reactivate User
// =============================================================================

export const PATCH = withSensitiveRateLimit(
  withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      const targetUid = extractUidFromPath(request);

      if (!targetUid) {
        return NextResponse.json(
          { success: false, error: 'Missing target uid in URL path' },
          { status: 400 }
        );
      }

      try {
        // Parse and validate request body
        let body: StatusChangeInput;
        try {
          const rawBody: unknown = await request.json();
          body = StatusChangeSchema.parse(rawBody);
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

        // Self-protection: cannot suspend yourself
        if (targetUid === ctx.uid) {
          return NextResponse.json(
            { success: false, error: 'Cannot change your own account status' },
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

        const isSuspend = body.action === 'suspend';
        const newStatus = isSuspend ? 'suspended' : 'active';
        const memberData = memberSnap.data();
        const currentStatus = (memberData?.status as string) ?? 'active';

        // Prevent no-op
        if (currentStatus === newStatus) {
          return NextResponse.json(
            { success: false, error: `User is already ${newStatus}` },
            { status: 409 }
          );
        }

        // 1. Update Firebase Auth: disable/enable sign-in
        await auth.updateUser(targetUid, { disabled: isSuspend });

        // 2. Update Firestore member document
        await db.doc(memberPath).update({
          status: newStatus,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: ctx.uid,
        });

        // Audit logging
        const auditAction = isSuspend ? 'user_suspended' : 'user_activated';
        await logAuditEvent(ctx, auditAction, targetUid, 'user', {
          previousValue: { type: 'status', value: currentStatus },
          newValue: { type: 'status', value: newStatus },
          metadata: { reason: body.reason },
        });

        logger.info('User status changed', {
          targetUid,
          action: body.action,
          newStatus,
          changedBy: ctx.uid,
          companyId: ctx.companyId,
        });

        return NextResponse.json({
          success: true,
          data: {
            uid: targetUid,
            action: body.action,
            previousStatus: currentStatus,
            newStatus,
          },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to change user status');
        logger.error('User status change failed', {
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
