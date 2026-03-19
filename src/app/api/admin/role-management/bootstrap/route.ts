/**
 * =============================================================================
 * POST /api/admin/role-management/bootstrap — One-Time Member Migration
 * =============================================================================
 *
 * Migrates existing users into the companies/{companyId}/members subcollection.
 *
 * For each user document with a companyId:
 * 1. Reads Firebase Auth custom claims for globalRole
 * 2. Creates companies/{companyId}/members/{uid} if it doesn't exist
 * 3. Uses setDoc with merge for idempotent re-runs
 *
 * Security:
 * - super_admin only
 * - Idempotent: safe to run multiple times
 *
 * Auth: withAuth (super_admin)
 * Rate: withSensitiveRateLimit
 *
 * @module api/admin/role-management/bootstrap
 * @enterprise ADR-244 Role Management Admin Console
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logSystemBootstrap } from '@/lib/auth';
import type { AuthContext, PermissionCache, GlobalRole } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminAuth, getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('RoleManagement:Bootstrap');

// =============================================================================
// TYPES
// =============================================================================

interface BootstrapResult {
  created: number;
  skipped: number;
  errors: number;
  details: BootstrapUserResult[];
}

interface BootstrapUserResult {
  uid: string;
  action: 'created' | 'skipped' | 'error';
  reason: string;
}

// =============================================================================
// POST — Bootstrap Company Members
// =============================================================================

export const POST = withSensitiveRateLimit(
  withAuth(
    async (
      _request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const db = getAdminFirestore();
        const auth = getAdminAuth();

        // 1. Read all user documents where companyId matches the caller's company
        const usersSnap = await db
          .collection(COLLECTIONS.USERS)
          .where('companyId', '==', ctx.companyId)
          .get();

        if (usersSnap.empty) {
          return NextResponse.json({
            success: true,
            data: { created: 0, skipped: 0, errors: 0, details: [] } satisfies BootstrapResult,
            message: 'No users found for this company',
          });
        }

        const result: BootstrapResult = {
          created: 0,
          skipped: 0,
          errors: 0,
          details: [],
        };

        // 2. Process each user
        for (const userDoc of usersSnap.docs) {
          const uid = userDoc.id;

          try {
            // Check if member doc already exists
            const memberPath = `${COLLECTIONS.COMPANIES}/${ctx.companyId}/${SUBCOLLECTIONS.COMPANY_MEMBERS}/${uid}`;
            const memberSnap = await db.doc(memberPath).get();

            if (memberSnap.exists) {
              result.skipped++;
              result.details.push({
                uid,
                action: 'skipped',
                reason: 'Member document already exists',
              });
              continue;
            }

            // Get Firebase Auth user record for globalRole from custom claims
            let globalRole: GlobalRole = 'internal_user';
            let isDisabled = false;

            try {
              const authUser = await auth.getUser(uid);
              const claims = (authUser.customClaims ?? {}) as Record<string, unknown>;
              if (
                typeof claims.globalRole === 'string' &&
                ['super_admin', 'company_admin', 'internal_user', 'external_user'].includes(claims.globalRole)
              ) {
                globalRole = claims.globalRole as GlobalRole;
              }
              isDisabled = authUser.disabled;
            } catch {
              // User might not exist in Auth (orphaned Firestore doc)
              logger.warn('Could not fetch Auth record for user', { uid });
            }

            // Create member document with setDoc + merge for idempotency
            const memberData = {
              uid,
              globalRole,
              status: isDisabled ? 'suspended' : 'active',
              joinedAt: FieldValue.serverTimestamp(),
              permissionSetIds: [] as string[],
              addedBy: ctx.uid,
              updatedAt: null,
            };

            await db.doc(memberPath).set(memberData, { merge: true });

            result.created++;
            result.details.push({
              uid,
              action: 'created',
              reason: `Role: ${globalRole}, Status: ${memberData.status}`,
            });
          } catch (userError) {
            const userMessage = getErrorMessage(userError, 'Unknown error');
            result.errors++;
            result.details.push({
              uid,
              action: 'error',
              reason: userMessage,
            });
            logger.error('Failed to bootstrap member', { uid, error: userMessage });
          }
        }

        // Audit log
        await logSystemBootstrap(ctx, 'role-management-bootstrap', {
          companyId: ctx.companyId,
          totalUsers: usersSnap.size,
          created: result.created,
          skipped: result.skipped,
          errors: result.errors,
        });

        logger.info('Bootstrap completed', {
          companyId: ctx.companyId,
          totalUsers: usersSnap.size,
          created: result.created,
          skipped: result.skipped,
          errors: result.errors,
        });

        return NextResponse.json({
          success: true,
          data: result,
          message: `Bootstrap complete: ${result.created} created, ${result.skipped} skipped, ${result.errors} errors`,
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to bootstrap company members');
        logger.error('Bootstrap failed', { error: message, companyId: ctx.companyId });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
    { requiredGlobalRoles: ['super_admin'] }
  )
);
