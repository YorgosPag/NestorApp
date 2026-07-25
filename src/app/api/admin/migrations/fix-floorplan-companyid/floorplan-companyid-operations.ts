/**
 * =============================================================================
 * fix-floorplan-companyid — migration operations (ADR-704 split)
 * =============================================================================
 *
 * Load / map-build / resolve / analyze helpers for the floorplan companyId
 * migration. Extracted from the route so route.ts stays under the N.7.1
 * 300-line limit and each helper stays under the 40-line limit.
 *
 * @module api/admin/migrations/fix-floorplan-companyid/operations
 * @enterprise ADR-031 - Canonical File Storage System
 * @see ADR-704 — Admin Migration-Runner SSoT
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FixFloorplanCompanyId');

// =============================================================================
// TYPES
// =============================================================================

export interface FileRecordDoc {
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

export interface MigrationResult {
  fileRecordId: string;
  entityType: string;
  entityId: string;
  oldCompanyId: string;
  newCompanyId: string;
  resolvedVia: string;
  fileName?: string;
}

export interface EntityMaps {
  floorToBuilding: Map<string, string>;
  floorCompany: Map<string, string>;
  buildingCompany: Map<string, string>;
  unitsByBuilding: Map<string, string>;
}

export interface FloorplanAnalysis {
  mismatches: MigrationResult[];
  alreadyCorrect: string[];
  unresolvable: Array<{ id: string; entityType: string; entityId: string; currentCompanyId: string }>;
}

// =============================================================================
// STEP 1: Load all floorplan FileRecords (floor + building)
// =============================================================================

export async function loadFloorplanRecords(db: Firestore): Promise<FileRecordDoc[]> {
  const floorSnap = await db
    .collection(COLLECTIONS.FILES)
    .where(FIELDS.ENTITY_TYPE, '==', 'floor')
    .where('category', '==', 'floorplans')
    .where(FIELDS.IS_DELETED, '==', false)
    .get();

  const buildingSnap = await db
    .collection(COLLECTIONS.FILES)
    .where(FIELDS.ENTITY_TYPE, '==', 'building')
    .where('category', '==', 'floorplans')
    .where(FIELDS.IS_DELETED, '==', false)
    .get();

  const records: FileRecordDoc[] = [
    ...floorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileRecordDoc)),
    ...buildingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileRecordDoc)),
  ];

  logger.info('Found floorplan FileRecords', {
    floor: floorSnap.size,
    building: buildingSnap.size,
    total: records.length,
  });

  return records;
}

// =============================================================================
// STEP 2: Build entity lookup maps
// =============================================================================

async function buildFloorMaps(
  db: Firestore,
  floorIds: Set<string>,
): Promise<{ floorToBuilding: Map<string, string>; floorCompany: Map<string, string>; extraBuildingIds: Set<string> }> {
  const floorToBuilding = new Map<string, string>();
  const floorCompany = new Map<string, string>();
  const extraBuildingIds = new Set<string>();

  if (floorIds.size === 0) {
    return { floorToBuilding, floorCompany, extraBuildingIds };
  }

  const floorsSnap = await db.collection(COLLECTIONS.FLOORS).get();
  for (const doc of floorsSnap.docs) {
    const data = doc.data();
    // Floor docs may use enterprise ID (flr_xxx) as doc ID or as a field
    const enterpriseId = (data.enterpriseId as string) || doc.id;
    if (floorIds.has(doc.id) || floorIds.has(enterpriseId)) {
      const key = floorIds.has(doc.id) ? doc.id : enterpriseId;
      floorToBuilding.set(key, data.buildingId as string);
      if (data.companyId) floorCompany.set(key, data.companyId as string);
      if (data.buildingId) extraBuildingIds.add(data.buildingId as string);
    }
  }

  return { floorToBuilding, floorCompany, extraBuildingIds };
}

async function buildBuildingCompanyMap(db: Firestore, buildingIds: Set<string>): Promise<Map<string, string>> {
  const buildingCompany = new Map<string, string>();
  if (buildingIds.size === 0) return buildingCompany;

  const buildingsSnap = await db.collection(COLLECTIONS.BUILDINGS).get();
  for (const doc of buildingsSnap.docs) {
    const data = doc.data();
    if (buildingIds.has(doc.id) && data.companyId) {
      buildingCompany.set(doc.id, data.companyId as string);
    }
  }

  return buildingCompany;
}

async function buildUnitsByBuildingMap(db: Firestore, buildingIds: Set<string>): Promise<Map<string, string>> {
  const unitsByBuilding = new Map<string, string>();

  const unitsSnap = await db.collection(COLLECTIONS.PROPERTIES).get();
  for (const doc of unitsSnap.docs) {
    const data = doc.data();
    const buildingId = data.buildingId as string | undefined;
    // First unit's companyId wins
    if (buildingId && data.companyId && buildingIds.has(buildingId) && !unitsByBuilding.has(buildingId)) {
      unitsByBuilding.set(buildingId, data.companyId as string);
    }
  }

  return unitsByBuilding;
}

export async function buildEntityMaps(db: Firestore, records: FileRecordDoc[]): Promise<EntityMaps> {
  const floorIds = new Set<string>();
  const buildingIds = new Set<string>();

  for (const rec of records) {
    if (rec.entityType === 'floor') floorIds.add(rec.entityId);
    else if (rec.entityType === 'building') buildingIds.add(rec.entityId);
  }

  const { floorToBuilding, floorCompany, extraBuildingIds } = await buildFloorMaps(db, floorIds);
  for (const id of extraBuildingIds) buildingIds.add(id);

  const buildingCompany = await buildBuildingCompanyMap(db, buildingIds);
  const unitsByBuilding = await buildUnitsByBuildingMap(db, buildingIds);

  logger.info('Lookup maps built', {
    floors: floorToBuilding.size,
    buildingCompanies: buildingCompany.size,
    unitsByBuilding: unitsByBuilding.size,
  });

  return { floorToBuilding, floorCompany, buildingCompany, unitsByBuilding };
}

// =============================================================================
// STEP 3: Resolve correct companyId + find mismatches
// =============================================================================

/**
 * Priority: unit.companyId (what the Ευρετήριο load query uses) → floor.companyId
 * → building.companyId. unit.companyId MUST win — it matches the read path.
 */
