/**
 * =============================================================================
 * MIGRATION: Fix companyId mismatch in floor/building floorplan FileRecords
 * =============================================================================
 *
 * Before commit d9a56120, the DXF wizard saved floorplan FileRecords with
 * `selectedCompanyId` (contact entity ID) instead of the property's companyId.
 * ReadOnlyMediaViewer queries with the property's companyId, so these
 * floorplans were invisible in the Ευρετήριο Ακινήτων view.
 *
 * This migration:
 * 1. Finds all FileRecords with entityType 'floor' or 'building' + category 'floorplans'
 * 2. Resolves the correct companyId from the floor/building's units
 * 3. Dry-run by default (GET) — execute with POST
 *
 * @module api/admin/migrations/fix-floorplan-companyid
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * 🔒 SECURITY: Protected with RBAC — super_admin ONLY
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FixFloorplanCompanyId');

// =============================================================================
// TYPES
// =============================================================================

interface FileRecordDoc {
  id: string;
  entityType: string;
  entityId: string;
  companyId: string;
  category: string;
  purpose?: string;
  domain?: string;
  status: string;
  isDeleted: boolean;
  fileName?: string;
  storagePath?: string;
}

interface MigrationResult {
  fileRecordId: string;
  entityType: string;
  entityId: string;
  oldCompanyId: string;
  newCompanyId: string;
  resolvedVia: string;
  fileName?: string;
}

// =============================================================================
// GET — Dry-run analysis
// =============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleMigration(ctx, true);
    },
    { permissions: 'admin:migrations:execute' }
  ));

  return handler(request);
}

// =============================================================================
// POST — Execute migration
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleMigration(ctx, false, req);
    },
    { permissions: 'admin:migrations:execute' }
  ));

  return handler(request);
}

// =============================================================================
// CORE MIGRATION LOGIC
// =============================================================================

async function handleMigration(
  ctx: AuthContext,
  dryRun: boolean,
  request?: NextRequest
): Promise<NextResponse> {
  const startTime = Date.now();

  // 🔐 Super_admin ONLY
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted floorplan companyId migration', {
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return NextResponse.json(
      { success: false, error: 'Forbidden: Only super_admin can execute this migration' },
      { status: 403 }
    );
  }

  logger.info(`Floorplan companyId migration ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`, {
    email: ctx.email,
  });

  try {
    const adminDb = getAdminFirestore();

    // ========================================================================
    // STEP 1: Load all floorplan FileRecords (floor + building)
    // ========================================================================

    logger.info('Step 1: Loading floorplan FileRecords...');

    const floorFloorplansSnapshot = await adminDb
      .collection(COLLECTIONS.FILES)
      .where(FIELDS.ENTITY_TYPE, '==', 'floor')
      .where('category', '==', 'floorplans')
      .where(FIELDS.IS_DELETED, '==', false)
      .get();

    const buildingFloorplansSnapshot = await adminDb
      .collection(COLLECTIONS.FILES)
      .where(FIELDS.ENTITY_TYPE, '==', 'building')
      .where('category', '==', 'floorplans')
      .where(FIELDS.IS_DELETED, '==', false)
      .get();

    const allFloorplanRecords: FileRecordDoc[] = [
      ...floorFloorplansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileRecordDoc)),
      ...buildingFloorplansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileRecordDoc)),
    ];

    logger.info('Found floorplan FileRecords', {
      floor: floorFloorplansSnapshot.size,
      building: buildingFloorplansSnapshot.size,
      total: allFloorplanRecords.length,
    });

    // ========================================================================
    // STEP 2: Build lookup maps for floors, buildings, units
    // ========================================================================

    logger.info('Step 2: Building entity lookup maps...');

    // Collect unique entityIds
    const floorIds = new Set<string>();
    const buildingIds = new Set<string>();

    for (const rec of allFloorplanRecords) {
      if (rec.entityType === 'floor') {
        floorIds.add(rec.entityId);
      } else if (rec.entityType === 'building') {
        buildingIds.add(rec.entityId);
      }
    }

    // Load floors to get buildingId
    const floorToBuildingMap = new Map<string, string>();
    const floorCompanyMap = new Map<string, string>();

    if (floorIds.size > 0) {
      const floorsSnapshot = await adminDb.collection(COLLECTIONS.FLOORS).get();
      for (const doc of floorsSnapshot.docs) {
        const data = doc.data();
        // Floor docs may use enterprise ID (flr_xxx) as doc ID or as a field
        const enterpriseId = (data.enterpriseId as string) || doc.id;
        if (floorIds.has(doc.id) || floorIds.has(enterpriseId)) {
          const key = floorIds.has(doc.id) ? doc.id : enterpriseId;
          floorToBuildingMap.set(key, data.buildingId as string);
          if (data.companyId) {
            floorCompanyMap.set(key, data.companyId as string);
          }
          // Also add the buildingId to our set
          if (data.buildingId) {
            buildingIds.add(data.buildingId as string);
          }
        }
      }
    }

    // Load buildings to get companyId
    const buildingCompanyMap = new Map<string, string>();
    if (buildingIds.size > 0) {
      const buildingsSnapshot = await adminDb.collection(COLLECTIONS.BUILDINGS).get();
      for (const doc of buildingsSnapshot.docs) {
        const data = doc.data();
        if (buildingIds.has(doc.id) && data.companyId) {
          buildingCompanyMap.set(doc.id, data.companyId as string);
        }
      }
    }

    // Load units to find companyId via units that reference these buildings/floors
    const unitsByBuilding = new Map<string, string>(); // buildingId → companyId
    const unitsSnapshot = await adminDb.collection(COLLECTIONS.UNITS).get();
    for (const doc of unitsSnapshot.docs) {
      const data = doc.data();
      if (data.buildingId && data.companyId && buildingIds.has(data.buildingId as string)) {
        // First unit's companyId wins
        if (!unitsByBuilding.has(data.buildingId as string)) {
          unitsByBuilding.set(data.buildingId as string, data.companyId as string);
        }
      }
    }

    logger.info('Lookup maps built', {
      floors: floorToBuildingMap.size,
      buildingCompanies: buildingCompanyMap.size,
      unitsByBuilding: unitsByBuilding.size,
    });

    // ========================================================================
    // STEP 3: Resolve correct companyId and find mismatches
    // ========================================================================

    logger.info('Step 3: Resolving companyId mismatches...');

    const mismatches: MigrationResult[] = [];
    const alreadyCorrect: string[] = [];
    const unresolvable: Array<{ id: string; entityType: string; entityId: string; currentCompanyId: string }> = [];

    for (const rec of allFloorplanRecords) {
      let correctCompanyId: string | undefined;
      let resolvedVia = '';

      if (rec.entityType === 'floor') {
        // Priority: unit.companyId (what ReadOnlyMediaViewer queries with) → floor.companyId → building.companyId
        // IMPORTANT: The Ευρετήριο Ακινήτων uses property.companyId for load queries,
        // which comes from units — so unit.companyId MUST take precedence
        const buildingId = floorToBuildingMap.get(rec.entityId);
        const unitCompany = buildingId ? unitsByBuilding.get(buildingId) : undefined;
        if (unitCompany) {
          correctCompanyId = unitCompany;
          resolvedVia = 'unit.companyId (via building) — matches Ευρετήριο load query';
        } else {
          const directFloorCompany = floorCompanyMap.get(rec.entityId);
          if (directFloorCompany) {
            correctCompanyId = directFloorCompany;
            resolvedVia = 'floor.companyId';
          } else if (buildingId) {
            const buildingCompany = buildingCompanyMap.get(buildingId);
            if (buildingCompany) {
              correctCompanyId = buildingCompany;
              resolvedVia = 'building.companyId';
            }
          }
        }
      } else if (rec.entityType === 'building') {
        // Priority: unit.companyId → building.companyId
        const unitCompany = unitsByBuilding.get(rec.entityId);
        if (unitCompany) {
          correctCompanyId = unitCompany;
          resolvedVia = 'unit.companyId (via building) — matches Ευρετήριο load query';
        } else {
          const buildingCompany = buildingCompanyMap.get(rec.entityId);
          if (buildingCompany) {
            correctCompanyId = buildingCompany;
            resolvedVia = 'building.companyId';
          }
        }
      }

      if (!correctCompanyId) {
        unresolvable.push({
          id: rec.id,
          entityType: rec.entityType,
          entityId: rec.entityId,
          currentCompanyId: rec.companyId,
        });
        continue;
      }

      if (rec.companyId === correctCompanyId) {
        alreadyCorrect.push(rec.id);
      } else {
        mismatches.push({
          fileRecordId: rec.id,
          entityType: rec.entityType,
          entityId: rec.entityId,
          oldCompanyId: rec.companyId,
          newCompanyId: correctCompanyId,
          resolvedVia,
          fileName: rec.fileName,
        });
      }
    }

    logger.info('Analysis complete', {
      total: allFloorplanRecords.length,
      alreadyCorrect: alreadyCorrect.length,
      mismatches: mismatches.length,
      unresolvable: unresolvable.length,
    });

    // ========================================================================
    // STEP 4: Apply fixes (if not dry-run)
    // ========================================================================

    let updated = 0;

    if (!dryRun && mismatches.length > 0) {
      logger.info('Step 4: Applying companyId fixes...');

      // Batch update (max 500 per batch in Firestore)
      const batchSize = 400;
      for (let i = 0; i < mismatches.length; i += batchSize) {
        const batch = adminDb.batch();
        const chunk = mismatches.slice(i, i + batchSize);

        for (const mismatch of chunk) {
          const docRef = adminDb.collection(COLLECTIONS.FILES).doc(mismatch.fileRecordId);
          batch.update(docRef, {
            companyId: mismatch.newCompanyId,
            updatedAt: new Date(),
            migrationNote: `companyId fixed from ${mismatch.oldCompanyId} → ${mismatch.newCompanyId} (${mismatch.resolvedVia}) [fix-floorplan-companyid migration ${new Date().toISOString()}]`,
          });
        }

        await batch.commit();
        updated += chunk.length;
        logger.info(`Batch committed: ${updated}/${mismatches.length}`);
      }

      // Audit log
      if (request) {
        const metadata = extractRequestMetadata(request);
        await logMigrationExecuted(ctx, 'fix-floorplan-companyid', {
          ...metadata,
          totalRecords: allFloorplanRecords.length,
          mismatches: mismatches.length,
          updated,
          alreadyCorrect: alreadyCorrect.length,
          unresolvable: unresolvable.length,
        });
      }
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      dryRun,
      duration: `${durationMs}ms`,
      summary: {
        totalFloorplanRecords: allFloorplanRecords.length,
        alreadyCorrect: alreadyCorrect.length,
        mismatches: mismatches.length,
        unresolvable: unresolvable.length,
        updated,
      },
      mismatches: mismatches.map(m => ({
        fileRecordId: m.fileRecordId,
        entityType: m.entityType,
        entityId: m.entityId,
        oldCompanyId: m.oldCompanyId,
        newCompanyId: m.newCompanyId,
        resolvedVia: m.resolvedVia,
        fileName: m.fileName,
      })),
      unresolvable,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Migration failed', { error: errorMessage });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
