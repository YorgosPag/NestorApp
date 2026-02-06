/**
 * =============================================================================
 * SEED FLOORS - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * API για seeding floors με enterprise IDs (manual seeding).
 *
 * @module api/admin/seed-floors
 * @enterprise RFC v6 - Authorization & RBAC System
 * @created 2026-01-31
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute (super_admin ONLY)
 * - Manual Seeding: Mass deletion + mass creation
 * - Multi-Layer Security: withAuth + explicit super_admin check
 * - Comprehensive audit logging
 *
 * Αυτό το endpoint:
 * 1. Διαγράφει παλιά floors με legacy IDs (floor_1, floor_2...)
 * 2. Δημιουργεί νέα floors με enterprise IDs (flr_xxxx...)
 * 3. Τα συνδέει με το σωστό buildingId και companyId
 *
 * @method GET - Προεπισκόπηση (dry run)
 * @method POST - Εκτέλεση seeding
 * @method DELETE - Διαγραφή όλων των floors
 *
 * USAGE:
 * - GET /api/admin/seed-floors → Preview τι θα γίνει
 * - POST /api/admin/seed-floors → Εκτέλεση seeding
 * - DELETE /api/admin/seed-floors → Διαγραφή όλων
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateFloorId } from '@/services/enterprise-id.service';
import { FieldValue } from 'firebase-admin/firestore';

// =============================================================================
// 🏢 ENTERPRISE CONFIGURATION
// =============================================================================

/**
 * Target building για τα νέα floors
 * Αυτό είναι το ΚΤΙΡΙΟ Α - Παλαιολόγου
 *
 * 🏢 ENTERPRISE: IDs must match EXACTLY the Firestore document IDs
 *
 * ⚠️ IMPORTANT: Firestore document IDs do NOT have prefixes!
 * - The prefix (building_, project_) is only used for searchDocuments collection
 * - Actual entity document IDs are: G8kMxQ2pVwN5jR7tE1sA, xL2nV4bC6mZ8kJ9hG1fQ
 */
const TARGET_BUILDING = {
  id: 'G8kMxQ2pVwN5jR7tE1sA',
  name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
  projectId: 'xL2nV4bC6mZ8kJ9hG1fQ',
  projectName: 'Παλαιολόγου Πολυκατοικία',
};

/**
 * 🏢 Company ID for tenant isolation
 * This must match the authenticated user's companyId
 */
const TARGET_COMPANY_ID = 'comp_ySl83AUCbGRjn7bDGxn5';

/**
 * 🏢 Enterprise Floor Template
 */
interface FloorTemplate {
  number: number;
  name: string;
  units: number;
  description?: string;
}

/**
 * 🏢 5 Floor templates με πλήρη δεδομένα
 * Ακολουθεί το τυπικό μοντέλο ελληνικής πολυκατοικίας
 */
const FLOOR_TEMPLATES: FloorTemplate[] = [
  {
    number: -1,
    name: 'Υπόγειο',
    units: 0,
    description: 'Αποθήκες και parking',
  },
  {
    number: 0,
    name: 'Ισόγειο',
    units: 2,
    description: 'Καταστήματα και είσοδος',
  },
  {
    number: 1,
    name: '1ος Όροφος',
    units: 2,
    description: 'Διαμερίσματα Α1, Β1',
  },
  {
    number: 2,
    name: '2ος Όροφος',
    units: 2,
    description: 'Διαμερίσματα Α2, Β2',
  },
  {
    number: 3,
    name: '3ος Όροφος',
    units: 2,
    description: 'Διαμερίσματα Α3, Β3',
  },
  {
    number: 4,
    name: '4ος Όροφος',
    units: 1,
    description: 'Ρετιρέ',
  },
];

// =============================================================================
// 🏢 API HANDLERS
// =============================================================================

/**
 * GET /api/admin/seed-floors
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 */
export const GET = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedFloorsPreview(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
);

/**
 * POST /api/admin/seed-floors
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 */
export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedFloorsExecute(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
);

/**
 * DELETE /api/admin/seed-floors
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 */
export const DELETE = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedFloorsDelete(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
);

