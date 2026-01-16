/**
 * =============================================================================
 * SEED PARKING SPOTS - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * API για seeding parking spots με enterprise IDs (manual seeding).
 *
 * @module api/admin/seed-parking
 * @enterprise RFC v6 - Authorization & RBAC System
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute (super_admin ONLY)
 * - Manual Seeding: Mass deletion + mass creation
 * - Multi-Layer Security: withAuth + explicit super_admin check
 * - Comprehensive audit logging
 *
 * Αυτό το endpoint:
 * 1. Διαγράφει παλιά parking spots με legacy IDs (1,2,3...)
 * 2. Δημιουργεί νέα parking spots με enterprise IDs (park_xxxx...)
 * 3. Τα συνδέει με το σωστό buildingId
 *
 * @method GET - Προεπισκόπηση (dry run)
 * @method POST - Εκτέλεση seeding
 * @method DELETE - Διαγραφή όλων των parking spots
 *
 * USAGE:
 * - GET /api/admin/seed-parking → Preview τι θα γίνει
 * - POST /api/admin/seed-parking → Εκτέλεση seeding
 * - DELETE /api/admin/seed-parking → Διαγραφή όλων
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { collection, getDocs, deleteDoc, doc, setDoc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateParkingId } from '@/services/enterprise-id.service';

// =============================================================================
// 🏢 ENTERPRISE CONFIGURATION
// =============================================================================

/**
 * Target building για τα νέα parking spots
 * Αυτό είναι το ΚΤΙΡΙΟ Α - Παλαιολόγου
 */
const TARGET_BUILDING = {
  id: 'G8kMxQ2pVwN5jR7tE1sA',
  name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
  projectId: 'xL2nV4bC6mZ8kJ9hG1fQ',
};

/**
 * 🅿️ Parking spot types
 */
type ParkingSpotType = 'standard' | 'handicapped' | 'motorcycle' | 'electric' | 'visitor';

/**
 * 🅿️ Parking spot status
 */
type ParkingSpotStatus = 'available' | 'occupied' | 'reserved' | 'sold' | 'maintenance';

/**
 * 🅿️ Enterprise Parking Spot Template
 */
interface ParkingSpotTemplate {
  number: string;
  type: ParkingSpotType;
  status: ParkingSpotStatus;
  floor: string;
  location: string;
  area: number;
  price: number;
  notes?: string;
}

/**
 * 🅿️ 10 Parking spots templates με πλήρη δεδομένα
 */
const PARKING_TEMPLATES: ParkingSpotTemplate[] = [
  {
    number: 'P-001',
    type: 'standard',
    status: 'available',
    floor: 'Υπόγειο -1',
    location: 'Δεξιά της εισόδου',
    area: 12.5,
    price: 15000,
    notes: 'Εύκολη πρόσβαση από την κεντρική είσοδο',
  },
  {
    number: 'P-002',
    type: 'standard',
    status: 'sold',
    floor: 'Υπόγειο -1',
    location: 'Δεξιά της εισόδου',
    area: 12.5,
    price: 15000,
    notes: 'Πωλήθηκε στον ιδιοκτήτη Α1',
  },
  {
    number: 'P-003',
    type: 'handicapped',
    status: 'available',
    floor: 'Υπόγειο -1',
    location: 'Κοντά στον ανελκυστήρα',
    area: 15.0,
    price: 18000,
    notes: 'Θέση ΑμεΑ με ευρύτερο χώρο',
  },
  {
    number: 'P-004',
    type: 'standard',
    status: 'reserved',
    floor: 'Υπόγειο -1',
    location: 'Αριστερά της εισόδου',
    area: 12.5,
    price: 15000,
    notes: 'Κρατημένη για διαμέρισμα Β1',
  },
  {
    number: 'P-005',
    type: 'electric',
    status: 'available',
    floor: 'Υπόγειο -1',
    location: 'Κοντά στον πίνακα ρεύματος',
    area: 13.0,
    price: 20000,
    notes: 'Με σταθμό φόρτισης ηλεκτρικού οχήματος',
  },
  {
    number: 'P-006',
    type: 'motorcycle',
    status: 'available',
    floor: 'Υπόγειο -1',
    location: 'Γωνία βόρεια',
    area: 5.0,
    price: 5000,
    notes: 'Θέση μηχανής/σκούτερ',
  },
  {
    number: 'P-007',
    type: 'motorcycle',
    status: 'sold',
    floor: 'Υπόγειο -1',
    location: 'Γωνία βόρεια',
    area: 5.0,
    price: 5000,
    notes: 'Θέση μηχανής - πωλήθηκε',
  },
  {
    number: 'P-008',
    type: 'standard',
    status: 'available',
    floor: 'Υπόγειο -2',
    location: 'Κεντρική περιοχή',
    area: 12.5,
    price: 12000,
    notes: 'Υπόγειο -2, χαμηλότερη τιμή',
  },
  {
    number: 'P-009',
    type: 'visitor',
    status: 'available',
    floor: 'Ισόγειο',
    location: 'Μπροστά από την είσοδο',
    area: 14.0,
    price: 0,
    notes: 'Θέση επισκεπτών - κοινόχρηστη',
  },
  {
    number: 'P-010',
    type: 'standard',
    status: 'maintenance',
    floor: 'Υπόγειο -2',
    location: 'Πίσω αριστερά',
    area: 12.5,
    price: 12000,
    notes: 'Υπό συντήρηση - επισκευή δαπέδου',
  },
];

