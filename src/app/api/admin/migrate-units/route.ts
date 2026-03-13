/**
 * =============================================================================
 * MIGRATE UNITS - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * @purpose Migrates units from legacy IDs to enterprise structure
 * @author Enterprise Architecture Team
 * @protection withAuth + super_admin + audit logging
 * @classification Data migration operation (DELETE + CREATE)
 *
 * This endpoint performs unit migration:
 * 1. DELETES units with legacy buildingIds
 * 2. CREATES new units with Firebase auto-generated IDs
 * 3. Links them to enterprise buildings
 *
 * @method GET - Preview migration (dry run, read-only)
 * @method POST - Execute migration (DELETE + CREATE)
 *
 * @security Multi-layer protection:
 *   - Layer 1: withAuth (admin:data:fix permission)
 *   - Layer 2: super_admin role check (explicit)
 *   - Layer 3: Audit logging (logDataFix)
 *
 * @classification CRITICAL - Mass deletion + creation operation
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { processClientBatch, BATCH_SIZE_READ, BATCH_SIZE_WRITE } from '@/lib/admin-batch-utils';

// 🏢 ENTERPRISE: AUTHZ Phase 2 Imports
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MigrateUnitsRoute');

// 🏢 ENTERPRISE: Enterprise building για τις νέες μονάδες
const TARGET_ENTERPRISE_BUILDING = {
  id: 'G8kMxQ2pVwN5jR7tE1sA',
  name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
  projectId: 'xL2nV4bC6mZ8kJ9hG1fQ',
};

// 🏢 ENTERPRISE: Unit templates για τις νέες μονάδες
const UNIT_TEMPLATES = [
  {
    name: 'Διαμέρισμα Α1',
    type: 'apartment',
    status: 'for-sale',
    floor: 1,
    floorId: 'floor_1',
    area: 85,
    price: 180000,
    description: 'Διαμέρισμα 2 υπνοδωματίων με μπαλκόνι',
  },
  {
    name: 'Διαμέρισμα Α2',
    type: 'apartment',
    status: 'for-sale',
    floor: 1,
    floorId: 'floor_1',
    area: 95,
    price: 210000,
    description: 'Διαμέρισμα 3 υπνοδωματίων γωνιακό',
  },
  {
    name: 'Διαμέρισμα Β1',
    type: 'apartment',
    status: 'available',
    floor: 2,
    floorId: 'floor_2',
    area: 75,
    price: 165000,
    description: 'Διαμέρισμα 2 υπνοδωματίων με θέα',
  },
  {
    name: 'Στούντιο Γ1',
    type: 'studio',
    status: 'for-sale',
    floor: 3,
    floorId: 'floor_3',
    area: 45,
    price: 95000,
    description: 'Στούντιο ιδανικό για φοιτητές',
  },
  {
    name: 'Κατάστημα Ισογείου',
    type: 'shop',
    status: 'for-rent',
    floor: 0,
    floorId: 'floor_0',
    area: 120,
    price: 250000,
    description: 'Κατάστημα στο ισόγειο με βιτρίνα',
  },
  {
    name: 'Αποθήκη Υπογείου Α1',
    type: 'storage',
    status: 'available',
    floor: -1,
    floorId: 'floor_-1',
    area: 15,
    price: 12000,
    description: 'Αποθήκη στο υπόγειο',
  },
  {
    name: 'Μεζονέτα Δ1',
    type: 'maisonette',
    status: 'reserved',
    floor: 3,
    floorId: 'floor_3',
    area: 140,
    price: 320000,
    description: 'Μεζονέτα 3ου-4ου ορόφου με ταράτσα',
  },
];

interface UnitData {
  id: string;
  name: string;
  buildingId?: string;
  [key: string]: unknown;
}

/**
 * GET - Preview Migration (withAuth protected)
 * Read-only preview of units to be migrated.
 *
 * @security withAuth + super_admin check + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleMigrateUnitsPreview(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for GET (preview migration).
 */
