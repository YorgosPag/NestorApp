/**
 * =============================================================================
 * PATCH /api/admin/role-management/users/[uid]/permission-sets — Update Permission Sets
 * =============================================================================
 *
 * Updates the org-level permission sets assigned to a user.
 * Computes diff (added/removed) and logs each change individually.
 *
 * Security:
 * - super_admin only
 * - All permission set IDs validated against registry
 * - Tenant isolation: target must exist in company members
 *
 * Auth: withAuth (super_admin)
 * Rate: withSensitiveRateLimit
 *
 * @module api/admin/role-management/users/[uid]/permission-sets
 * @enterprise ADR-244 Role Management Admin Console
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logPermissionGranted, logPermissionRevoked, getAllPermissionSetIds } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { extractUidFromPath } from '@/lib/api/route-helpers';

const logger = createModuleLogger('RoleManagement:PermissionSets');

// =============================================================================
// VALIDATION
// =============================================================================

const UpdatePermissionSetsSchema = z.object({
  permissionSetIds: z.array(z.string()),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

type UpdatePermissionSetsInput = z.infer<typeof UpdatePermissionSetsSchema>;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Compute the diff between two string arrays.
 */
function computeArrayDiff(
  previous: string[],
  next: string[]
): { added: string[]; removed: string[] } {
  const prevSet = new Set(previous);
  const nextSet = new Set(next);

  const added = next.filter((id) => !prevSet.has(id));
  const removed = previous.filter((id) => !nextSet.has(id));

  return { added, removed };
}

// =============================================================================
// PATCH — Update Permission Sets
// =============================================================================

export const PATCH = withSensitiveRateLimit(
  withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      const targetUid = extractUidFromPath(request, 'permission-sets');

      if (!targetUid) {
        return NextResponse.json(
          { success: false, error: 'Missing target uid in URL path' },
          { status: 400 }
        );
      }

      try {
        // Parse and validate request body
        let body: UpdatePermissionSetsInput;
        try {
          const rawBody: unknown = await request.json();
          body = UpdatePermissionSetsSchema.parse(rawBody);
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

        // Validate all permission set IDs exist in the registry
        const validIds = getAllPermissionSetIds();
        const validIdSet = new Set(validIds);
        const invalidIds = body.permissionSetIds.filter((id) => !validIdSet.has(id));

        if (invalidIds.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid permission set IDs: ${invalidIds.join(', ')}`,
              validIds,
            },
            { status: 400 }
          );
        }

        const db = getAdminFirestore();

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
        const currentSetIds: string[] = Array.isArray(memberData?.permissionSetIds)
          ? memberData.permissionSetIds as string[]
          : [];

        // Compute diff
        const { added, removed } = computeArrayDiff(currentSetIds, body.permissionSetIds);

        // Prevent no-op
        if (added.length === 0 && removed.length === 0) {
          return NextResponse.json(
            { success: false, error: 'No changes detected — permission sets are identical' },
            { status: 409 }
          );
        }

        // Update Firestore member document
        await db.doc(memberPath).update({
          permissionSetIds: body.permissionSetIds,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: ctx.uid,
        });

        // Audit log for each added set
        if (added.length > 0) {
          await logPermissionGranted(ctx, targetUid, added, body.reason);
        }

        // Audit log for each removed set
        if (removed.length > 0) {
          await logPermissionRevoked(ctx, targetUid, removed, body.reason);
        }

        logger.info('Permission sets updated', {
          targetUid,
          added,
          removed,
          newSetIds: body.permissionSetIds,
          changedBy: ctx.uid,
          companyId: ctx.companyId,
        });

        return NextResponse.json({
          success: true,
          data: {
            uid: targetUid,
            permissionSetIds: body.permissionSetIds,
            added,
            removed,
          },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update permission sets');
        logger.error('Permission sets update failed', {
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
