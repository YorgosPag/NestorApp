import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { EntityAuditService } from '@/services/entity-audit.service';

const logger = createModuleLogger('NormalizeFloorsRoute');

interface BuildingRecord {
  id: string;
  name: string;
  projectId: string;
  projectName?: string;
  project?: string;
  companyId?: string;
  buildingFloors?: Array<{
    id: string;
    name: string;
    number: number;
    units?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface FloorRecord {
  id: string;
  name: string;
  number: number;
  buildingId: string;
  buildingName: string;
  projectId: string;
  projectName?: string;
  units?: number;
  createdAt: string;
  migrationInfo: {
    migrationId: string;
    migratedAt: string;
    sourceType: string;
    originalBuildingId: string;
  };
}

interface VerificationFloor {
  id: string;
  buildingId?: string;
  migrationInfo?: { migrationId?: string };
}

export async function handleFloorsNormalization(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const startTime = Date.now();

  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted database normalization', { email: ctx.email, globalRole: ctx.globalRole });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute database normalization migrations',
        message: 'Database normalization is a system-level operation restricted to super_admin'
      },
      { status: 403 }
    );
  }

  logger.info('Database normalization request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

  try {
    logger.info('ENTERPRISE DATABASE NORMALIZATION STARTING - Floors Collection (3NF)');

    const adminDb = getAdminFirestore();

    logger.info('Step 1: Analyzing buildings with embedded floors...');
    const buildingsSnapshot = await adminDb.collection(COLLECTIONS.BUILDINGS).get();
    const buildings: BuildingRecord[] = buildingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as BuildingRecord[];

    logger.info('Found buildings', { count: buildings.length });

    const stats = { buildingsWithFloors: 0, buildingsWithoutFloors: 0, totalFloorsToExtract: 0 };
    const floorsToCreate: FloorRecord[] = [];

    for (const building of buildings) {
      if (building.buildingFloors && Array.isArray(building.buildingFloors) && building.buildingFloors.length > 0) {
        stats.buildingsWithFloors++;
        stats.totalFloorsToExtract += building.buildingFloors.length;

        for (const embeddedFloor of building.buildingFloors) {
          floorsToCreate.push({
            id: embeddedFloor.id || `floor_${building.id}_${embeddedFloor.number}`,
            name: embeddedFloor.name,
            number: embeddedFloor.number,
            buildingId: building.id,
            buildingName: building.name,
            projectId: building.projectId,
            projectName: building.projectName || building.project,
            units: embeddedFloor.units || 0,
            createdAt: new Date().toISOString(),
            migrationInfo: {
              migrationId: '002_normalize_floors_collection_admin',
              migratedAt: new Date().toISOString(),
              sourceType: 'buildingFloors_embedded_array',
              originalBuildingId: building.id
            }
          });
        }
      } else {
        stats.buildingsWithoutFloors++;
      }
    }

    logger.info('Analysis Results', stats);

    logger.info('Step 2: Inserting normalized floors...');
    const BATCH_SIZE = 500;
    let successfulInserts = 0;
    let failedInserts = 0;

    for (let i = 0; i < floorsToCreate.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const batchFloors = floorsToCreate.slice(i, i + BATCH_SIZE);

      for (const floor of batchFloors) {
        batch.set(adminDb.collection(COLLECTIONS.FLOORS).doc(floor.id), floor);
      }

      try {
        await batch.commit();
        for (const floor of batchFloors) {
          const buildingCompanyId = buildings.find(b => b.id === floor.buildingId)?.companyId ?? 'system';
          EntityAuditService.recordChange({
            entityType: 'floor',
            entityId: floor.id,
            entityName: floor.name,
            action: 'created',
            changes: [{ field: 'buildingId', oldValue: null, newValue: floor.buildingId, label: 'Building' }],
            performedBy: ctx.uid,
            performedByName: ctx.email ?? null,
            companyId: buildingCompanyId,
          }).catch(() => {});
        }
        successfulInserts += batchFloors.length;
        logger.info('Batch committed successfully', { floorsInBatch: batchFloors.length });
      } catch (error) {
        failedInserts += batchFloors.length;
        logger.error('Batch failed', { error: getErrorMessage(error) });
      }
    }

    logger.info('Step 3: Verifying normalization integrity...');
    const floorsSnapshot = await adminDb.collection(COLLECTIONS.FLOORS).get();
    const createdFloors: VerificationFloor[] = floorsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        buildingId: data.buildingId as string | undefined,
        migrationInfo: data.migrationInfo as { migrationId?: string } | undefined
      };
    });

    const integrityResults = { totalFloors: createdFloors.length, floorsWithValidBuildingIds: 0, floorsFromThisMigration: 0, orphanFloors: 0 };

    for (const floor of createdFloors) {
      if (floor.migrationInfo?.migrationId === '002_normalize_floors_collection_admin') {
        integrityResults.floorsFromThisMigration++;
      }
      if (buildings.some(b => b.id === floor.buildingId)) {
        integrityResults.floorsWithValidBuildingIds++;
      } else {
        integrityResults.orphanFloors++;
      }
    }

    const integrityScore = (integrityResults.floorsWithValidBuildingIds / integrityResults.totalFloors) * 100;

    logger.info('Final Results', { ...integrityResults, successfulInserts, failedInserts, referentialIntegrityPercent: integrityScore.toFixed(1) });

    if (failedInserts > 0) throw new Error(`${failedInserts} floor inserts failed`);

    const executionTime = Date.now() - startTime;
    const metadata = extractRequestMetadata(request);

    await logMigrationExecuted(
      ctx,
      '002_normalize_floors_collection_admin',
      {
        migrationName: 'Floors Collection Normalization (Enterprise 3NF)',
        method: 'firebase_admin_batch_normalization',
        affectedRecords: successfulInserts,
        executionTimeMs: executionTime,
        buildingsWithFloors: stats.buildingsWithFloors,
        totalFloorsExtracted: stats.totalFloorsToExtract,
        integrityScore: parseFloat(integrityScore.toFixed(1)),
        referentialIntegrity: {
          totalFloors: integrityResults.totalFloors,
          validFloors: integrityResults.floorsWithValidBuildingIds,
          orphanFloors: integrityResults.orphanFloors,
        },
        result: 'success',
        metadata,
      },
      `Database normalization executed by ${ctx.globalRole} ${ctx.email}`
    ).catch((err: unknown) => {
      logger.warn('Audit logging failed (non-blocking)', { error: err });
    });

    return NextResponse.json({
      success: true,
      migration: { id: '002_normalize_floors_collection_admin', name: 'Floors Collection Normalization (Enterprise 3NF)', method: 'firebase_admin_batch_normalization' },
      execution: { executionTimeMs: executionTime, affectedRecords: successfulInserts, completedAt: new Date().toISOString() },
      results: {
        stats,
        floorsCreated: floorsToCreate.map(f => ({ id: f.id, name: f.name, buildingName: f.buildingName, projectName: f.projectName })),
        integrity: { totalFloors: integrityResults.totalFloors, floorsFromMigration: integrityResults.floorsFromThisMigration, integrityScore: parseFloat(integrityScore.toFixed(1)), orphanFloors: integrityResults.orphanFloors }
      },
      environment: { nodeEnv: process.env.NODE_ENV, timestamp: new Date().toISOString(), system: 'Nestor Pagonis Enterprise Platform - Database Normalization' }
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);
    logger.error('ENTERPRISE NORMALIZATION FAILED', { error: errorMessage });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        execution: { executionTimeMs: executionTime, failedAt: new Date().toISOString() },
        environment: { nodeEnv: process.env.NODE_ENV, timestamp: new Date().toISOString(), system: 'Nestor Pagonis Enterprise Platform - Database Normalization' }
      },
      { status: 500 }
    );
  }
}
