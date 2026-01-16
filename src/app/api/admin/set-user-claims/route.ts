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
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: users:users:manage (company_admin or super_admin)
 * - Tenant Isolation: company_admin can only manage users in their company
 * - Super Admin Bypass: super_admin can manage users across all companies
 * - Comprehensive audit logging with logClaimsUpdated
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, isValidGlobalRole } from '@/lib/auth';
import type { AuthContext, PermissionCache, GlobalRole } from '@/lib/auth';
import { logClaimsUpdated, extractRequestMetadata } from '@/lib/auth';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

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
  warning?: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * POST /api/admin/set-user-claims
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: users:users:manage
 * - Tenant Isolation: company_admin can only manage users in their company
 * - Super Admin Bypass: super_admin can manage any company
 */
export async function POST(request: NextRequest) {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<SetUserClaimsResponse>> => {
      return handleSetUserClaims(req, ctx);
    },
    { permissions: 'users:users:manage' }
  );

  return handler(request);
}

async function handleSetUserClaims(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<SetUserClaimsResponse>> {
  const startTime = Date.now();
  console.log(`🔐 [SET_USER_CLAIMS] Request from ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

  try {
    // ========================================================================
    // STEP 1: Parse and validate request body
    // ========================================================================

    const body: SetUserClaimsRequest = await request.json();
    const { uid, companyId, globalRole, email } = body;

    // ========================================================================
    // INPUT VALIDATION
    // ========================================================================

    if (!uid || typeof uid !== 'string') {
      console.warn(`⚠️ [SET_USER_CLAIMS] Invalid uid: ${uid}`);
      return NextResponse.json(
        { success: false, message: 'Invalid uid', error: 'uid is required and must be a string' },
        { status: 400 }
      );
    }

    if (!companyId || typeof companyId !== 'string') {
      console.warn(`⚠️ [SET_USER_CLAIMS] Invalid companyId: ${companyId}`);
      return NextResponse.json(
        { success: false, message: 'Invalid companyId', error: 'companyId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string') {
      console.warn(`⚠️ [SET_USER_CLAIMS] Invalid email: ${email}`);
      return NextResponse.json(
        { success: false, message: 'Invalid email', error: 'email is required and must be a string' },
        { status: 400 }
      );
    }

    if (!isValidGlobalRole(globalRole)) {
      console.warn(`⚠️ [SET_USER_CLAIMS] Invalid globalRole: ${globalRole}`);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid globalRole',
          error: `globalRole must be one of: super_admin, company_admin, company_staff, company_user`
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // TENANT ISOLATION - ENTERPRISE SECURITY
    // ========================================================================

    // 🏢 ENTERPRISE: company_admin can ONLY manage users in their own company
    // super_admin bypasses this restriction (can manage any company)
    if (ctx.globalRole === 'company_admin' && companyId !== ctx.companyId) {
      console.warn(
        `🚫 [SET_USER_CLAIMS] TENANT ISOLATION VIOLATION: ` +
        `company_admin ${ctx.email} (company: ${ctx.companyId}) ` +
        `attempted to manage user in company ${companyId}`
      );
      return NextResponse.json(
        {
          success: false,
          message: 'Forbidden',
          error: 'company_admin can only manage users within their own company'
        },
        { status: 403 }
      );
    }

    console.log(`🔐 [SET_USER_CLAIMS] Setting claims for user ${uid} (${email})`);
    console.log(`🔐 [SET_USER_CLAIMS] Target: Company ${companyId}, Role ${globalRole}`);
    console.log(`🔐 [SET_USER_CLAIMS] Caller: ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

    // ========================================================================
    // STEP 2: Verify user exists in Firebase Auth + Get existing claims
    // ========================================================================

    let firebaseUser;
    let previousClaims: Record<string, unknown> = {};

    try {
      firebaseUser = await adminAuth.getUser(uid);
      console.log(`✅ [SET_USER_CLAIMS] User found in Firebase Auth: ${firebaseUser.email}`);

      // Store previous claims for audit logging
      previousClaims = firebaseUser.customClaims || {};

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
    // STEP 3: Set custom claims on Firebase Auth token
    // ========================================================================

    const newClaims = {
      companyId,
      globalRole,
      mfaEnrolled: false, // Default to false
    };

    try {
      await adminAuth.setCustomUserClaims(uid, newClaims);
      console.log(`✅ [SET_USER_CLAIMS] Custom claims set successfully`);

      // 🏢 ENTERPRISE: Audit logging (non-blocking)
      const metadata = extractRequestMetadata(request);
      await logClaimsUpdated(
        ctx,
        uid,
        previousClaims,
        newClaims,
        `Claims updated by ${ctx.globalRole} ${ctx.email}`
      ).catch((err) => {
        console.error('⚠️ [SET_USER_CLAIMS] Audit logging failed (non-blocking):', err);
      });

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
    // STEP 4: Create/Update user document in Firestore /users/{uid}
    // ========================================================================

    let firestoreDocCreated = false;
    let firestoreSuccess = true;

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
        firestoreDocCreated = false;
      } else {
        // Create new user document
        await userRef.set({
          ...userData,
          createdAt: new Date(),
        });
        console.log(`✅ [SET_USER_CLAIMS] Created new user document`);
        firestoreDocCreated = true;
      }
    } catch (error) {
      console.error(`❌ [SET_USER_CLAIMS] Failed to create/update user document:`, error);
      firestoreSuccess = false;
      // Don't fail the entire request - custom claims are already set
      console.warn(`⚠️ [SET_USER_CLAIMS] Continuing despite Firestore error`);
    }

    // ========================================================================
    // STEP 5: Return success response
    // ========================================================================

    const duration = Date.now() - startTime;
    console.log(
      `✅ [SET_USER_CLAIMS] Complete in ${duration}ms: ` +
      `${ctx.email} (${ctx.globalRole}) set claims for ${email} ` +
      `(company: ${companyId}, role: ${globalRole})`
    );

    return NextResponse.json({
      success: true,
      message: 'Custom claims set successfully',
      user: {
        uid,
        email: firebaseUser.email || email,
        companyId,
        globalRole,
        customClaimsSet: true,
        firestoreDocCreated,
      },
      warning: !firestoreSuccess ? 'Custom claims set but Firestore sync failed' : undefined,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [SET_USER_CLAIMS] Unexpected error (${duration}ms):`, error);
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
    version: '2.0.0',
    security: 'AUTHZ Phase 2 - RBAC Protected',
    endpoints: {
      POST: {
        description: 'Set custom claims for a user (admin only)',
        security: {
          authentication: 'Firebase Auth + withAuth middleware',
          permission: 'users:users:manage',
          roles: ['super_admin', 'company_admin'],
          tenantIsolation: 'company_admin can only manage users in their company',
          superAdminBypass: 'super_admin can manage users across all companies',
        },
        body: {
          uid: 'string (required) - Firebase Auth UID',
          companyId: 'string (required) - Target company ID',
          globalRole: 'GlobalRole (required) - One of: super_admin, company_admin, company_staff, company_user',
          email: 'string (required) - User email for verification'
        },
        auditLogging: 'All claims updates are logged to /companies/{companyId}/audit_logs',
      }
    }
  });
}
