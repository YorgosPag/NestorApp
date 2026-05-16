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
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { setClaimsWithMirror } from '@/lib/auth/set-claims-with-mirror';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  type BootstrapAdminRequest,
  type BootstrapAdminResponse,
  BOOTSTRAP_SECRET,
  validateBootstrapInputs,
  lookupFirebaseUser,
} from './bootstrap-admin-logic';

const logger = createModuleLogger('BootstrapAdminRoute');

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
 */
async function handleBootstrapPost(
  request: NextRequest
): Promise<NextResponse<BootstrapAdminResponse>> {
  const startTime = Date.now();
  logger.info('Bootstrap request received', { env: process.env.NODE_ENV });

  try {
    // LAYER 1: Development-only protection (FAIL-CLOSED)
    if (process.env.NODE_ENV === 'production') {
      logger.warn('BLOCKED: Attempt to use bootstrap endpoint in production');
      return NextResponse.json(
        {
          success: false,
          message: 'Bootstrap endpoint disabled in production',
          error: 'Use /api/admin/set-user-claims with proper authentication instead',
        },
        { status: 403 }
      );
    }

    // STEP 1: Parse and validate request body
    const body: BootstrapAdminRequest = await request.json();
    const validationError = validateBootstrapInputs(body, BOOTSTRAP_SECRET);
    if (validationError) return validationError;
    const { userIdentifier, companyId, globalRole = 'super_admin' } = body;

    // LAYER 3: One-time use protection (Enterprise SAP/Microsoft pattern)
    const existingAdmins = await getAdminAuth().listUsers(1000);
    const superAdminExists = existingAdmins.users.some((u) => {
      const claims = u.customClaims;
      return claims && claims.globalRole === 'super_admin';
    });
    if (superAdminExists && globalRole === 'super_admin') {
      logger.warn('BLOCKED: super_admin already exists (one-time use protection)');
      return NextResponse.json(
        {
          success: false,
          message: 'Bootstrap already completed',
          error: 'A super_admin user already exists. Use /api/admin/set-user-claims for additional admins.',
        },
        { status: 409 }
      );
    }

    logger.info('Bootstrapping admin user', { userIdentifier, companyId, globalRole });

    // STEP 2: Find user in Firebase Auth (by email or UID)
    const lookup = await lookupFirebaseUser(userIdentifier);
    if (!lookup.found) return lookup.errorResponse;
    const firebaseUser = lookup.user;
    const uid = firebaseUser.uid;
    const email = firebaseUser.email || userIdentifier;

    // STEP 3: Set custom claims via ADR-360 mirror
    try {
      await setClaimsWithMirror(uid, { companyId, globalRole, mfaEnrolled: false });
      logger.info('Custom claims set successfully');
    } catch (error) {
      logger.error('Failed to set custom claims', { error });
      return NextResponse.json(
        { success: false, message: 'Failed to set custom claims', error: getErrorMessage(error) },
        { status: 500 }
      );
    }

    // STEP 4: Create/Update user document in Firestore /users/{uid}
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
        await userRef.set({ ...userData, createdAt: new Date() });
        logger.info('Created new user document');
        firestoreDocCreated = true;
      }
    } catch (error) {
      logger.error('Failed to create/update user document', { error });
      return NextResponse.json(
        {
          success: false,
          message: 'Custom claims set but Firestore doc failed',
          error: getErrorMessage(error),
          warning: 'User can authenticate but may have issues with permissions',
        },
        { status: 207 }
      );
    }

    // STEP 5: Return success response + Performance logging
    const duration = Date.now() - startTime;
    logger.info('Bootstrap complete', { durationMs: duration, email, globalRole, companyId, firestoreDocCreated });
    return NextResponse.json({
      success: true,
      message: 'Admin user bootstrapped successfully',
      user: { uid, email, companyId, globalRole, customClaimsSet: true, firestoreDocCreated },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Unexpected error', { durationMs: duration, error });
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: getErrorMessage(error) },
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
          authToken: 'BOOTSTRAP_ADMIN_SECRET env var — required in request body',
          environment: 'Development/Staging only (blocked in production)',
          oneTimeUse: 'Fails if super_admin already exists',
        },
        body: {
          userIdentifier: 'string (required) - email or Firebase UID',
          companyId: 'string (required) - tenant anchor',
          globalRole: 'GlobalRole (default: super_admin)',
          bootstrapToken: 'string (required) - set BOOTSTRAP_ADMIN_SECRET env var first',
        },
      },
    },
    bootstrapSecretConfigured:
      !!process.env.BOOTSTRAP_ADMIN_SECRET &&
      process.env.BOOTSTRAP_ADMIN_SECRET !== 'change-me-in-production',
  });
}

// =============================================================================
// RATE-LIMITED EXPORTS (2026-02-06)
// =============================================================================

/** 🔒 Rate-limited POST — SENSITIVE (20 req/min), brute-force protection */
export const POST = withSensitiveRateLimit(handleBootstrapPost);

/** 🔒 Rate-limited GET — SENSITIVE (20 req/min), endpoint enumeration protection */
export const GET = withSensitiveRateLimit(handleBootstrapGet);
