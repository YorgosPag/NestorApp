import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { buildFloorIndex, planHostedFloorBackfill, type FloorIndex } from '@/lib/floor/plan-hosted-floor-backfill';
import { processAdminBatch, BATCH_SIZE_READ } from '@/lib/admin-batch-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { generateParkingId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ACTIVE_RECORD_STATUS } from '@/lib/firestore/trashed-status';
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
    commercialStatus: template.commercialStatus,
    operationalStatus: template.operationalStatus,
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

/**
 * ADR-903 §6 — οι όροφοι του κτιρίου-στόχου (με την εταιρεία του **κατόχου**, CHECK 3.35) ως ευρετήριο για
 * τον **ίδιο** planner με τη μετανάστευση. Χωρίς κτίριο/εταιρεία ⇒ κενό ευρετήριο ⇒ οι θέσεις χωρίς όροφο.
 */
async function loadTargetFloors(): Promise<{ companyId: string | null; index: FloorIndex }> {
  const db = getAdminFirestore();
  const building = await db.collection(COLLECTIONS.BUILDINGS).doc(TARGET_BUILDING.id).get();
  const companyId = typeof building.data()?.companyId === 'string' ? (building.data()?.companyId as string) : null;
  if (!companyId) return { companyId: null, index: buildFloorIndex([]) };
  const floors = await db.collection(COLLECTIONS.FLOORS)
    .where(FIELDS.BUILDING_ID, '==', TARGET_BUILDING.id)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .get();
  return { companyId, index: buildFloorIndex(floors.docs.map((d) => ({ id: d.id, data: d.data() }))) };
}

/** Τα πεδία φιλοξενίας μιας θέσης του seed — από τον planner· ό,τι δεν λύνεται καταγράφεται, ΔΕΝ γράφεται. */
function hostedFieldsFor(template: (typeof PARKING_TEMPLATES)[number], companyId: string | null, index: FloorIndex) {
  const plan = planHostedFloorBackfill({ floor: template.floor, buildingId: TARGET_BUILDING.id, companyId }, index);
  if (plan.kind === 'write') return plan.fields;
  if (plan.kind === 'unresolved') {
    logger.warn('Seed parking floor not resolved — run seed-floors first', { number: template.number, reason: plan.reason });
  }
  return {};
}

export async function createSeedParkingSpots(): Promise<CreatedParkingSpotRecord[]> {
  const parkingRef = getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES);
  const createdSpots: CreatedParkingSpotRecord[] = [];
  const now = FieldValue.serverTimestamp();
  const { companyId, index } = await loadTargetFloors();

  for (const template of PARKING_TEMPLATES) {
    const parkingId = generateParkingId();
    const parkingDoc = {
      number: template.number,
      buildingId: TARGET_BUILDING.id,
      projectId: TARGET_BUILDING.projectId,
      ...(companyId ? { companyId } : {}),
      type: template.type,
      // ADR-777 §8.60.20: κάδος · διάθεση · λειτουργία — τρία πεδία, όχι ένα ανάμεικτο.
      status: ACTIVE_RECORD_STATUS,
      commercialStatus: template.commercialStatus,
      operationalStatus: template.operationalStatus,
      // ADR-903 §6 — `floorId` + αντίγραφο από τον όροφο (ποτέ ελεύθερο κείμενο).
      ...hostedFieldsFor(template, companyId, index),
      location: template.location,
      area: template.area,
      // ADR-777 §8.60.18: η τιμή ζει ανά ρόλο — το @deprecated `price` δεν γράφεται.
      commercial: { askingPrice: template.price },
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
