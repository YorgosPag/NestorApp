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
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/**
 * POST - Initialize Firebase Collections (withAuth protected)
 * Creates collections with test documents then removes them.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 */
export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleFirebaseCollectionsSetup(req, ctx);
  },
  { permissions: 'admin:data:fix' }
);

/**
 * Internal handler for POST (initialize collections).
 */
async function handleFirebaseCollectionsSetup(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [POST /api/setup/firebase-collections] BLOCKED: Non-super_admin attempted Firebase setup`,
      { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole }
    );
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
    console.log('🔧 Setting up Firebase collections...');

    // 1. Δημιουργία collection 'contact_relationships'
    const testRelationshipRef = doc(collection(db, COLLECTIONS.RELATIONSHIPS), 'setup-test-doc');

    const testRelationship = {
      sourceContactId: 'setup-test-source',
      targetContactId: 'setup-test-target',
      relationshipType: 'employee',
      status: 'active',
      position: 'Test Employee',
      department: 'Setup Department',
      notes: 'Auto-created document για collection initialization',
      createdAt: serverTimestamp(),
      createdBy: 'system-setup',
      lastModifiedAt: serverTimestamp(),
      lastModifiedBy: 'system-setup'
    };

    console.log('📝 Creating test relationship document...');
    await setDoc(testRelationshipRef, testRelationship);

    // 2. Διαγραφή του test document (το collection παραμένει)
    console.log('🗑️ Removing test document (collection remains)...');
    await deleteDoc(testRelationshipRef);

    console.log('✅ Firebase collections setup completed successfully!');

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
      console.error('⚠️ Audit logging failed (non-blocking):', err);
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
    console.error('❌ Firebase collections setup failed:', error);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      error: 'Failed to setup Firebase collections',
      details: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: duration
    }, { status: 500 });
  }
}