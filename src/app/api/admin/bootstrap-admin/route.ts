/**
 * =============================================================================
 * BOOTSTRAP ADMIN USER - ONE-TIME SETUP
 * =============================================================================
 *
 * Bootstrap endpoint για την δημιουργία του πρώτου admin user με custom claims.
 * Χρησιμοποιείται μόνο στην αρχή για να κάνουμε το πρώτο setup.
 *
 * 🔐 SECURITY:
 * - Απαιτεί BOOTSTRAP_ADMIN_SECRET στο request header
 * - Λειτουργεί μόνο σε development mode (NODE_ENV !== 'production')
 * - Δεν απαιτεί Firebase authentication (chicken-and-egg problem)
 *
 * @module api/admin/bootstrap-admin
 * @enterprise RFC v6 - Authorization & RBAC System
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

type GlobalRole = 'super_admin' | 'company_admin' | 'company_staff' | 'company_user';

interface BootstrapAdminRequest {
  /** Firebase Auth UID ή email του χρήστη */
  userIdentifier: string;
  /** Company ID (tenant anchor) */
  companyId: string;
  /** Global role (default: super_admin) */
  globalRole?: GlobalRole;
  /** Bootstrap secret (required) */
  bootstrapSecret: string;
}

interface BootstrapAdminResponse {
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
  warning?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_GLOBAL_ROLES: GlobalRole[] = [
  'super_admin',
  'company_admin',
  'company_staff',
  'company_user'
];

// 🔐 BOOTSTRAP SECRET - Set this in your environment
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_ADMIN_SECRET || 'change-me-in-production';

// ============================================================================
// VALIDATION
// ============================================================================

function isValidGlobalRole(role: string): role is GlobalRole {
  return VALID_GLOBAL_ROLES.includes(role as GlobalRole);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * POST /api/admin/bootstrap-admin
 *
 * Bootstrap το πρώτο admin user με custom claims.
 *
 * 🔐 SECURITY:
 * - Development only (NODE_ENV !== 'production')
 * - Requires BOOTSTRAP_ADMIN_SECRET
 * - No Firebase authentication required (bootstrap scenario)
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/admin/bootstrap-admin', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     userIdentifier: 'pagonis.oe@gmail.com',
 *     companyId: 'pagonis-company',
 *     globalRole: 'super_admin',
 *     bootstrapSecret: 'your-secret-here'
 *   })
 * });
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse<BootstrapAdminResponse>> {
  try {
    // 🔐 SECURITY: Only allow in development/staging
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ [BOOTSTRAP_ADMIN] Attempt to use bootstrap endpoint in production');
      return NextResponse.json(
        {
          success: false,
          message: 'Bootstrap endpoint disabled in production',
          error: 'Use set-user-claims endpoint with proper authentication instead'
        },
        { status: 403 }
      );
    }

    // 🏢 ENTERPRISE: Parse request body
    const body: BootstrapAdminRequest = await request.json();
    const { userIdentifier, companyId, globalRole = 'super_admin', bootstrapSecret } = body;

    // Validate inputs
    if (!userIdentifier || typeof userIdentifier !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid userIdentifier',
          error: 'userIdentifier is required and must be a string (email or UID)'
        },
        { status: 400 }
      );
    }

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid companyId', error: 'companyId is required' },
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

    // 🔐 SECURITY: Verify bootstrap secret
    if (bootstrapSecret !== BOOTSTRAP_SECRET) {
      console.warn('⚠️ [BOOTSTRAP_ADMIN] Invalid bootstrap secret');
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
          error: 'Invalid bootstrap secret. Set BOOTSTRAP_ADMIN_SECRET in environment.'
        },
        { status: 401 }
      );
    }

    console.log(`🔐 [BOOTSTRAP_ADMIN] Bootstrapping admin user: ${userIdentifier}`);
    console.log(`🔐 [BOOTSTRAP_ADMIN] Company: ${companyId}, Role: ${globalRole}`);

    // ========================================================================
    // STEP 1: Find user in Firebase Auth (by email or UID)
    // ========================================================================

    let firebaseUser;
    try {
      // Try as UID first
      if (userIdentifier.length > 20) {
        firebaseUser = await adminAuth.getUser(userIdentifier);
      } else {
        // Try as email
        firebaseUser = await adminAuth.getUserByEmail(userIdentifier);
      }
      console.log(`✅ [BOOTSTRAP_ADMIN] User found: ${firebaseUser.email} (${firebaseUser.uid})`);
    } catch (error) {
      console.error(`❌ [BOOTSTRAP_ADMIN] User not found:`, error);
      return NextResponse.json(
        {
          success: false,
          message: 'User not found in Firebase Auth',
          error: `No user found with identifier: ${userIdentifier}`
        },
        { status: 404 }
      );
    }

    const uid = firebaseUser.uid;
    const email = firebaseUser.email || userIdentifier;

    // ========================================================================
    // STEP 2: Set custom claims on Firebase Auth token
    // ========================================================================

    try {
      await adminAuth.setCustomUserClaims(uid, {
        companyId,
        globalRole,
        mfaEnrolled: false,
      });
      console.log(`✅ [BOOTSTRAP_ADMIN] Custom claims set successfully`);
    } catch (error) {
      console.error(`❌ [BOOTSTRAP_ADMIN] Failed to set custom claims:`, error);
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

    let firestoreDocCreated = false;
    try {
      const userRef = adminDb.collection(COLLECTIONS.USERS).doc(uid);
      const userDoc = await userRef.get();

      const userData = {
        email,
        displayName: firebaseUser.displayName || null,
        companyId,
        globalRole,
        status: 'active',
        updatedAt: new Date(),
      };

      if (userDoc.exists) {
        await userRef.update(userData);
        console.log(`✅ [BOOTSTRAP_ADMIN] Updated existing user document`);
      } else {
        await userRef.set({
          ...userData,
          createdAt: new Date(),
        });
        console.log(`✅ [BOOTSTRAP_ADMIN] Created new user document`);
        firestoreDocCreated = true;
      }
    } catch (error) {
      console.error(`❌ [BOOTSTRAP_ADMIN] Failed to create/update user document:`, error);
      return NextResponse.json(
        {
          success: false,
          message: 'Custom claims set but Firestore doc failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          warning: 'User can authenticate but may have issues with permissions'
        },
        { status: 207 } // 207 Multi-Status (partial success)
      );
    }

    // ========================================================================
    // STEP 4: Return success response
    // ========================================================================

    return NextResponse.json({
      success: true,
      message: 'Admin user bootstrapped successfully',
      user: {
        uid,
        email,
        companyId,
        globalRole,
        customClaimsSet: true,
        firestoreDocCreated,
      },
    });

  } catch (error) {
    console.error('❌ [BOOTSTRAP_ADMIN] Unexpected error:', error);
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
 * GET /api/admin/bootstrap-admin
 *
 * Health check endpoint
 */
export async function GET(): Promise<NextResponse> {
  const isProduction = process.env.NODE_ENV === 'production';

  return NextResponse.json({
    service: 'Bootstrap Admin User API',
    status: isProduction ? 'disabled' : 'healthy',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    notice: isProduction
      ? 'Bootstrap endpoint is disabled in production for security'
      : 'Bootstrap endpoint is active in development',
    endpoints: {
      POST: {
        description: 'Bootstrap first admin user with custom claims',
        security: 'Requires BOOTSTRAP_ADMIN_SECRET in request body',
        environment: 'Development/Staging only',
        body: {
          userIdentifier: 'string (email or UID)',
          companyId: 'string (required)',
          globalRole: `GlobalRole (default: super_admin) - one of: ${VALID_GLOBAL_ROLES.join(', ')}`,
          bootstrapSecret: 'string (required - set BOOTSTRAP_ADMIN_SECRET env var)'
        }
      }
    },
    bootstrapSecretConfigured: !!process.env.BOOTSTRAP_ADMIN_SECRET && process.env.BOOTSTRAP_ADMIN_SECRET !== 'change-me-in-production'
  });
}