export function resolveCompanyId(
  rec: FileRecordDoc,
  maps: EntityMaps,
): { companyId?: string; resolvedVia: string } {
  const viaUnit = 'unit.companyId (via building) — matches Ευρετήριο load query';

  if (rec.entityType === 'floor') {
    const buildingId = maps.floorToBuilding.get(rec.entityId);
    const unitCompany = buildingId ? maps.unitsByBuilding.get(buildingId) : undefined;
    if (unitCompany) return { companyId: unitCompany, resolvedVia: viaUnit };

    const directFloorCompany = maps.floorCompany.get(rec.entityId);
    if (directFloorCompany) return { companyId: directFloorCompany, resolvedVia: 'floor.companyId' };

    const buildingCompany = buildingId ? maps.buildingCompany.get(buildingId) : undefined;
    if (buildingCompany) return { companyId: buildingCompany, resolvedVia: 'building.companyId' };

    return { resolvedVia: '' };
  }

  if (rec.entityType === 'building') {
    const unitCompany = maps.unitsByBuilding.get(rec.entityId);
    if (unitCompany) return { companyId: unitCompany, resolvedVia: viaUnit };

    const buildingCompany = maps.buildingCompany.get(rec.entityId);
    if (buildingCompany) return { companyId: buildingCompany, resolvedVia: 'building.companyId' };
  }

  return { resolvedVia: '' };
}

export function analyzeFloorplans(records: FileRecordDoc[], maps: EntityMaps): FloorplanAnalysis {
  const mismatches: MigrationResult[] = [];
  const alreadyCorrect: string[] = [];
  const unresolvable: FloorplanAnalysis['unresolvable'] = [];

  for (const rec of records) {
    const { companyId: correctCompanyId, resolvedVia } = resolveCompanyId(rec, maps);

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
    total: records.length,
    alreadyCorrect: alreadyCorrect.length,
    mismatches: mismatches.length,
    unresolvable: unresolvable.length,
  });

  return { mismatches, alreadyCorrect, unresolvable };
}
