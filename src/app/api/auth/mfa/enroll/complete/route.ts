/**
 * =============================================================================
 * AUTH: MFA ENROLLMENT CLAIM SYNC
 * =============================================================================
 *
 * Marks MFA enrollment as complete in custom claims after successful TOTP enroll.
 * This enables admin access gates that require mfaEnrolled=true.
 *
 * POST /api/auth/mfa/enroll/complete
 *
 * @module api/auth/mfa/enroll/complete
 * @enterprise Uses Admin SDK, SSoT collections, secure-by-default
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import type { UserRecord } from 'firebase-admin/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// ============================================================================
// TYPES
// ============================================================================

interface MfaEnrollCompleteRequest {
  idToken: string;
}

interface MfaEnrollCompleteResponse {
  success: boolean;
  message: string;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function hasTotpEnrollment(userRecord: UserRecord): boolean {
  const factors = userRecord.multiFactor?.enrolledFactors || [];
  return factors.length > 0;
}

// ============================================================================
// HANDLER
// ============================================================================

/**
 * @rateLimit SENSITIVE (20 req/min) - MFA enrollment completion
 */
async function handlePOST(request: NextRequest): Promise<NextResponse<MfaEnrollCompleteResponse>> {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

    const body: MfaEnrollCompleteRequest = await request.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request',
          error: 'idToken is required and must be a string',
        },
        { status: 400 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userRecord = await adminAuth.getUser(uid);
    if (!hasTotpEnrollment(userRecord)) {
      return NextResponse.json(
        {
          success: false,
          message: 'MFA not enrolled',
          error: 'No enrolled MFA factors found for this user',
        },
        { status: 409 }
      );
    }

    const existingClaims = userRecord.customClaims || {};
    const nextClaims = {
      ...existingClaims,
      mfaEnrolled: true,
    };

    await adminAuth.setCustomUserClaims(uid, nextClaims);

    // Sync to Firestore user doc (if present)
    try {
      const userRef = adminDb.collection(COLLECTIONS.USERS).doc(uid);
      await userRef.set(
        {
          mfaEnrolled: true,
          mfaEnrolledAt: AdminFieldValue.serverTimestamp(),
          updatedAt: AdminFieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (firestoreError) {
      console.warn('⚠️ [MFA] Failed to update Firestore user doc:', firestoreError);
    }

    return NextResponse.json({
      success: true,
      message: 'MFA enrollment synced',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to sync MFA enrollment',
        error: message,
      },
      { status: 401 }
    );
  }
}

export const POST = withSensitiveRateLimit(handlePOST);