async function handleSeedFloorsPreview(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [SEED_FLOORS_PREVIEW] BLOCKED: Non-super_admin attempted seeding preview: ` +
      `${ctx.email} (${ctx.globalRole})`
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can preview floors seeding',
        message: 'Floors seeding is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  console.log(`🔐 [SEED_FLOORS_PREVIEW] Request from ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

  try {
    // 🏢 ENTERPRISE: Ensure Admin SDK is initialized

    // Fetch existing floors (Admin SDK syntax)
    const floorsRef = getAdminFirestore().collection(COLLECTIONS.FLOORS);
    const snapshot = await floorsRef.get();

    const existingFloors = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    // Generate preview of new IDs
    const previewIds = FLOOR_TEMPLATES.map((template) => ({
      number: template.number,
      name: template.name,
      previewId: `flr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (θα δημιουργηθεί)`,
      buildingId: TARGET_BUILDING.id,
      units: template.units,
    }));

    console.log(`📊 Preview: ${existingFloors.length} existing floors, ${FLOOR_TEMPLATES.length} to create`);

    return NextResponse.json({
      success: true,
      preview: true,
      message: 'Προεπισκόπηση seeding - δεν έγιναν αλλαγές',
      existing: {
        count: existingFloors.length,
        floors: existingFloors,
        willBeDeleted: true,
      },
      toCreate: {
        count: FLOOR_TEMPLATES.length,
        targetBuilding: TARGET_BUILDING,
        companyId: TARGET_COMPANY_ID,
        floors: previewIds,
      },
      instructions: [
        'POST /api/admin/seed-floors → Για να εκτελεστεί το seeding',
        'DELETE /api/admin/seed-floors → Για να διαγραφούν όλα τα floors',
      ],
    });

  } catch (error) {
    console.error('Error in GET /api/admin/seed-floors:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to preview floors',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function handleSeedFloorsExecute(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [SEED_FLOORS_EXECUTE] BLOCKED: Non-super_admin attempted seeding execution: ` +
      `${ctx.email} (${ctx.globalRole})`
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute floors seeding',
        message: 'Mass deletion and creation are system-level operations restricted to super_admin'
      },
      { status: 403 }
    );
  }

  console.log(`🔐 [SEED_FLOORS_EXECUTE] Request from ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

  try {
    // 🏢 ENTERPRISE: Ensure Admin SDK is initialized

    const floorsRef = getAdminFirestore().collection(COLLECTIONS.FLOORS);

    // =======================================================================
    // STEP 1: Διαγραφή υπαρχόντων floors
    // =======================================================================
    console.log('🗑️ Διαγραφή υπαρχόντων floors...');

    const existingSnapshot = await floorsRef.get();
    const deletedIds: string[] = [];

    for (const docSnapshot of existingSnapshot.docs) {
      await getAdminFirestore().collection(COLLECTIONS.FLOORS).doc(docSnapshot.id).delete();
      deletedIds.push(docSnapshot.id);
      console.log(`  ✓ Διαγράφηκε: ${docSnapshot.id}`);
    }

    console.log(`✅ Διαγράφηκαν ${deletedIds.length} floors`);

    // =======================================================================
    // STEP 2: Δημιουργία νέων floors με enterprise IDs
    // =======================================================================
    console.log('🏢 Δημιουργία νέων floors...');

    const createdFloors: Array<{ id: string; number: number; name: string }> = [];
    const now = FieldValue.serverTimestamp();

    for (const template of FLOOR_TEMPLATES) {
      // 🏢 ENTERPRISE: Generate enterprise ID
      const floorId = generateFloorId();

      // Create full document
      const floorDoc = {
        // 🏢 ENTERPRISE: Core fields
        id: floorId,
        number: template.number,
        name: template.name,
        units: template.units,

        // 🏢 ENTERPRISE: Foreign key relationships
        buildingId: TARGET_BUILDING.id,
        buildingName: TARGET_BUILDING.name,
        projectId: TARGET_BUILDING.projectId,
        projectName: TARGET_BUILDING.projectName,

        // 🔒 TENANT ISOLATION: Required for API queries
        companyId: ctx.companyId || TARGET_COMPANY_ID,

        // 🏢 ENTERPRISE: Metadata
        description: template.description || '',
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.uid,
      };

      // Use Admin SDK set with enterprise ID
      await getAdminFirestore().collection(COLLECTIONS.FLOORS).doc(floorId).set(floorDoc);

      createdFloors.push({ id: floorId, number: template.number, name: template.name });
      console.log(`  ✓ Δημιουργήθηκε: ${floorId} (${template.name})`);
    }

    console.log(`✅ Δημιουργήθηκαν ${createdFloors.length} floors`);

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      'seed_floors',
      {
        operation: 'seed-floors',
        deletedCount: deletedIds.length,
        createdCount: createdFloors.length,
        targetBuilding: TARGET_BUILDING,
        companyId: ctx.companyId,
        deletedIds,
        createdFloors,
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Floors seeding by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ [SEED_FLOORS_EXECUTE] Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({
      success: true,
      message: `Seeding ολοκληρώθηκε! Διαγράφηκαν ${deletedIds.length}, δημιουργήθηκαν ${createdFloors.length} floors`,
      deleted: {
        count: deletedIds.length,
        ids: deletedIds,
      },
      created: {
        count: createdFloors.length,
        targetBuilding: TARGET_BUILDING,
        companyId: ctx.companyId,
        floors: createdFloors,
      },
      executionTimeMs: duration,
    });

  } catch (error) {
    console.error('Error in POST /api/admin/seed-floors:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to seed floors',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function handleSeedFloorsDelete(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [SEED_FLOORS_DELETE] BLOCKED: Non-super_admin attempted mass deletion: ` +
      `${ctx.email} (${ctx.globalRole})`
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can delete all floors',
        message: 'Mass deletion is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  console.log(`🔐 [SEED_FLOORS_DELETE] Request from ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

  try {
    // 🏢 ENTERPRISE: Ensure Admin SDK is initialized

    const floorsRef = getAdminFirestore().collection(COLLECTIONS.FLOORS);
    const snapshot = await floorsRef.get();

    const deletedIds: string[] = [];

    for (const docSnapshot of snapshot.docs) {
      await getAdminFirestore().collection(COLLECTIONS.FLOORS).doc(docSnapshot.id).delete();
      deletedIds.push(docSnapshot.id);
    }

    const duration = Date.now() - startTime;

    console.log(`✅ Διαγράφηκαν ${deletedIds.length} floors`);

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      'delete_all_floors',
      {
        operation: 'delete-floors',
        deletedCount: deletedIds.length,
        deletedIds,
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Mass deletion of all floors by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ [SEED_FLOORS_DELETE] Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({
      success: true,
      message: `Διαγράφηκαν ${deletedIds.length} floors`,
      deleted: {
        count: deletedIds.length,
        ids: deletedIds,
      },
      executionTimeMs: duration,
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/seed-floors:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete floors',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