// =============================================================================
// 🅿️ API HANDLERS
// =============================================================================

/**
 * GET /api/admin/seed-parking
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 */
export const GET = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedParkingPreview(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
);

/**
 * POST /api/admin/seed-parking
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 */
export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedParkingExecute(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
);

/**
 * DELETE /api/admin/seed-parking
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 */
export const DELETE = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedParkingDelete(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
);

async function handleSeedParkingPreview(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [SEED_PARKING_PREVIEW] BLOCKED: Non-super_admin attempted seeding preview: ` +
      `${ctx.email} (${ctx.globalRole})`
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can preview parking seeding',
        message: 'Parking seeding is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  console.log(`🔐 [SEED_PARKING_PREVIEW] Request from ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

  try {
    // Fetch existing parking spots
    const parkingRef = collection(db, COLLECTIONS.PARKING_SPACES);
    const snapshot = await getDocs(query(parkingRef));

    const existingSpots = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Generate preview of new IDs
    const previewIds = PARKING_TEMPLATES.map((template, index) => ({
      number: template.number,
      previewId: `park_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (θα δημιουργηθεί)`,
      buildingId: TARGET_BUILDING.id,
      type: template.type,
      status: template.status,
    }));

    console.log(`📊 Preview: ${existingSpots.length} existing spots, ${PARKING_TEMPLATES.length} to create`);

    return NextResponse.json({
      success: true,
      preview: true,
      message: 'Προεπισκόπηση seeding - δεν έγιναν αλλαγές',
      existing: {
        count: existingSpots.length,
        spots: existingSpots,
        willBeDeleted: true,
      },
      toCreate: {
        count: PARKING_TEMPLATES.length,
        targetBuilding: TARGET_BUILDING,
        spots: previewIds,
      },
      instructions: [
        'POST /api/admin/seed-parking → Για να εκτελεστεί το seeding',
        'DELETE /api/admin/seed-parking → Για να διαγραφούν όλα τα parking spots',
      ],
    });

  } catch (error) {
    console.error('Error in GET /api/admin/seed-parking:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to preview parking spots',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function handleSeedParkingExecute(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [SEED_PARKING_EXECUTE] BLOCKED: Non-super_admin attempted seeding execution: ` +
      `${ctx.email} (${ctx.globalRole})`
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute parking seeding',
        message: 'Mass deletion and creation are system-level operations restricted to super_admin'
      },
      { status: 403 }
    );
  }

  console.log(`🔐 [SEED_PARKING_EXECUTE] Request from ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

  try {
    const parkingRef = collection(db, COLLECTIONS.PARKING_SPACES);

    // =======================================================================
    // STEP 1: Διαγραφή υπαρχόντων parking spots
    // =======================================================================
    console.log('🗑️ Διαγραφή υπαρχόντων parking spots...');

    const existingSnapshot = await getDocs(query(parkingRef));
    const deletedIds: string[] = [];

    for (const docSnapshot of existingSnapshot.docs) {
      await deleteDoc(doc(db, COLLECTIONS.PARKING_SPACES, docSnapshot.id));
      deletedIds.push(docSnapshot.id);
      console.log(`  ✓ Διαγράφηκε: ${docSnapshot.id}`);
    }

    console.log(`✅ Διαγράφηκαν ${deletedIds.length} parking spots`);

    // =======================================================================
    // STEP 2: Δημιουργία νέων parking spots με enterprise IDs
    // =======================================================================
    console.log('🅿️ Δημιουργία νέων parking spots...');

    const createdSpots: Array<{ id: string; number: string }> = [];
    const now = new Date();

    for (const template of PARKING_TEMPLATES) {
      // Generate enterprise ID
      const parkingId = generateParkingId();

      // Create full document
      const parkingDoc = {
        number: template.number,
        buildingId: TARGET_BUILDING.id,
        projectId: TARGET_BUILDING.projectId,
        type: template.type,
        status: template.status,
        floor: template.floor,
        location: template.location,
        area: template.area,
        price: template.price,
        notes: template.notes || '',
        // Metadata
        createdAt: now,
        updatedAt: now,
        createdBy: 'seed-parking-api',
      };

      // Use setDoc with enterprise ID (not addDoc which auto-generates)
      await setDoc(doc(db, COLLECTIONS.PARKING_SPACES, parkingId), parkingDoc);

      createdSpots.push({ id: parkingId, number: template.number });
      console.log(`  ✓ Δημιουργήθηκε: ${parkingId} (${template.number})`);
    }

    console.log(`✅ Δημιουργήθηκαν ${createdSpots.length} parking spots`);

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      'seed_parking_spots',
      {
        operation: 'seed-parking',
        deletedCount: deletedIds.length,
        createdCount: createdSpots.length,
        targetBuilding: TARGET_BUILDING,
        deletedIds,
        createdSpots,
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Parking spots seeding by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ [SEED_PARKING_EXECUTE] Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({
      success: true,
      message: `Seeding ολοκληρώθηκε! Διαγράφηκαν ${deletedIds.length}, δημιουργήθηκαν ${createdSpots.length} parking spots`,
      deleted: {
        count: deletedIds.length,
        ids: deletedIds,
      },
      created: {
        count: createdSpots.length,
        targetBuilding: TARGET_BUILDING,
        spots: createdSpots,
      },
      executionTimeMs: duration,
    });

  } catch (error) {
    console.error('Error in POST /api/admin/seed-parking:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to seed parking spots',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function handleSeedParkingDelete(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    console.warn(
      `🚫 [SEED_PARKING_DELETE] BLOCKED: Non-super_admin attempted mass deletion: ` +
      `${ctx.email} (${ctx.globalRole})`
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can delete all parking spots',
        message: 'Mass deletion is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  console.log(`🔐 [SEED_PARKING_DELETE] Request from ${ctx.email} (${ctx.globalRole}, company: ${ctx.companyId})`);

  try {
    const parkingRef = collection(db, COLLECTIONS.PARKING_SPACES);
    const snapshot = await getDocs(query(parkingRef));

    const deletedIds: string[] = [];

    for (const docSnapshot of snapshot.docs) {
      await deleteDoc(doc(db, COLLECTIONS.PARKING_SPACES, docSnapshot.id));
      deletedIds.push(docSnapshot.id);
    }

    const duration = Date.now() - startTime;

    console.log(`✅ Διαγράφηκαν ${deletedIds.length} parking spots`);

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      'delete_all_parking_spots',
      {
        operation: 'delete-parking',
        deletedCount: deletedIds.length,
        deletedIds,
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Mass deletion of all parking spots by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      console.error('⚠️ [SEED_PARKING_DELETE] Audit logging failed (non-blocking):', err);
    });

    return NextResponse.json({
      success: true,
      message: `Διαγράφηκαν ${deletedIds.length} parking spots`,
      deleted: {
        count: deletedIds.length,
        ids: deletedIds,
      },
      executionTimeMs: duration,
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/seed-parking:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete parking spots',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
