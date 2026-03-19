/**
 * =============================================================================
 * GET/POST /api/admin/role-management/project-members — Manage Project Members
 * =============================================================================
 *
 * GET: List members of a specific project (enriched with user profile data).
 * POST: Assign, update, or remove a project member.
 *
 * Auth: GET = super_admin | company_admin, POST = super_admin only
 * Rate: withSensitiveRateLimit
 *
 * @module api/admin/role-management/project-members
 * @enterprise ADR-244 Phase B — Project Members
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('RoleManagement:ProjectMembers');

// =============================================================================
// TYPES
// =============================================================================

interface MemberDoc {
  companyId: string;
  projectId: string;
  roleId: string;
  permissionSetIds: string[];
  effectivePermissions: string[];
  addedAt: FirebaseFirestore.Timestamp | null;
  addedBy: string;
}

interface UserProfileDoc {
  email?: string;
  displayName?: string;
  photoURL?: string;
}

// =============================================================================
// ZOD-LIKE VALIDATION (no extra deps)
// =============================================================================

interface PostBody {
  action: 'assign' | 'update' | 'remove';
  projectId: string;
  uid: string;
  roleId?: string;
  permissionSetIds?: string[];
  reason: string;
}

function validatePostBody(body: unknown): PostBody | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const action = b.action;
  if (action !== 'assign' && action !== 'update' && action !== 'remove') return null;

  const projectId = b.projectId;
  if (typeof projectId !== 'string' || projectId.length < 1) return null;

  const uid = b.uid;
  if (typeof uid !== 'string' || uid.length < 1) return null;

  const reason = b.reason;
  if (typeof reason !== 'string' || reason.length < 10) return null;

  const roleId = typeof b.roleId === 'string' ? b.roleId : undefined;
  const permissionSetIds = Array.isArray(b.permissionSetIds)
    ? (b.permissionSetIds as unknown[]).filter((id): id is string => typeof id === 'string')
    : undefined;

  return { action, projectId, uid, reason, roleId, permissionSetIds };
}

// =============================================================================
// GET — List Project Members
// =============================================================================

export const GET = withSensitiveRateLimit(
  withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const db = getAdminFirestore();
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
          return NextResponse.json(
            { success: false, error: 'projectId is required' },
            { status: 400 }
          );
        }

        // Verify project belongs to this company
        const projectDoc = await db
          .collection(COLLECTIONS.COMPANIES)
          .doc(ctx.companyId)
          .collection(SUBCOLLECTIONS.COMPANY_PROJECTS)
          .doc(projectId)
          .get();

        if (!projectDoc.exists) {
          // Fallback: check top-level projects collection with companyId filter
          const topLevelDoc = await db
            .collection(COLLECTIONS.PROJECTS)
            .doc(projectId)
            .get();

          if (!topLevelDoc.exists || topLevelDoc.data()?.companyId !== ctx.companyId) {
            return NextResponse.json(
              { success: false, error: 'Project not found or access denied' },
              { status: 404 }
            );
          }
        }

        // Fetch members subcollection
        const membersSnap = await db
          .collection(COLLECTIONS.COMPANIES)
          .doc(ctx.companyId)
          .collection(SUBCOLLECTIONS.COMPANY_PROJECTS)
          .doc(projectId)
          .collection(SUBCOLLECTIONS.PROJECT_MEMBERS)
          .get();

        if (membersSnap.empty) {
          return NextResponse.json({
            success: true,
            data: { members: [], total: 0 },
          });
        }

        // Collect UIDs for enrichment
        const memberDocs = membersSnap.docs.map((doc) => ({
          uid: doc.id,
          ...(doc.data() as MemberDoc),
        }));

        const uids = memberDocs.map((m) => m.uid);

        // Batch-fetch user profiles (max 30 per IN query)
        const userProfiles = new Map<string, UserProfileDoc>();
        for (let i = 0; i < uids.length; i += 30) {
          const batch = uids.slice(i, i + 30);
          const usersSnap = await db
            .collection(COLLECTIONS.USERS)
            .where('__name__', 'in', batch)
            .select('email', 'displayName', 'photoURL')
            .get();
          for (const userDoc of usersSnap.docs) {
            userProfiles.set(userDoc.id, userDoc.data() as UserProfileDoc);
          }
        }

        const members = memberDocs.map((m) => {
          const profile = userProfiles.get(m.uid);
          return {
            uid: m.uid,
            email: profile?.email ?? '',
            displayName: profile?.displayName ?? null,
            roleId: m.roleId ?? '',
            permissionSetIds: m.permissionSetIds ?? [],
            addedAt: m.addedAt?.toDate?.()?.toISOString() ?? null,
            addedBy: m.addedBy ?? null,
          };
        });

        return NextResponse.json({
          success: true,
          data: { members, total: members.length },
        });
      } catch (error) {
        logger.error('[ProjectMembers] Failed to fetch members:', { error });
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 500 }
        );
      }
    },
    { requiredGlobalRoles: ['super_admin', 'company_admin'] }
  )
);

// =============================================================================
// POST — Assign / Update / Remove Project Member
// =============================================================================

export const POST = withSensitiveRateLimit(
  withAuth(
    async (
      request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const body = await request.json();
        const validated = validatePostBody(body);

        if (!validated) {
          return NextResponse.json(
            { success: false, error: 'Invalid request body. Required: action, projectId, uid, reason (min 10 chars).' },
            { status: 400 }
          );
        }

        const { action, projectId, uid, roleId, permissionSetIds, reason } = validated;
        const db = getAdminFirestore();

        const memberRef = db
          .collection(COLLECTIONS.COMPANIES)
          .doc(ctx.companyId)
          .collection(SUBCOLLECTIONS.COMPANY_PROJECTS)
          .doc(projectId)
          .collection(SUBCOLLECTIONS.PROJECT_MEMBERS)
          .doc(uid);

        switch (action) {
          case 'assign': {
            if (!roleId) {
              return NextResponse.json(
                { success: false, error: 'roleId is required for assign action' },
                { status: 400 }
              );
            }

            const existing = await memberRef.get();
            if (existing.exists) {
              return NextResponse.json(
                { success: false, error: 'User is already a member of this project' },
                { status: 409 }
              );
            }

            await memberRef.set({
              companyId: ctx.companyId,
              projectId,
              roleId,
              permissionSetIds: permissionSetIds ?? [],
              effectivePermissions: [],
              addedAt: FieldValue.serverTimestamp(),
              addedBy: ctx.uid,
            });

            await logAuditEvent(ctx, 'member_added', uid, 'user', {
              newValue: {
                type: 'project_member',
                value: { projectId, roleId, permissionSetIds: permissionSetIds ?? [] },
              },
              metadata: { reason },
            });

            return NextResponse.json({
              success: true,
              data: { action: 'assign', projectId, uid },
            });
          }

          case 'update': {
            const existing = await memberRef.get();
            if (!existing.exists) {
              return NextResponse.json(
                { success: false, error: 'User is not a member of this project' },
                { status: 404 }
              );
            }

            const prevData = existing.data() as MemberDoc;
            const updates: Record<string, unknown> = {};
            if (roleId !== undefined) updates.roleId = roleId;
            if (permissionSetIds !== undefined) updates.permissionSetIds = permissionSetIds;

            if (Object.keys(updates).length === 0) {
              return NextResponse.json(
                { success: false, error: 'No fields to update' },
                { status: 400 }
              );
            }

            await memberRef.update(updates);

            await logAuditEvent(ctx, 'member_updated', uid, 'user', {
              previousValue: {
                type: 'project_member',
                value: { projectId, roleId: prevData.roleId, permissionSetIds: prevData.permissionSetIds },
              },
              newValue: {
                type: 'project_member',
                value: { projectId, ...updates },
              },
              metadata: { reason },
            });

            return NextResponse.json({
              success: true,
              data: { action: 'update', projectId, uid },
            });
          }

          case 'remove': {
            const existing = await memberRef.get();
            if (!existing.exists) {
              return NextResponse.json(
                { success: false, error: 'User is not a member of this project' },
                { status: 404 }
              );
            }

            const prevData = existing.data() as MemberDoc;
            await memberRef.delete();

            await logAuditEvent(ctx, 'member_removed', uid, 'user', {
              previousValue: {
                type: 'project_member',
                value: { projectId, roleId: prevData.roleId, permissionSetIds: prevData.permissionSetIds },
              },
              metadata: { reason },
            });

            return NextResponse.json({
              success: true,
              data: { action: 'remove', projectId, uid },
            });
          }

          default:
            return NextResponse.json(
              { success: false, error: 'Invalid action' },
              { status: 400 }
            );
        }
      } catch (error) {
        logger.error('[ProjectMembers] Failed to mutate member:', { error });
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 500 }
        );
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  )
);
