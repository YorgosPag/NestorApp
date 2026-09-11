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
import { withAuth, logAuditEvent, isValidGlobalRole } from '@/lib/auth';
import type { AuthContext, PermissionCache, GlobalRole } from '@/lib/auth';
// 🎫 ADR-787 Κ-2 — η ΜΙΑ μετάφραση του εγγράφου μέλους χώρου.
import { normalizeMembership } from '@/lib/auth/workspace-membership';
// 🎫 ADR-660 §6 — τα αιτήματα ένταξης είναι οντότητα, με tenant scope.
import { listPendingAccessRequests } from '@/server/auth/workspace-access-request';
import type { WorkspaceMembership } from '@/types/workspace-membership';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('RoleManagement:Users');

// =============================================================================
// TYPES
// =============================================================================

// 🔴 Ο τοπικός `MemberDoc` ΔΙΑΓΡΑΦΗΚΕ (ADR-787 §5.1 γ, 2026-08-22).
//
// Ήταν το **δεύτερο** `MemberDoc` του δέντρου: αδελφό αρχείο
// (`../project-members/types.ts`) όριζε **άλλο** `MemberDoc`, με **άλλα πεδία**,
// για **άλλη συλλογή**. Ίδιο όνομα, δύο έγγραφα — και το Κ-2 θα γεννούσε τρίτο.
//
// ⚠️ Δεν ήταν μόνο το όνομα: εδώ ζούσε και **δεύτερη ΜΕΤΑΦΡΑΣΗ** του ίδιου
//    εγγράφου, με **αντίθετη** προεπιλογή — `status ?? 'active'`, δηλαδή ένα
//    χαλασμένο ή άγνωστο `status` γινόταν σιωπηλά **ενεργό μέλος**. Η μία
//    μετάφραση ζει πλέον στο `normalizeMembership` και είναι **fail-closed**.
//    ⛔ ΜΗΝ ξαναγράψεις τοπική μετάφραση αυτού του εγγράφου (ADR-749).

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
  status: 'active' | 'suspended' | 'pending';
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
        const membersPath = `${COLLECTIONS.COMPANIES}/${ctx.companyId}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`;
        const membersSnap = await db.collection(membersPath).get();

        const memberDocs: WorkspaceMembership[] = membersSnap.empty
          ? []
          : membersSnap.docs.map((doc) => normalizeMembership(doc.id, doc.data()));

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

        // 3. Batch-fetch Firebase Auth user records for lastSignIn, disabled, mfaInfo, email
        const authMap = new Map<string, {
          email: string | null;
          lastSignIn: string | null;
          disabled: boolean;
          mfaEnrolled: boolean;
        }>();
        if (uids.length > 0) {
          const identifiers = uids.map((uid) => ({ uid }));
          const authResult = await auth.getUsers(identifiers);
          for (const userRecord of authResult.users) {
            authMap.set(userRecord.uid, {
              email: userRecord.email ?? null,
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
            email: profile?.email ?? authInfo?.email ?? '',
            displayName: profile?.displayName ?? null,
            photoURL: profile?.photoURL ?? null,
            // ⚠️ Το `globalRole` του εγγράφου είναι **συμβολοσειρά από τη βάση**,
            //    όχι εγγυημένος ρόλος: στενεύει **εδώ, στο σύνορο**, με ρητό
            //    έλεγχο. Ένα `as GlobalRole` θα ήταν ισχυρισμός, όχι απόδειξη.
            globalRole: isValidGlobalRole(member.globalRole) ? member.globalRole : 'internal_user',
            status: member.status,
            joinedAt: member.joinedAt
              ? (member.joinedAt as FirebaseFirestore.Timestamp).toDate?.()?.toISOString() ?? null
              : null,
            permissionSetIds: [...member.permissionSetIds],
            lastSignIn: authInfo?.lastSignIn ?? null,
            disabled: authInfo?.disabled ?? false,
            mfaEnrolled: authInfo?.mfaEnrolled ?? false,
            companyId: ctx.companyId,
          };
        });

        // 5. ADR-660 §6 — τα ΕΚΚΡΕΜΗ ΑΙΤΗΜΑΤΑ ΕΝΤΑΞΗΣ **αυτού** του χώρου.
        //
        // 🔴 Ήταν `users where companyId == null` **ΧΩΡΙΣ tenant scope**: κάθε διαχειριστής
        //    έβλεπε **κάθε** χρήστη χωρίς οργανισμό της πλατφόρμας — και πολίτες που
        //    πλησίασαν **άλλες** εταιρείες (ADR-844). Και **έχανε** όποιον αιτούντα απέδειξε
        //    το email του, επειδή η ταυτότητά του έγινε `citizen` (ADR-844 §13.6 #2).
        //    Το αίτημα είναι πλέον **οντότητα** με δικό της κύκλο ζωής — αυτό ρωτάμε.
        // ⚠️ Συνθετικές ταυτότητες (ADR-822) δεν ανοίγουν ποτέ αίτημα: το ανοίγει μόνο το
        //    `POST /api/auth/session`, δηλαδή **πραγματική** σύνδεση Firebase Auth.
        const pendingRequests = await listPendingAccessRequests(ctx.companyId);
        const unassignedUsers: CompanyUser[] = [];
        if (pendingRequests.length > 0) {
          const authResult = await auth.getUsers(pendingRequests.map((request) => ({ uid: request.requesterUid })));
          const authRecords = new Map(authResult.users.map((record) => [record.uid, record]));

          for (const request of pendingRequests) {
            const record = authRecords.get(request.requesterUid);
            unassignedUsers.push({
              uid: request.requesterUid,
              email: record?.email ?? request.requesterEmail,
              displayName: record?.displayName ?? request.requesterName,
              photoURL: record?.photoURL ?? null,
              globalRole: 'external_user',
              status: 'pending',
              joinedAt: request.requestedAt,
              permissionSetIds: [],
              lastSignIn: record?.metadata.lastSignInTime ?? null,
              disabled: record?.disabled ?? false,
              mfaEnrolled: (record?.multiFactor?.enrolledFactors?.length ?? 0) > 0,
              companyId: null,
            });
          }
        }

        // ADR-438: dedupable — idempotent listing. Το πάνελ διαχείρισης ρόλων ξαναζητά
        // την ίδια λίστα σε κάθε mount/refresh· «ο X είδε τη λίστα χρηστών» καταγράφεται
        // μία φορά ανά 5λεπτο παράθυρο. Οι ΑΛΛΑΓΕΣ ρόλων είναι security tier, αδιπλασίαστες.
        await logAuditEvent(ctx, 'data_accessed', ctx.companyId, 'user', {
          dedupable: true,
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
