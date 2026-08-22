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
import { FieldValue } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { extractUidFromPath } from '@/lib/api/route-helpers';
import {
  failWithLoggedError,
  parseJsonBody,
  prepareMemberMutation,
} from '@/lib/api/role-management-helpers';

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
      const targetUid = extractUidFromPath(request, 'status');

      if (!targetUid) {
        return NextResponse.json(
          { success: false, error: 'Missing target uid in URL path' },
          { status: 400 }
        );
      }

      try {
        // Parse + validate (SSoT: lib/api/role-management-helpers).
        const parsed = await parseJsonBody(request, StatusChangeSchema);
        if (!parsed.ok) return parsed.response;
        const body = parsed.value;

        // Self-protection: cannot suspend yourself + tenant isolation, σε ΕΝΑ βήμα
        // (SSoT: lib/api/role-management-helpers).
        const prepared = await prepareMemberMutation(ctx, targetUid, 'Cannot change your own account status');
        if (!prepared.ok) return prepared.response;
        const { auth, member } = prepared.value;

        const isSuspend = body.action === 'suspend';
        const newStatus = isSuspend ? 'suspended' : 'active';
        const memberData = member.data;
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
        await member.ref.update({
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
        return failWithLoggedError(logger, 'User status change failed', error, 'Failed to change user status', {
          targetUid,
          companyId: ctx.companyId,
        });
      }
    },
    { requiredGlobalRoles: ['super_admin'] }
  )
);
