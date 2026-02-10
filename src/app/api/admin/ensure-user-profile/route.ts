/**
 * =============================================================================
 * ENSURE USER PROFILE - SERVER-SIDE USER DOCUMENT CREATION (ADR-100)
 * =============================================================================
 *
 * Creates or updates Firestore /users/{uid} documents using Admin SDK.
 * Admin SDK bypasses Firestore security rules (required for dev-admin bypass).
 *
 * Used by:
 * - ensureDevUserProfile() in AuthContext.tsx (dev mode)
 * - Can also be used for one-time profile migrations
 *
 * @module api/admin/ensure-user-profile
 * @see ADR-100: JIT User Profile Sync
 * @security ADR-172: Added withAuth + withSensitiveRateLimit (was unprotected)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// ============================================================================
// TYPES
// ============================================================================

interface EnsureUserProfileRequest {
  uid: string;
  email: string;
  displayName: string | null;
  givenName?: string | null;
  familyName?: string | null;
  photoURL?: string | null;
  companyId?: string | null;
  globalRole?: string | null;
  authProvider?: string;
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /api/admin/ensure-user-profile?uid=xxx
 *
 * Reads a user profile document. Used for diagnostics.
 * Requires super_admin or company_admin role.
 */
export const GET = withSensitiveRateLimit(
  withAuth<unknown>(
    async (request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => {
      const uid = request.nextUrl.searchParams.get('uid');
      if (!uid) {
        return NextResponse.json({ success: false, error: 'uid query param required' }, { status: 400 });
      }

      const adminDb = getAdminFirestore();
      const userSnapshot = await adminDb.collection(COLLECTIONS.USERS).doc(uid).get();

      if (!userSnapshot.exists) {
        return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: userSnapshot.data() });
    },
    { requiredGlobalRoles: ['super_admin', 'company_admin'] }
  )
);

/**
 * POST /api/admin/ensure-user-profile
 *
 * Creates a user profile document if it doesn't exist.
 * Uses Admin SDK to bypass Firestore rules.
 * Requires super_admin or company_admin role.
 */
export const POST = withSensitiveRateLimit(
  withAuth<unknown>(
    async (request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => {
      const body = await request.json() as EnsureUserProfileRequest;

      if (!body.uid || !body.email) {
        return NextResponse.json(
          { success: false, error: 'uid and email are required' },
          { status: 400 }
        );
      }

      const adminDb = getAdminFirestore();
      const userDocRef = adminDb.collection(COLLECTIONS.USERS).doc(body.uid);
      const userSnapshot = await userDocRef.get();

      const now = new Date();

      if (userSnapshot.exists) {
        // UPDATE: Merge missing fields (e.g., displayName) into existing document
        await userDocRef.set({
          displayName: body.displayName ?? null,
          givenName: body.givenName ?? null,
          familyName: body.familyName ?? null,
          email: body.email,
          globalRole: body.globalRole ?? null,
          updatedAt: now,
        }, { merge: true });

        return NextResponse.json({
          success: true,
          message: `User profile updated for ${body.uid}`,
          created: false,
        });
      }

      // CREATE: Full profile with defaults
      await userDocRef.set({
        uid: body.uid,
        email: body.email,
        displayName: body.displayName ?? null,
        givenName: body.givenName ?? null,
        familyName: body.familyName ?? null,
        photoURL: body.photoURL ?? null,
        companyId: body.companyId ?? null,
        globalRole: body.globalRole ?? null,
        status: 'active',
        emailVerified: true,
        loginCount: 0,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        authProvider: body.authProvider ?? 'unknown',
      });

      return NextResponse.json({
        success: true,
        message: `User profile created for ${body.uid}`,
        created: true,
      });
    },
    { requiredGlobalRoles: ['super_admin', 'company_admin'] }
  )
);
