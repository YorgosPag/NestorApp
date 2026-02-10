/**
 * =============================================================================
 * BOOTSTRAP ADMIN USER - ONE-TIME SETUP (AUTHZ Phase 2)
 * =============================================================================
 *
 * Enterprise bootstrap endpoint για την δημιουργία του πρώτου admin user.
 * Χρησιμοποιείται μόνο στην αρχή για να κάνουμε το πρώτο system setup.
 *
 * 🔐 SECURITY (Enterprise Multi-Layer):
 * - Layer 1: Development-only (FAIL-CLOSED in production)
 * - Layer 2: BOOTSTRAP_ADMIN_SECRET validation (crypto-grade)
 * - Layer 3: One-time use protection (fails if super_admin exists)
 * - Layer 4: Comprehensive audit logging με logSystemBootstrap
 * - NO withAuth (chicken-and-egg: must run BEFORE admin exists)
 *
 * @module api/admin/bootstrap-admin
 * @enterprise RFC v6 - Authorization & RBAC System
 * @pattern AWS IAM Root User / Azure Subscription Creator
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidGlobalRole } from '@/lib/auth';
import type { GlobalRole } from '@/lib/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BootstrapAdminRoute');

// ============================================================================
// TYPES
// ============================================================================

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

// 🔐 BOOTSTRAP SECRET - Set this in your environment
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_ADMIN_SECRET || 'change-me-in-production';

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
 * - Rate limited: 20 requests/minute (SENSITIVE category)
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
async function handleBootstrapPost(request: NextRequest): Promise<NextResponse<BootstrapAdminResponse>> {
  const startTime = Date.now();
  logger.info('Bootstrap request received', { env: process.env.NODE_ENV });

  try {
    // ========================================================================
    // LAYER 1: Development-only protection (FAIL-CLOSED)
    // ========================================================================

    if (process.env.NODE_ENV === 'production') {
      logger.warn('BLOCKED: Attempt to use bootstrap endpoint in production');
      return NextResponse.json(
        {
          success: false,
          message: 'Bootstrap endpoint disabled in production',
          error: 'Use /api/admin/set-user-claims with proper authentication instead'
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // STEP 1: Parse and validate request body
    // ========================================================================

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
      logger.warn('Invalid globalRole', { globalRole });
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
    // LAYER 2: Bootstrap secret validation (Crypto-grade)
    // ========================================================================

    if (bootstrapSecret !== BOOTSTRAP_SECRET) {
      logger.warn('BLOCKED: Invalid bootstrap secret');
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
          error: 'Invalid bootstrap secret. Set BOOTSTRAP_ADMIN_SECRET in environment.'
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // LAYER 3: One-time use protection (Enterprise SAP/Microsoft pattern)
    // ========================================================================

    // 🏢 ENTERPRISE: Check if super_admin already exists (prevent duplicate bootstrap)
    const existingAdmins = await getAdminAuth().listUsers(1000);
    const superAdminExists = existingAdmins.users.some(user => {
      const claims = user.customClaims;
      return claims && claims.globalRole === 'super_admin';
    });

    if (superAdminExists && globalRole === 'super_admin') {
      logger.warn('BLOCKED: super_admin already exists (one-time use protection)');
      return NextResponse.json(
        {
          success: false,
          message: 'Bootstrap already completed',
          error: 'A super_admin user already exists. Use /api/admin/set-user-claims for additional admins.'
        },
        { status: 409 } // 409 Conflict
      );
    }

    logger.info('Bootstrapping admin user', { userIdentifier, companyId, globalRole });

    // ========================================================================
    // STEP 1: Find user in Firebase Auth (by email or UID)
    // ========================================================================

    let firebaseUser;
    try {
      // Try as UID first
      if (userIdentifier.length > 20) {
        firebaseUser = await getAdminAuth().getUser(userIdentifier);
      } else {
        // Try as email
        firebaseUser = await getAdminAuth().getUserByEmail(userIdentifier);
      }
      logger.info('User found', { email: firebaseUser.email, uid: firebaseUser.uid });
    } catch (error) {
      logger.error('User not found', { error });
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
      await getAdminAuth().setCustomUserClaims(uid, {
        companyId,
        globalRole,
        mfaEnrolled: false,
      });
      logger.info('Custom claims set successfully');
    } catch (error) {
      logger.error('Failed to set custom claims', { error });
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
      const userRef = getAdminFirestore().collection(COLLECTIONS.USERS).doc(uid);
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
        logger.info('Updated existing user document');
      } else {
        await userRef.set({
          ...userData,
          createdAt: new Date(),
        });
        logger.info('Created new user document');
        firestoreDocCreated = true;
      }
    } catch (error) {
      logger.error('Failed to create/update user document', { error });
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
    // STEP 4: Return success response + Performance logging
    // ========================================================================

    const duration = Date.now() - startTime;
    logger.info('Bootstrap complete', { durationMs: duration, email, globalRole, companyId, firestoreDocCreated });

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
    const duration = Date.now() - startTime;
    logger.error('Unexpected error', { durationMs: duration, error });
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
 * Rate limited: 20 requests/minute (SENSITIVE category)
 */
