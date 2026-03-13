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
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateParkingId } from '@/services/enterprise-id.service';
import { FieldValue } from 'firebase-admin/firestore';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { processAdminBatch, BATCH_SIZE_READ } from '@/lib/admin-batch-utils';

const logger = createModuleLogger('SeedParkingRoute');

// =============================================================================
// 🏢 ENTERPRISE CONFIGURATION
// =============================================================================

/**
 * Target building για τα νέα parking spots
 * Αυτό είναι το ΚΤΙΡΙΟ Α - Παλαιολόγου
 *
 * 🏢 ENTERPRISE: IDs must match EXACTLY the Firestore document IDs
 *
 * ⚠️ IMPORTANT: Firestore document IDs do NOT have prefixes!
 * - The prefix (building_, project_) is only used for searchDocuments collection
 * - Actual entity document IDs are: G8kMxQ2pVwN5jR7tE1sA, xL2nV4bC6mZ8kJ9hG1fQ
 *
 * This follows the same pattern as buildings/projects/units collections.
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
 *
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedParkingPreview(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
));

/**
 * POST /api/admin/seed-parking
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 *
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedParkingExecute(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
));

/**
 * DELETE /api/admin/seed-parking
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute
 * - Super_admin ONLY (explicit check below)
 *
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const DELETE = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleSeedParkingDelete(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
));

async function handleSeedParkingPreview(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted seeding preview', { email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can preview parking seeding',
        message: 'Parking seeding is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  logger.info('Seed parking preview request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

  try {
    // ADR-214 Phase 8: Batch processing for safety
    const parkingRef = getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES);
    const existingSpots: Array<Record<string, unknown>> = [];
    await processAdminBatch(
      parkingRef,
      BATCH_SIZE_READ,
      (docs) => {
        for (const docSnap of docs) {
          existingSpots.push({ id: docSnap.id, ...docSnap.data() });
        }
      },
    );

    // Generate preview of new IDs
    const previewIds = PARKING_TEMPLATES.map((template, index) => ({
      number: template.number,
      previewId: `park_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (θα δημιουργηθεί)`,
      buildingId: TARGET_BUILDING.id,
      type: template.type,
      status: template.status,
    }));

    logger.info('Preview', { existingSpots: existingSpots.length, toCreate: PARKING_TEMPLATES.length });

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
    logger.error('Error in seed-parking preview', { error });
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
    logger.warn('BLOCKED: Non-super_admin attempted seeding execution', { email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute parking seeding',
        message: 'Mass deletion and creation are system-level operations restricted to super_admin'
      },
      { status: 403 }
    );
  }

  logger.info('Seed parking execute request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

  try {
    // ADR-214 Phase 8: Batch processing for safety
    const parkingRef = getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES);

    // =======================================================================
    // STEP 1: Διαγραφή υπαρχόντων parking spots (batched)
    // =======================================================================
    logger.info('Deleting existing parking spots...');

    const deletedIds: string[] = [];
    await processAdminBatch(
      parkingRef,
      BATCH_SIZE_READ,
      async (docs) => {
        for (const docSnapshot of docs) {
          await getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES).doc(docSnapshot.id).delete();
          deletedIds.push(docSnapshot.id);
          logger.info('Deleted parking spot', { id: docSnapshot.id });
        }
      },
    );

    logger.info('Deleted parking spots', { count: deletedIds.length });

    // =======================================================================
    // STEP 2: Δημιουργία νέων parking spots με enterprise IDs
    // =======================================================================
    logger.info('Creating new parking spots with enterprise IDs...');

    const createdSpots: Array<{ id: string; number: string }> = [];
    const now = FieldValue.serverTimestamp();

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
        // Metadata (using Admin SDK FieldValue)
        createdAt: now,
        updatedAt: now,
        createdBy: 'seed-parking-api',
      };

      // Use Admin SDK set with enterprise ID
      await getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES).doc(parkingId).set(parkingDoc);

      createdSpots.push({ id: parkingId, number: template.number });
      logger.info('Created parking spot', { parkingId, number: template.number });
    }

    logger.info('Created parking spots', { count: createdSpots.length });

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
      logger.warn('Audit logging failed (non-blocking)', { error: err });
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
    logger.error('Error in seed-parking execute', { error });
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
    logger.warn('BLOCKED: Non-super_admin attempted mass deletion', { email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can delete all parking spots',
        message: 'Mass deletion is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  logger.info('Seed parking delete request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

  try {
    // ADR-214 Phase 8: Batch processing for safety
    const parkingRef = getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES);

    const deletedIds: string[] = [];
    await processAdminBatch(
      parkingRef,
      BATCH_SIZE_READ,
      async (docs) => {
        for (const docSnapshot of docs) {
          await getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES).doc(docSnapshot.id).delete();
          deletedIds.push(docSnapshot.id);
        }
      },
    );

    const duration = Date.now() - startTime;

    logger.info('Deleted all parking spots', { count: deletedIds.length });

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
      logger.warn('Audit logging failed (non-blocking)', { error: err });
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
    logger.error('Error in seed-parking delete', { error });
    return NextResponse.json({
      success: false,
      error: 'Failed to delete parking spots',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// =============================================================================
// 🏢 ENTERPRISE MIGRATION: Fix Foreign Key References
// =============================================================================

/**
 * 🏢 ENTERPRISE: Foreign Key ID Normalization
 *
 * Ensures foreign key references follow the canonical format:
 * - buildingId: 'building_xxx' (with prefix)
 * - projectId: 'project_xxx' (with prefix)
 *
 * This follows enterprise data consistency patterns used by:
 * - SAP: Master Data Governance (MDG) reference integrity
 * - Salesforce: External ID field standardization
 * - Microsoft Dynamics: Alternate Key conventions
 */
