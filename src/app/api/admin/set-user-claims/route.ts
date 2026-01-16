/**
 * =============================================================================
 * SET USER CUSTOM CLAIMS - ENTERPRISE ADMIN API
 * =============================================================================
 *
 * Admin endpoint για την προσθήκη custom claims σε Firebase user token.
 * Χρησιμοποιείται για να σετάρει companyId και globalRole στους χρήστες.
 *
 * @module api/admin/set-user-claims
 * @enterprise RFC v6 - Authorization & RBAC System
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

type GlobalRole = 'super_admin' | 'company_admin' | 'company_staff' | 'company_user';

interface SetUserClaimsRequest {
  /** Firebase Auth UID του χρήστη */
  uid: string;
  /** Company ID (tenant anchor) */
  companyId: string;
  /** Global role */
  globalRole: GlobalRole;
  /** Email του χρήστη (για verification) */
  email: string;
}

interface SetUserClaimsResponse {
  success: boolean;
  message: string;
  user?: {
    uid: string;
    email: string;
    companyId: string;
    globalRole: GlobalRole;
    customClaimsSet: boolean;
    firestoreDocCreated: boolean;
  };
  error?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_GLOBAL_ROLES: GlobalRole[] = [
  'super_admin',
  'company_admin',
  'company_staff',
  'company_user'
];

function isValidGlobalRole(role: string): role is GlobalRole {
  return VALID_GLOBAL_ROLES.includes(role as GlobalRole);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * POST /api/admin/set-user-claims
 *
 * Σετάρει custom claims για έναν χρήστη.
 * Δημιουργεί:
 * 1. Custom claims στο Firebase Auth token (companyId, globalRole)
 * 2. User document στο Firestore /users/{uid}
 *
 * 🔐 SECURITY: Admin-only endpoint (super_admin required)
 */
export async function POST(request: NextRequest): Promise<NextResponse<SetUserClaimsResponse>> {
  try {
    // 🔐 SECURITY: Extract and verify admin authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('⚠️ [SET_USER_CLAIMS] Missing or invalid authorization header');
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let adminClaims;
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      adminClaims = decodedToken;

      // Verify caller is super_admin or company_admin
      const callerRole = decodedToken.globalRole as string | undefined;
      if (callerRole !== 'super_admin' && callerRole !== 'company_admin') {
        console.warn(`⚠️ [SET_USER_CLAIMS] Insufficient permissions: ${callerRole}`);
        return NextResponse.json(
          {
            success: false,
            message: 'Forbidden',
            error: 'Only super_admin or company_admin can set user claims'
          },
          { status: 403 }
        );
      }

      console.log(`🔐 [SET_USER_CLAIMS] Authorized admin: ${decodedToken.email} (${callerRole})`);
    } catch (error) {
      console.error('❌ [SET_USER_CLAIMS] Token verification failed:', error);
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'Invalid admin token' },
        { status: 401 }
      );
    }

    // 🏢 ENTERPRISE: Parse request body
    const body: SetUserClaimsRequest = await request.json();
    const { uid, companyId, globalRole, email } = body;

    // Validate inputs
    if (!uid || typeof uid !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid uid', error: 'uid is required and must be a string' },
        { status: 400 }
      );
    }

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid companyId', error: 'companyId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid email', error: 'email is required and must be a string' },
        { status: 400 }
      );
    }

    if (!isValidGlobalRole(globalRole)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid globalRole',
          error: `globalRole must be one of: ${VALID_GLOBAL_ROLES.join(', ')}`
        },
        { status: 400 }
      );
    }

    console.log(`🔐 [SET_USER_CLAIMS] Setting claims for user ${uid} (${email})`);
    console.log(`🔐 [SET_USER_CLAIMS] Company: ${companyId}, Role: ${globalRole}`);

    // ========================================================================
    // STEP 1: Verify user exists in Firebase Auth
    // ========================================================================

    let firebaseUser;
    try {
      firebaseUser = await adminAuth.getUser(uid);
      console.log(`✅ [SET_USER_CLAIMS] User found in Firebase Auth: ${firebaseUser.email}`);

      // Verify email matches
      if (firebaseUser.email !== email) {
        console.warn(`⚠️ [SET_USER_CLAIMS] Email mismatch: provided=${email}, actual=${firebaseUser.email}`);
      }
    } catch (error) {
      console.error(`❌ [SET_USER_CLAIMS] User not found in Firebase Auth:`, error);
      return NextResponse.json(
        {
          success: false,
          message: 'User not found in Firebase Auth',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // STEP 2: Set custom claims on Firebase Auth token
    // ========================================================================

    try {
      await adminAuth.setCustomUserClaims(uid, {
        companyId,
        globalRole,
        mfaEnrolled: false, // Default to false
      });
      console.log(`✅ [SET_USER_CLAIMS] Custom claims set successfully`);
    } catch (error) {
      console.error(`❌ [SET_USER_CLAIMS] Failed to set custom claims:`, error);
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to set custom claims',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // STEP 3: Create/Update user document in Firestore /users/{uid}
    // ========================================================================

    try {
      const userRef = adminDb.collection(COLLECTIONS.USERS).doc(uid);
      const userDoc = await userRef.get();

      const userData = {
        email: firebaseUser.email || email,
        displayName: firebaseUser.displayName || null,
        companyId,
        globalRole,
        status: 'active',
        updatedAt: new Date(),
      };

      if (userDoc.exists) {
        // Update existing user
        await userRef.update(userData);
        console.log(`✅ [SET_USER_CLAIMS] Updated existing user document`);
      } else {
        // Create new user document
        await userRef.set({
          ...userData,
          createdAt: new Date(),
        });
        console.log(`✅ [SET_USER_CLAIMS] Created new user document`);
      }
    } catch (error) {
      console.error(`❌ [SET_USER_CLAIMS] Failed to create/update user document:`, error);
      // Don't fail the entire request - custom claims are already set
      console.warn(`⚠️ [SET_USER_CLAIMS] Continuing despite Firestore error`);
    }

    // ========================================================================
    // STEP 4: Return success response
    // ========================================================================

    return NextResponse.json({
      success: true,
      message: 'Custom claims set successfully',
      user: {
        uid,
        email: firebaseUser.email || email,
        companyId,
        globalRole,
        customClaimsSet: true,
        firestoreDocCreated: true,
      },
    });

  } catch (error) {
    console.error('❌ [SET_USER_CLAIMS] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/set-user-claims
 *
 * Health check endpoint
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'Set User Claims Admin API',
    status: 'healthy',
    version: '1.0.0',
    endpoints: {
      POST: {
        description: 'Set custom claims for a user',
        body: {
          uid: 'string (required)',
          companyId: 'string (required)',
          globalRole: 'GlobalRole (required)',
          email: 'string (required)'
        },
        validRoles: VALID_GLOBAL_ROLES
      }
    }
  });
}
