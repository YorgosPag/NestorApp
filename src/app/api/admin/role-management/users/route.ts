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

        if (membersSnap.empty) {
          return NextResponse.json({ success: true, data: [], count: 0 });
        }

        const memberDocs: MemberDoc[] = membersSnap.docs.map((doc) => {
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
        const userRefs = uids.map((uid) => db.doc(`${COLLECTIONS.USERS}/${uid}`));
        const userSnapshots = await db.getAll(...userRefs);
        const profileMap = new Map<string, UserProfileDoc>();
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

        // 3. Batch-fetch Firebase Auth user records for lastSignIn, disabled, mfaInfo
        const identifiers = uids.map((uid) => ({ uid }));
        const authResult = await auth.getUsers(identifiers);
        const authMap = new Map<string, {
          lastSignIn: string | null;
          disabled: boolean;
          mfaEnrolled: boolean;
        }>();
        for (const userRecord of authResult.users) {
          authMap.set(userRecord.uid, {
            lastSignIn: userRecord.metadata.lastSignInTime ?? null,
            disabled: userRecord.disabled,
            mfaEnrolled: (userRecord.multiFactor?.enrolledFactors?.length ?? 0) > 0,
          });
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
          };
        });

        // Fix email: prefer profile email, fallback to Auth email
        for (const user of users) {
          const profile = profileMap.get(user.uid);
          const authRecord = authResult.users.find((u) => u.uid === user.uid);
          user.email = profile?.email ?? authRecord?.email ?? '';
        }

        await logAuditEvent(ctx, 'data_accessed', ctx.companyId, 'user', {
          metadata: { reason: `Listed ${users.length} company users` },
        });

        logger.info('Company users listed', { companyId: ctx.companyId, count: users.length });

        return NextResponse.json({
          success: true,
          data: {
            users: users.map((u) => ({
              ...u,
              // Phase A: project memberships not fetched (expensive query)
              projectCount: 0,
              projectMemberships: [],
            })),
            total: users.length,
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
