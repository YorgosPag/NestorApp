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
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

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
// MAIN HANDLER
// ============================================================================

/**
 * POST /api/admin/ensure-user-profile
 *
 * Creates a user profile document if it doesn't exist.
 * Uses Admin SDK to bypass Firestore rules.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
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

      console.log(`[ENTERPRISE] [ensure-user-profile] Updated profile for: ${body.uid}`);

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

    console.log(`[ENTERPRISE] [ensure-user-profile] Created profile for: ${body.uid}`);

    return NextResponse.json({
      success: true,
      message: `User profile created for ${body.uid}`,
      created: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ensure-user-profile] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
