/**
 * =============================================================================
 * GET /api/admin/role-management/users — List All Company Users
 * =============================================================================
 *
 * Returns merged user data from three sources:
 * 1. Firestore: companies/{companyId}/members subcollection (role, status, permissionSetIds)
 * 2. Firestore: users/{uid} collection (profile data: email, displayName, photoURL)
 * 3. Firebase Auth: getUsers() (lastSignIn, disabled, mfaInfo)
 *
 * Auth: withAuth (super_admin, company_admin)
 * Rate: withSensitiveRateLimit
 *
 * @module api/admin/role-management/users
 * @enterprise ADR-244 Role Management Admin Console
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache, GlobalRole } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('RoleManagement:Users');

// =============================================================================
// TYPES
// =============================================================================

interface MemberDoc {
  uid: string;
  globalRole: GlobalRole;
  status: 'active' | 'suspended';
  joinedAt: FirebaseFirestore.Timestamp | null;
  permissionSetIds: string[];
  addedBy: string | null;
  updatedAt: FirebaseFirestore.Timestamp | null;
}

interface UserProfileDoc {
  email?: string;
  displayName?: string;
  photoURL?: string;
}

interface CompanyUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  globalRole: GlobalRole;
  status: 'active' | 'suspended';
  joinedAt: string | null;
  permissionSetIds: string[];
  lastSignIn: string | null;
  disabled: boolean;
  mfaEnrolled: boolean;
  companyId: string | null; // null for unassigned users
}

// =============================================================================
// GET — List All Company Users
// =============================================================================

export const GET = withSensitiveRateLimit(
  withAuth(
    async (
      _request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const db = getAdminFirestore();
        const auth = getAdminAuth();

        // 1. Fetch all members from companies/{companyId}/members
        const membersPath = `${COLLECTIONS.COMPANIES}/${ctx.companyId}/${SUBCOLLECTIONS.COMPANY_MEMBERS}`;
        const membersSnap = await db.collection(membersPath).get();

        const memberDocs: MemberDoc[] = membersSnap.empty ? [] : membersSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            uid: doc.id,
            globalRole: (d.globalRole as GlobalRole) ?? 'internal_user',
            status: (d.status as 'active' | 'suspended') ?? 'active',
            joinedAt: d.joinedAt ?? null,
            permissionSetIds: Array.isArray(d.permissionSetIds) ? d.permissionSetIds as string[] : [],
            addedBy: (d.addedBy as string) ?? null,
            updatedAt: d.updatedAt ?? null,
          };
        });

        const uids = memberDocs.map((m) => m.uid);

        // 2. Batch-fetch user profile docs from users/{uid}
        const profileMap = new Map<string, UserProfileDoc>();
        if (uids.length > 0) {
          const userRefs = uids.map((uid) => db.doc(`${COLLECTIONS.USERS}/${uid}`));
          const userSnapshots = await db.getAll(...userRefs);
          for (const snap of userSnapshots) {
            if (snap.exists) {
              const d = snap.data();
              profileMap.set(snap.id, {
                email: (d?.email as string) ?? undefined,
                displayName: (d?.displayName as string) ?? undefined,
                photoURL: (d?.photoURL as string) ?? undefined,
              });
            }
          }
        }

        // 3. Batch-fetch Firebase Auth user records for lastSignIn, disabled, mfaInfo
        const authMap = new Map<string, {
          lastSignIn: string | null;
          disabled: boolean;
          mfaEnrolled: boolean;
        }>();
        if (uids.length > 0) {
          const identifiers = uids.map((uid) => ({ uid }));
          const authResult = await auth.getUsers(identifiers);
          for (const userRecord of authResult.users) {
            authMap.set(userRecord.uid, {
              lastSignIn: userRecord.metadata.lastSignInTime ?? null,
              disabled: userRecord.disabled,
              mfaEnrolled: (userRecord.multiFactor?.enrolledFactors?.length ?? 0) > 0,
            });
          }
        }

        // 4. Merge all sources into CompanyUser[]
        const users: CompanyUser[] = memberDocs.map((member) => {
          const profile = profileMap.get(member.uid);
          const authInfo = authMap.get(member.uid);

          return {
            uid: member.uid,
            email: profile?.email ?? authInfo ? '' : '',
            displayName: profile?.displayName ?? null,
            photoURL: profile?.photoURL ?? null,
            globalRole: member.globalRole,
            status: member.status,
            joinedAt: member.joinedAt
              ? (member.joinedAt as FirebaseFirestore.Timestamp).toDate?.()?.toISOString() ?? null
              : null,
            permissionSetIds: member.permissionSetIds,
            lastSignIn: authInfo?.lastSignIn ?? null,
            disabled: authInfo?.disabled ?? false,
            mfaEnrolled: authInfo?.mfaEnrolled ?? false,
            companyId: ctx.companyId, // Already assigned to this company
          };
        });

        // Fix email: prefer profile email, fallback to Auth email
        for (const user of users) {
          const profile = profileMap.get(user.uid);
          const authRecord = authResult.users.find((u) => u.uid === user.uid);
          user.email = profile?.email ?? authRecord?.email ?? '';
        }

        // 5. Fetch unassigned users (companyId == null or missing) for admin to assign
        const unassignedSnap = await db
          .collection(COLLECTIONS.USERS)
          .where('companyId', '==', null)
          .limit(1000)
          .get();

        const unassignedUsers: CompanyUser[] = [];
        if (!unassignedSnap.empty) {
          const unassignedUids = unassignedSnap.docs.map((doc) => doc.id);
          const unassignedIdentifiers = unassignedUids.map((uid) => ({ uid }));

          // Batch-fetch Firebase Auth records
          const unassignedAuthResult = await auth.getUsers(unassignedIdentifiers);
          const unassignedAuthMap = new Map<string, {
            lastSignIn: string | null;
            disabled: boolean;
            mfaEnrolled: boolean;
          }>();
          for (const userRecord of unassignedAuthResult.users) {
            unassignedAuthMap.set(userRecord.uid, {
              lastSignIn: userRecord.metadata.lastSignInTime ?? null,
              disabled: userRecord.disabled,
              mfaEnrolled: (userRecord.multiFactor?.enrolledFactors?.length ?? 0) > 0,
            });
          }

          // Build unassigned users list
          for (const doc of unassignedSnap.docs) {
            const data = doc.data();
            const authInfo = unassignedAuthMap.get(doc.id);
            unassignedUsers.push({
              uid: doc.id,
              email: (data.email as string) ?? '',
              displayName: (data.displayName as string | null) ?? null,
              photoURL: (data.photoURL as string | null) ?? null,
              globalRole: (data.globalRole as GlobalRole) ?? 'external_user',
              status: (data.status as 'active' | 'suspended') ?? 'active',
              joinedAt: data.createdAt
                ? (data.createdAt as FirebaseFirestore.Timestamp).toDate?.()?.toISOString() ?? null
                : null,
              permissionSetIds: Array.isArray(data.permissionSetIds) ? (data.permissionSetIds as string[]) : [],
              lastSignIn: authInfo?.lastSignIn ?? null,
              disabled: authInfo?.disabled ?? false,
              mfaEnrolled: authInfo?.mfaEnrolled ?? false,
              companyId: null, // Unassigned
            });
          }
        }

        await logAuditEvent(ctx, 'data_accessed', ctx.companyId, 'user', {
          metadata: { reason: `Listed ${users.length} company users + ${unassignedUsers.length} unassigned` },
        });

        logger.info('Company users listed', {
          companyId: ctx.companyId,
          assignedCount: users.length,
          unassignedCount: unassignedUsers.length,
        });

        // Combine assigned + unassigned users
        const allUsers = [
          ...users.map((u) => ({
            ...u,
            projectCount: 0,
            projectMemberships: [] as any[], // Phase A: not fetched
          })),
          ...unassignedUsers.map((u) => ({
            ...u,
            projectCount: 0,
            projectMemberships: [] as any[],
          })),
        ];

        return NextResponse.json({
          success: true,
          data: {
            users: allUsers,
            total: allUsers.length,
            assigned: users.length,
            unassigned: unassignedUsers.length,
          },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list company users');
        logger.error('Failed to list company users', { error: message, companyId: ctx.companyId });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
    { requiredGlobalRoles: ['super_admin', 'company_admin'] }
  )
);