async function handleMigrateUnitsPreview(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted unit migration preview', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    logger.info('Analyzing units for migration...');

    // ADR-214 Phase 8: Batch processing to prevent unbounded reads
    const units: UnitData[] = [];
    await processClientBatch(
      collection(db, COLLECTIONS.UNITS),
      [],
      BATCH_SIZE_READ,
      (docs) => {
        for (const docSnap of docs) {
          const data = docSnap.data();
          units.push({
            id: docSnap.id,
            name: data.name || 'UNNAMED',
            buildingId: data.buildingId,
            ...data,
          });
        }
      },
    );

    // Find legacy units (buildingId starts with "building_")
    const legacyUnits = units.filter((u) => {
      const bid = String(u.buildingId || '');
      return bid.startsWith('building_');
    });

    // Find enterprise units
    const enterpriseUnits = units.filter((u) => {
      const bid = String(u.buildingId || '');
      return !bid.startsWith('building_') && bid.length >= 20;
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mode: 'preview',
      totalUnits: units.length,
      legacyUnits: legacyUnits.length,
      enterpriseUnits: enterpriseUnits.length,
      legacyDetails: legacyUnits.map((u) => ({
        id: u.id,
        name: u.name,
        buildingId: u.buildingId,
      })),
      newUnitsToCreate: UNIT_TEMPLATES.length,
      targetBuilding: TARGET_ENTERPRISE_BUILDING,
      message: `Found ${legacyUnits.length} legacy units to delete. Will create ${UNIT_TEMPLATES.length} new enterprise units. Use POST to execute.`,
      executionTimeMs: duration,
    });
  } catch (error: unknown) {
    logger.error('Error analyzing units', { error });
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze units',
        details: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Execute Migration (withAuth protected)
 * DELETES legacy units + CREATES new enterprise units.
 *
 * @security withAuth + super_admin check + audit logging + admin:data:fix permission
 * @rateLimit SENSITIVE (20 req/min) - Admin operation
 */
export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleMigrateUnitsExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' }
));

/**
 * Internal handler for POST (execute migration).
 */
async function handleMigrateUnitsExecute(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🏢 ENTERPRISE: Super_admin-only check (explicit)
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted unit migration execution', { userId: ctx.uid, email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      },
      { status: 403 }
    );
  }

  try {
    logger.info('Starting unit migration...');

    // Step 1: Get all units (ADR-214 Phase 8: batched)
    const units: UnitData[] = [];
    await processClientBatch(
      collection(db, COLLECTIONS.UNITS),
      [],
      BATCH_SIZE_WRITE,
      (docs) => {
        for (const docSnap of docs) {
          const data = docSnap.data();
          units.push({
            id: docSnap.id,
            name: data.name || 'UNNAMED',
            buildingId: data.buildingId,
            ...data,
          });
        }
      },
    );

    // Step 2: Find and delete legacy units
    const legacyUnits = units.filter((u) => {
      const bid = String(u.buildingId || '');
      return bid.startsWith('building_');
    });

    logger.info('Deleting legacy units', { count: legacyUnits.length });

    let deletedCount = 0;
    for (const unit of legacyUnits) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.UNITS, unit.id));
        deletedCount++;
        logger.info('Deleted unit', { unitId: unit.id, unitName: unit.name });
      } catch (err) {
        logger.error('Failed to delete unit', { unitId: unit.id, error: err });
      }
    }

    // Step 3: Create new enterprise units
    logger.info('Creating new enterprise units', { count: UNIT_TEMPLATES.length });

    const createdUnits: Array<{ id: string; name: string }> = [];

    for (const template of UNIT_TEMPLATES) {
      try {
        const newUnit = {
          ...template,
          buildingId: TARGET_ENTERPRISE_BUILDING.id,
          projectId: TARGET_ENTERPRISE_BUILDING.projectId,
          building: TARGET_ENTERPRISE_BUILDING.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // 🏢 ENTERPRISE: addDoc creates auto-generated Firebase ID (20 chars)
        const docRef = await addDoc(collection(db, COLLECTIONS.UNITS), newUnit);
        createdUnits.push({ id: docRef.id, name: template.name });
        logger.info('Created unit', { unitId: docRef.id, unitName: template.name });
      } catch (err) {
        logger.error('Failed to create unit', { unitName: template.name, error: err });
      }
    }

    const duration = Date.now() - startTime;

    // 🏢 ENTERPRISE: Audit logging (non-blocking)
    const metadata = extractRequestMetadata(request);
    await logDataFix(
      ctx,
      'migrate_units_legacy_to_enterprise',
      {
        operation: 'migrate-units',
        deleted: deletedCount,
        created: createdUnits.length,
        targetBuilding: TARGET_ENTERPRISE_BUILDING,
        createdUnits: createdUnits.map(u => ({ id: u.id, name: u.name })),
        executionTimeMs: duration,
        result: 'success',
        metadata,
      },
      `Unit migration by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      message: `Migration complete! Deleted ${deletedCount} legacy units, created ${createdUnits.length} enterprise units.`,
      deleted: deletedCount,
      created: createdUnits.length,
      createdUnits,
      targetBuilding: TARGET_ENTERPRISE_BUILDING,
      executionTimeMs: duration,
    });
  } catch (error: unknown) {
    logger.error('Error during migration', { error });
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to migrate units',
        details: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: duration,
      },
      { status: 500 }
    );
  }
}