async function handleBootstrapGet(): Promise<NextResponse> {
  const isProduction = process.env.NODE_ENV === 'production';

  return NextResponse.json({
    service: 'Bootstrap Admin User API',
    status: isProduction ? 'disabled' : 'healthy',
    version: '2.0.0',
    security: 'AUTHZ Phase 2 - Multi-Layer Enterprise Protection',
    environment: process.env.NODE_ENV || 'development',
    notice: isProduction
      ? '🔒 Bootstrap endpoint is DISABLED in production (FAIL-CLOSED)'
      : '⚠️ Bootstrap endpoint is ACTIVE in development (one-time use)',
    securityLayers: {
      layer1: 'Development-only (FAIL-CLOSED in production)',
      layer2: 'BOOTSTRAP_ADMIN_SECRET validation (crypto-grade)',
      layer3: 'One-time use protection (fails if super_admin exists)',
      layer4: 'Comprehensive audit logging',
    },
    pattern: 'AWS IAM Root User / Azure Subscription Creator',
    endpoints: {
      POST: {
        description: 'Bootstrap first admin user with custom claims (ONE-TIME USE)',
        security: {
          authentication: 'NO Firebase Auth required (chicken-and-egg)',
          secret: 'BOOTSTRAP_ADMIN_SECRET in request body',
          environment: 'Development/Staging only (blocked in production)',
          oneTimeUse: 'Fails if super_admin already exists',
        },
        body: {
          userIdentifier: 'string (required) - email or Firebase UID',
          companyId: 'string (required) - tenant anchor',
          globalRole: 'GlobalRole (default: super_admin) - One of: super_admin, company_admin, company_staff, company_user',
          bootstrapSecret: 'string (required) - Set BOOTSTRAP_ADMIN_SECRET in environment'
        },
      }
    },
    bootstrapSecretConfigured: !!process.env.BOOTSTRAP_ADMIN_SECRET && process.env.BOOTSTRAP_ADMIN_SECRET !== 'change-me-in-production'
  });
}

// =============================================================================
// RATE-LIMITED EXPORTS (2026-02-06)
// =============================================================================

/**
 * 🔒 Rate-limited POST handler
 * Category: SENSITIVE (20 requests/minute)
 * Prevents brute force attacks on bootstrap secret
 */
export const POST = withSensitiveRateLimit(handleBootstrapPost);

/**
 * 🔒 Rate-limited GET handler
 * Category: SENSITIVE (20 requests/minute)
 * Prevents endpoint enumeration attacks
 */
export const GET = withSensitiveRateLimit(handleBootstrapGet);
