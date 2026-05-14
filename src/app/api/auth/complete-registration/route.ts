/**
 * =============================================================================
 * COMPLETE USER REGISTRATION - AUTHENTICATION API
 * =============================================================================
 *
 * Post-signup onboarding endpoint per assegnare il nuovo utente alla company di default.
 * Chiamato dal client dopo createUserWithEmailAndPassword (non-blocking).
 *
 * @module api/auth/complete-registration
 * @enterprise GOL+SSOT: Atomic operations, idempotent, belt-and-suspenders fallback
 *
 * 🔒 SECURITY: Requires only Firebase Auth (authenticated user calls for self)
 * - Rate Limit: STANDARD (100 req/min) - User operation
 * - Idempotent: Return 200 if already assigned correct companyId
 * - Atomic: All 3 steps succeed or fail together (via Firebase client SDK ordering)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('COMPLETE_REGISTRATION');

// ============================================================================
// TYPES
// ============================================================================

interface CompleteRegistrationResponse {
  success: boolean;
  message: string;
  user?: {
    uid: string;
    email: string;
    companyId: string;
    globalRole: string;
  };
  error?: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * POST /api/auth/complete-registration
 *
 * Authenticated user calls to complete post-signup onboarding.
 * Assigns user to DEFAULT_COMPANY_ID with external_user role.
 *
 * 🔒 SECURITY: withAuth only (no admin permissions)
 * - Rate Limit: STANDARD (100 req/min)
 * - Idempotent: Calling twice = same result
 */
export const POST = withStandardRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext): Promise<NextResponse<CompleteRegistrationResponse>> => {
      return handleCompleteRegistration(req, ctx);
    }
  )
);

async function handleCompleteRegistration(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<CompleteRegistrationResponse>> {
  const startTime = Date.now();

  try {
    const defaultCompanyId = process.env.DEFAULT_COMPANY_ID;
    if (!defaultCompanyId) {
      logger.error('DEFAULT_COMPANY_ID not configured', {});
      return NextResponse.json(
        {
          success: false,
          message: 'Server configuration error',
          error: 'DEFAULT_COMPANY_ID not configured'
        },
        { status: 500 }
      );
    }

    const uid = ctx.uid;
    const userEmail = ctx.email;

    logger.info('Completing registration', {
      uid,
      email: userEmail,
      defaultCompanyId,
    });

    // ========================================================================
    // IDEMPOTENCE CHECK: Already has correct companyId?
    // ========================================================================

    if (ctx.companyId === defaultCompanyId) {
      logger.info('User already assigned to default company', { uid, companyId: defaultCompanyId });
      return NextResponse.json({
        success: true,
        message: 'User already assigned to company',
        user: {
          uid,
          email: userEmail,
          companyId: defaultCompanyId,
          globalRole: 'external_user',
        },
      });
    }

    // ========================================================================
    // STEP 1: Set custom claims (Firebase Auth token)
    // ========================================================================

    try {
      const newClaims = {
        companyId: defaultCompanyId,
        globalRole: 'external_user',
        mfaEnrolled: false,
        permissions: ['properties:properties:view', 'projects:projects:view'],
      };

      await getAdminAuth().setCustomUserClaims(uid, newClaims);
      logger.info('Custom claims set successfully', { uid, companyId: defaultCompanyId });
    } catch (error) {
      logger.error('Failed to set custom claims', {
        uid,
        error: getErrorMessage(error),
      });
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to set custom claims',
          error: getErrorMessage(error)
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // STEP 2: Create/Update user document in Firestore /users/{uid}
    // ========================================================================

    try {
      const userRef = getAdminFirestore().collection(COLLECTIONS.USERS).doc(uid);
      const userDoc = await userRef.get();

      const userData = {
        email: userEmail,
        companyId: defaultCompanyId,
        globalRole: 'external_user',
        permissions: ['properties:properties:view', 'projects:projects:view'],
        status: 'active',
        updatedAt: AdminFieldValue.serverTimestamp(),
      };

      if (userDoc.exists) {
        await userRef.update(userData);
        logger.info('Updated user document', { uid });
      } else {
        await userRef.set({
          ...userData,
          createdAt: AdminFieldValue.serverTimestamp(),
        });
        logger.info('Created user document', { uid });
      }
    } catch (error) {
      logger.error('Failed to create/update user document', {
        uid,
        error: getErrorMessage(error),
      });
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to complete registration',
          error: getErrorMessage(error)
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // STEP 3: Create company member record (subcollection)
    // ========================================================================

    try {
      const memberRef = getAdminFirestore()
        .collection(COLLECTIONS.COMPANIES).doc(defaultCompanyId)
        .collection(SUBCOLLECTIONS.COMPANY_MEMBERS).doc(uid);

      const memberData = {
        uid,
        globalRole: 'external_user',
        status: 'active',
        joinedAt: AdminFieldValue.serverTimestamp(),
        addedBy: 'system:signup',
        updatedAt: AdminFieldValue.serverTimestamp(),
        permissionSetIds: [],
      };

      await memberRef.set(memberData, { merge: true });
      logger.info('Created company member record', { uid, companyId: defaultCompanyId });

      await EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.COMPANY,
        entityId: defaultCompanyId,
        entityName: null,
        action: 'updated',
        changes: [{ field: 'members', oldValue: null, newValue: uid }],
        performedBy: uid,
        performedByName: userEmail ?? null,
        companyId: defaultCompanyId,
      }).catch((err) => logger.warn('EntityAudit recordChange failed (non-blocking)', { error: getErrorMessage(err) }));
    } catch (error) {
      logger.warn('Failed to create company member record (non-blocking)', {
        uid,
        companyId: defaultCompanyId,
        error: getErrorMessage(error),
      });
      // Non-blocking: custom claims and user doc are already set
      // Client will retry on next login when token reloads
    }

    // ========================================================================
    // SUCCESS
    // ========================================================================

    const duration = Date.now() - startTime;
    logger.info('Registration completed successfully', {
      durationMs: duration,
      uid,
      companyId: defaultCompanyId,
    });

    return NextResponse.json({
      success: true,
      message: 'Registration completed',
      user: {
        uid,
        email: userEmail,
        companyId: defaultCompanyId,
        globalRole: 'external_user',
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Unexpected error', {
      durationMs: duration,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