interface ForeignKeyMigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  alreadyCorrect: number;
  errors: number;
  details: Array<{
    id: string;
    action: 'migrated' | 'skipped' | 'already_correct' | 'error';
    changes?: {
      buildingId?: { from: string; to: string };
      projectId?: { from: string; to: string };
    };
    error?: string;
  }>;
}

/**
 * 🏢 ENTERPRISE: Rollback Record Interface
 *
 * Follows SAP Change Documents pattern for data recovery.
 * Each migration creates a rollback record that can be used to
 * restore the original state if needed.
 */
interface RollbackRecord {
  docId: string;
  originalData: {
    buildingId?: string;
    projectId?: string;
  };
  newData: {
    buildingId?: string;
    projectId?: string;
  };
}

/**
 * 🏢 ENTERPRISE: Migration Batch Item
 *
 * Represents a single document to be migrated in a batch operation.
 * Pre-validated before batch execution for fail-fast behavior.
 */
interface MigrationBatchItem {
  docId: string;
  updateData: Record<string, unknown>;
  changes: {
    buildingId?: { from: string; to: string };
    projectId?: { from: string; to: string };
  };
}

/**
 * PATCH /api/admin/seed-parking
 *
 * 🏢 ENTERPRISE: Foreign Key Validation (NO-OP after Re-seed)
 *
 * ⚠️ DEPRECATED: This endpoint is now a NO-OP.
 *
 * REASON: Firestore document IDs do NOT have prefixes!
 * - Building doc ID: G8kMxQ2pVwN5jR7tE1sA (NOT building_G8kMxQ2pVwN5jR7tE1sA)
 * - Project doc ID: xL2nV4bC6mZ8kJ9hG1fQ (NOT project_xL2nV4bC6mZ8kJ9hG1fQ)
 *
 * The Re-seed (POST) endpoint creates parking spots with CORRECT non-prefixed IDs.
 * Adding prefixes BREAKS the tenant resolution because resolveTenantId cannot
 * find documents with prefixed IDs.
 *
 * This endpoint now validates that IDs are correct (non-prefixed) and reports status.
 *
 * @enterprise ADR-029 - Data Consistency & Foreign Key Integrity
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const PATCH = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleForeignKeyValidation(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
));

async function handleForeignKeyValidation(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();
  const migrationId = `fk_validation_${Date.now()}`;

  // ========================================================================
  // LAYER 1: Super_admin ONLY check (EXTRA security layer)
  // ========================================================================

  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted validation', { email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can validate parking FK',
        message: 'Foreign key validation is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  logger.info('Parking FK validation request', { email: ctx.email, globalRole: ctx.globalRole });

  try {
    // 🏢 ENTERPRISE: Ensure Admin SDK is initialized
    const body = await request.json() as { dryRun?: boolean };
    const { dryRun = true } = body;

    logger.info('PARKING FOREIGN KEY VALIDATION (NO-OP Mode)', { migrationId, mode: dryRun ? 'DRY-RUN' : 'EXECUTE', purpose: 'Validate non-prefixed IDs' });

    const stats: ForeignKeyMigrationStats = {
      total: 0,
      migrated: 0, // Will always be 0 - no migrations performed
      skipped: 0,
      alreadyCorrect: 0,
      errors: 0,
      details: [],
    };

    // ========================================================================
    // PHASE 1: VALIDATION ONLY (No writes)
    // ========================================================================
    logger.info('PHASE 1: Validation (NO-OP)');

    // ADR-214 Phase 8: Batch processing for safety
    const parkingRef = getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES);

    await processAdminBatch(
      parkingRef,
      BATCH_SIZE_READ,
      (docs) => {
        stats.total += docs.length;
        for (const docSnapshot of docs) {
      const data = docSnapshot.data() as Record<string, unknown>;
      const currentBuildingId = data.buildingId as string | undefined;
      const currentProjectId = data.projectId as string | undefined;

      // 🏢 ENTERPRISE: Correct format is NON-prefixed (matches Firestore doc IDs)
      const hasPrefixedBuilding = currentBuildingId?.startsWith('building_');
      const hasPrefixedProject = currentProjectId?.startsWith('project_');

      if (hasPrefixedBuilding || hasPrefixedProject) {
        // This is WRONG - prefixed IDs break tenant resolution
        stats.errors++;
        stats.details.push({
          id: docSnapshot.id,
          action: 'error',
          error: `Has prefixed IDs (breaks tenant resolution): buildingId=${currentBuildingId}, projectId=${currentProjectId}. Run Re-seed to fix.`,
        });
        logger.warn('Parking spot has prefixed IDs (WRONG)', { id: docSnapshot.id, buildingId: currentBuildingId, projectId: currentProjectId });
      } else if (currentBuildingId && currentProjectId) {
        // Correct format - non-prefixed
        stats.alreadyCorrect++;
        stats.details.push({
          id: docSnapshot.id,
          action: 'already_correct',
        });
        logger.info('Parking spot correct (non-prefixed)', { id: docSnapshot.id });
      } else {
        // Missing required fields
        stats.skipped++;
        stats.details.push({
          id: docSnapshot.id,
          action: 'skipped',
          error: `Missing buildingId or projectId`,
        });
        logger.info('Parking spot missing buildingId/projectId', { id: docSnapshot.id });
      }
        }
      },
    );

    logger.info('Found parking spots to validate', { count: stats.total });

    const duration = Date.now() - startTime;

    logger.info('VALIDATION SUMMARY', { migrationId, total: stats.total, correct: stats.alreadyCorrect, errors: stats.errors, skipped: stats.skipped, durationMs: duration, migration: 'NO-OP' });

    // 🏢 ENTERPRISE: Audit logging
    const metadata = extractRequestMetadata(request);
    await logMigrationExecuted(
      ctx,
      'parking_fk_validation',
      {
        migrationId,
        operation: 'validation-only',
        pattern: 'no-op',
        stats: {
          total: stats.total,
          migrated: 0,
          alreadyCorrect: stats.alreadyCorrect,
          errors: stats.errors,
        },
        executionTimeMs: duration,
        result: stats.errors === 0 ? 'success' : 'has_errors',
        note: 'Migration disabled - prefixed IDs break tenant resolution',
        metadata,
      },
      `Parking FK validation by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
      migrationId,
      message: stats.errors > 0
        ? `⚠️ Found ${stats.errors} parking spots with PREFIXED IDs (breaks tenant resolution). Run Re-seed to fix.`
        : `✅ All ${stats.alreadyCorrect} parking spots have correct non-prefixed IDs.`,
      stats: {
        total: stats.total,
        migrated: 0, // Always 0 - no migrations
        alreadyCorrect: stats.alreadyCorrect,
        errors: stats.errors,
      },
      details: stats.details,
      rollback: {
        available: false,
        note: 'No migration performed - this is a validation-only endpoint',
      },
      executionTimeMs: duration,
      notice: '⚠️ This endpoint is now a NO-OP. Prefixed IDs break tenant resolution. Use Re-seed instead.',
    });

  } catch (error) {
    logger.error('Error in seed-parking FK validation', { error });
    return NextResponse.json({
      success: false,
      error: 'Failed to validate FK',
      details: error instanceof Error ? error.message : 'Unknown error',
      migrationId,
    }, { status: 500 });
  }
}
