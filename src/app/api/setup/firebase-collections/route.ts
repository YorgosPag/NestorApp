/**
 * =============================================================================
 * FIREBASE COLLECTIONS SETUP - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Initializes Firebase collections with test documents
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification System configuration operation
 *
 * This endpoint:
 * - Creates Firebase collections with test documents
 * - Removes test documents (collections remain)
 * - Initializes contact_relationships collection
 *
 * @method POST - Initialize collections (creates + deletes test docs)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @classification CRITICAL - System initialization operation
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FirebaseCollectionsRoute');

/**
 * POST - Initialize Firebase Collections (withAuth protected)
 * Creates collections with test documents then removes them.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleFirebaseCollectionsSetup(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for POST (initialize collections).
 */
async function handleFirebaseCollectionsSetup(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('[POST /api/setup/firebase-collections] BLOCKED: Non-super_admin attempted Firebase setup', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This CRITICAL system initialization requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    logger.info('Setting up Firebase collections...');

    // 1. Δημιουργία collection 'contact_relationships' (Admin SDK)
    const testRelationshipRef = getAdminFirestore().collection(COLLECTIONS.RELATIONSHIPS).doc('setup-test-doc');

    const testRelationship = {
      sourceContactId: 'setup-test-source',
      targetContactId: 'setup-test-target',
      relationshipType: 'employee',
      status: 'active',
      position: 'Test Employee',
      department: 'Setup Department',
      notes: 'Auto-created document για collection initialization',
      createdAt: AdminFieldValue.serverTimestamp(),
      createdBy: 'system-setup',
      lastModifiedAt: AdminFieldValue.serverTimestamp(),
      lastModifiedBy: 'system-setup'
    };

    logger.info('Creating test relationship document...');
    await testRelationshipRef.set(testRelationship);

    // 2. Διαγραφή του test document (το collection παραμένει)
    logger.info('Removing test document (collection remains)...');
    await testRelationshipRef.delete();

    logger.info('Firebase collections setup completed successfully!');

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'firebase_collections_setup',
      {
        operation: 'firebase-collections-setup',
        collectionsInitialized: ['contact_relationships'],
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Firebase collections setup by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.error('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      message: 'Firebase collections created successfully',
      collections: [
        {
          name: 'contact_relationships',
          status: 'created',
          description: 'Collection για contact relationships - ready for use'
        }
      ],
      executionTimeMs: duration
    });

  } catch (error: unknown) {
    logger.error('Firebase collections setup failed', { error });
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      error: 'Failed to setup Firebase collections',
      details: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: duration
    }, { status: 500 });
  }
}
