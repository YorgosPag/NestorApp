import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { processAdminBatch, BATCH_SIZE_READ } from '@/lib/admin-batch-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { generateParkingId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import type {
  CreatedParkingSpotRecord,
  ExistingParkingSpotRecord,
  ForeignKeyMigrationStats,
  ParkingPreviewRecord,
} from './parking-seed-types';
import { PARKING_PREVIEW_ID, PARKING_TEMPLATES, TARGET_BUILDING } from './parking-seed-config';

const logger = createModuleLogger('SeedParkingOperations');

export async function listExistingParkingSpots(): Promise<ExistingParkingSpotRecord[]> {
  const parkingRef = getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES);
  const existingSpots: ExistingParkingSpotRecord[] = [];

  await processAdminBatch(
    parkingRef,
    BATCH_SIZE_READ,
    (docs) => {
      for (const docSnapshot of docs) {
        existingSpots.push({ id: docSnapshot.id, ...docSnapshot.data() });
      }
    },
  );

  return existingSpots;
}

export function buildParkingPreviewRecords(): ParkingPreviewRecord[] {
  return PARKING_TEMPLATES.map((template) => ({
    number: template.number,
    previewId: PARKING_PREVIEW_ID,
    buildingId: TARGET_BUILDING.id,
    type: template.type,
    status: template.status,
  }));
}

export async function deleteAllParkingSpots(logEachDeletion = false): Promise<string[]> {
  const parkingRef = getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES);
  const deletedIds: string[] = [];

  await processAdminBatch(
    parkingRef,
    BATCH_SIZE_READ,
    async (docs) => {
      for (const docSnapshot of docs) {
        await parkingRef.doc(docSnapshot.id).delete();
        deletedIds.push(docSnapshot.id);

        if (logEachDeletion) {
          logger.info('Deleted parking spot', { id: docSnapshot.id });
        }
      }
    },
  );

  return deletedIds;
}

export async function createSeedParkingSpots(): Promise<CreatedParkingSpotRecord[]> {
  const parkingRef = getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES);
  const createdSpots: CreatedParkingSpotRecord[] = [];
  const now = FieldValue.serverTimestamp();

  for (const template of PARKING_TEMPLATES) {
    const parkingId = generateParkingId();
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
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-parking-api',
    };

    await parkingRef.doc(parkingId).set(parkingDoc);
    EntityAuditService.recordChange({
      entityType: 'parking',
      entityId: parkingId,
      entityName: String(template.number),
      action: 'created',
      changes: [{ field: 'buildingId', oldValue: null, newValue: TARGET_BUILDING.id, label: 'Building' }],
      performedBy: 'seed-parking-api',
      performedByName: null,
      companyId: 'system',
    }).catch(() => {});
    createdSpots.push({ id: parkingId, number: template.number });
    logger.info('Created parking spot', { parkingId, number: template.number });
  }

  return createdSpots;
}

export async function validateParkingForeignKeys(): Promise<ForeignKeyMigrationStats> {
  const parkingRef = getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES);
  const stats: ForeignKeyMigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    alreadyCorrect: 0,
    errors: 0,
    details: [],
  };

  await processAdminBatch(
    parkingRef,
    BATCH_SIZE_READ,
    (docs) => {
      stats.total += docs.length;

      for (const docSnapshot of docs) {
        const data = docSnapshot.data() as Record<string, unknown>;
        const currentBuildingId = typeof data.buildingId === 'string' ? data.buildingId : undefined;
        const currentProjectId = typeof data.projectId === 'string' ? data.projectId : undefined;
        const hasPrefixedBuilding = currentBuildingId?.startsWith('building_') ?? false;
        const hasPrefixedProject = currentProjectId?.startsWith('project_') ?? false;

        if (hasPrefixedBuilding || hasPrefixedProject) {
          stats.errors++;
          stats.details.push({
            id: docSnapshot.id,
            action: 'error',
            error: 'Has prefixed IDs (breaks tenant resolution): '
              + 'buildingId=' + currentBuildingId
              + ', projectId=' + currentProjectId
              + '. Run Re-seed to fix.',
          });
          logger.warn('Parking spot has prefixed IDs (WRONG)', {
            id: docSnapshot.id,
            buildingId: currentBuildingId,
            projectId: currentProjectId,
          });
          continue;
        }

        if (currentBuildingId && currentProjectId) {
          stats.alreadyCorrect++;
          stats.details.push({
            id: docSnapshot.id,
            action: 'already_correct',
          });
          logger.info('Parking spot correct (non-prefixed)', { id: docSnapshot.id });
          continue;
        }

        stats.skipped++;
        stats.details.push({
          id: docSnapshot.id,
          action: 'skipped',
          error: 'Missing buildingId or projectId',
        });
        logger.info('Parking spot missing buildingId/projectId', { id: docSnapshot.id });
      }
    },
  );

  return stats;
}
