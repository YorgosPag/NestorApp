/**
 * ============================================================================
 * ADR-235: Ownership Table Service — Firestore CRUD
 * ============================================================================
 *
 * Service for creating, reading, updating, and managing ownership tables.
 * One table per project/plot (οικόπεδο).
 *
 * @module services/ownership/ownership-table-service
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { getBuildingSpaces } from '@/services/building-spaces.service';
import type { ResolvedSpaceDoc } from '@/services/building-spaces.service';
import type {
  OwnershipPercentageTable,
  MutableOwnershipPercentageTable,
  OwnershipTableRevision,
  MutableOwnershipTableRow,
  OwnershipTableStatus,
  LinkedSpaceDetail,
} from '@/types/ownership-table';
import { TOTAL_SHARES_TARGET } from '@/types/ownership-table';
import {
  calculateCategorySummary,
} from './ownership-calculation-engine';

// ============================================================================
// HELPERS
// ============================================================================

function generateTableId(projectId: string): string {
  return `ownership_${projectId}`;
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get ownership table for a project (one per project)
 */
export async function getTable(
  projectId: string,
): Promise<OwnershipPercentageTable | null> {
  const tableId = generateTableId(projectId);
  const docRef = doc(db, COLLECTIONS.OWNERSHIP_TABLES, tableId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  return { id: snapshot.id, ...snapshot.data() } as OwnershipPercentageTable;
}

/**
 * Get revision history for a table
 */
export async function getRevisions(
  tableId: string,
): Promise<OwnershipTableRevision[]> {
  const revisionsRef = collection(
    db,
    COLLECTIONS.OWNERSHIP_TABLES,
    tableId,
    SUBCOLLECTIONS.OWNERSHIP_REVISIONS,
  );
  const q = query(revisionsRef, orderBy('version', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as OwnershipTableRevision[];
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create a new ownership table for a project
 */
export async function createTable(
  projectId: string,
  buildingIds: string[],
): Promise<OwnershipPercentageTable> {
  const tableId = generateTableId(projectId);
  const now = Timestamp.now();

  const table: Omit<OwnershipPercentageTable, 'id'> = {
    projectId,
    buildingIds,
    createdAt: now,
    updatedAt: now,
    zonePrice: 0,
    commercialityCoefficient: 1.0,
    calculationMethod: 'area',
    rows: [],
    totalShares: 0,
    summaryByCategory: {
      main: { count: 0, shares: 0 },
      auxiliary: { count: 0, shares: 0 },
    },
    bartex: null,
    notes: null,
    deedNumber: null,
    notary: null,
    kaekCodes: null,
    status: 'draft',
    version: 1,
  };

  await setDoc(doc(db, COLLECTIONS.OWNERSHIP_TABLES, tableId), table);

  return { id: tableId, ...table };
}

/**
 * Save (update) an ownership table
 */
export async function saveTable(
  table: MutableOwnershipPercentageTable,
): Promise<void> {
  const { id, ...data } = table;

  const summary = calculateCategorySummary(data.rows);
  const totalShares = data.rows.filter(r => r.participatesInCalculation !== false).reduce((sum, r) => sum + r.millesimalShares, 0);

  const updateData = {
    ...data,
    totalShares,
    summaryByCategory: summary,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTIONS.OWNERSHIP_TABLES, id), updateData, { merge: true });
}

/**
 * Finalize (lock) a table — creates a revision snapshot
 */
export async function finalizeTable(
  tableId: string,
  userId: string,
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.OWNERSHIP_TABLES, tableId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);

    if (!snapshot.exists()) {
      throw new Error(`Table ${tableId} not found`);
    }

    const currentData = snapshot.data() as Omit<OwnershipPercentageTable, 'id'>;

    // Validate total (only participating rows)
    const total = currentData.rows
      .filter((r: { participatesInCalculation?: boolean }) => r.participatesInCalculation !== false)
      .reduce(
        (sum: number, r: { millesimalShares: number }) => sum + r.millesimalShares,
        0,
      );
    if (total !== TOTAL_SHARES_TARGET) {
      throw new Error(
        `Cannot finalize: total shares = ${total}‰, expected ${TOTAL_SHARES_TARGET}‰`,
      );
    }

    // Create revision
    const revisionId = `rev_v${currentData.version}`;
    const revisionRef = doc(
      db,
      COLLECTIONS.OWNERSHIP_TABLES,
      tableId,
      SUBCOLLECTIONS.OWNERSHIP_REVISIONS,
      revisionId,
    );

    const revision: Omit<OwnershipTableRevision, 'id'> = {
      version: currentData.version,
      snapshot: {
        projectId: currentData.projectId,
        buildingIds: currentData.buildingIds,
        createdAt: currentData.createdAt,
        updatedAt: currentData.updatedAt,
        zonePrice: currentData.zonePrice,
        commercialityCoefficient: currentData.commercialityCoefficient,
        calculationMethod: currentData.calculationMethod,
        rows: currentData.rows,
        totalShares: currentData.totalShares,
        summaryByCategory: currentData.summaryByCategory,
        bartex: currentData.bartex,
        notes: currentData.notes,
        deedNumber: currentData.deedNumber,
        notary: currentData.notary,
        kaekCodes: currentData.kaekCodes,
        status: 'finalized',
      },
      finalizedBy: userId,
      finalizedAt: Timestamp.now(),
      changeReason: null,
    };

    transaction.set(revisionRef, revision);

    // Update table status
    transaction.set(
      docRef,
      {
        status: 'finalized' as OwnershipTableStatus,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}

/**
 * Unlock a finalized table — bumps version
 */
export async function unlockTable(
  tableId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.OWNERSHIP_TABLES, tableId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);

    if (!snapshot.exists()) {
      throw new Error(`Table ${tableId} not found`);
    }

    const currentData = snapshot.data() as Omit<OwnershipPercentageTable, 'id'>;

    if (currentData.status !== 'finalized') {
      throw new Error(`Table ${tableId} is not finalized (status: ${currentData.status})`);
    }

    transaction.set(
      docRef,
      {
        status: 'draft' as OwnershipTableStatus,
        version: currentData.version + 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}

/**
 * Delete a draft ownership table. Only drafts can be deleted.
 * Throws if table is finalized/registered.
 */
export async function deleteDraftTable(projectId: string): Promise<void> {
  const tableId = generateTableId(projectId);
  const docRef = doc(db, COLLECTIONS.OWNERSHIP_TABLES, tableId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return;

  const data = snapshot.data();
  if (data.status === 'finalized' || data.status === 'registered') {
    throw new Error('Δεν μπορεί να διαγραφεί οριστικοποιημένος πίνακας');
  }

  await deleteDoc(docRef);
}

// ============================================================================
// AUTO-POPULATE
// ============================================================================

/**
 * Resolve a LinkedSpaceDetail from a space document or fallback data.
 */
function resolveLinkedSpaceDetail(
  spaceId: string,
  spaceType: 'parking' | 'storage',
  allocationCode: string | undefined,
  spaceLookup: ReadonlyMap<string, { entityCode: string; spaceType: 'parking' | 'storage' }>,
  parking: ReadonlyArray<ResolvedSpaceDoc>,
  storage: ReadonlyArray<ResolvedSpaceDoc>,
): LinkedSpaceDetail {
  const lookupEntry = spaceLookup.get(spaceId);
  const entityCode = lookupEntry?.entityCode ?? allocationCode ?? spaceId.slice(-6);

  // Find the actual document for full data
  const doc = spaceType === 'parking'
    ? parking.find(p => p.id === spaceId)
    : storage.find(s => s.id === spaceId);

  const docData = doc?.data;

  return {
    spaceId,
    entityCode,
    spaceType,
    description: (docData?.name as string)
      ?? (docData?.description as string)
      ?? (spaceType === 'parking' ? 'Θέση Στάθμευσης' : 'Αποθήκη'),
    floor: String(docData?.floor ?? docData?.floorNumber ?? '—'),
    areaNetSqm: (docData?.area as number) ?? 0,
    areaSqm: (docData?.area as number) ?? (docData?.areaSqm as number) ?? 0,
  };
}

/**
 * Fetch units and resolve their linked spaces (parking/storage) as tree children.
 *
 * Architecture:
 * - Linked parking/storage = παρακολουθήματα (appurtenances) → tree children of parent unit
 * - Unlinked parking/storage = αυτοτελείς → standalone rows (if any exist without unit linkage)
 * - Units = κύριες ιδιοκτησίες → main rows with linkedSpacesSummary
 */
export async function autoPopulateRows(
  projectId: string,
  buildingIds: string[],
): Promise<MutableOwnershipTableRow[]> {
  const rows: MutableOwnershipTableRow[] = [];
  let ordinal = 0;

  const { parking, storage, units, spaceLookup } = await getBuildingSpaces(buildingIds);

  // --- Collect all spaceIds that are linked to units ---
  const linkedSpaceIds = new Set<string>();
  for (const { data } of units) {
    const rawLinked = (data.linkedSpaces as Array<{ spaceId: string }>) ?? [];
    for (const ls of rawLinked) {
      if (ls.spaceId) linkedSpaceIds.add(ls.spaceId);
    }
  }

  // --- UNLINKED parking/storage → standalone rows (αυτοτελείς ιδιοκτησίες) ---
  for (const parkDoc of parking) {
    if (linkedSpaceIds.has(parkDoc.id)) continue; // Skip — will appear as tree child
    const lookup = spaceLookup.get(parkDoc.id);
    const entityCode = lookup?.entityCode ?? `P-${parkDoc.id.slice(-4)}`;
    const docBuildingId = (parkDoc.data.buildingId as string) ?? buildingIds[0] ?? '';
    const docBuildingName = units.find(u => u.buildingId === docBuildingId)?.buildingName ?? docBuildingId;
    ordinal++;
    rows.push({
      ordinal,
      buildingId: docBuildingId,
      buildingName: docBuildingName,
      entityRef: { collection: 'parking_spots', id: parkDoc.id },
      entityCode,
      description: (parkDoc.data.name as string) ?? 'Θέση Στάθμευσης',
      category: 'auxiliary',
      floor: String(parkDoc.data.floor ?? parkDoc.data.floorNumber ?? '—'),
      areaNetSqm: (parkDoc.data.area as number) ?? 0,
      areaSqm: (parkDoc.data.area as number) ?? 0,
      heightM: null,
      millesimalShares: 0,
      isManualOverride: false,
      coefficients: null,
      participatesInCalculation: false,
      linkedSpacesSummary: null,
      ownerParty: 'unassigned',
      buyerContactId: null,
    });
  }

  for (const storDoc of storage) {
    if (linkedSpaceIds.has(storDoc.id)) continue; // Skip — will appear as tree child
    const lookup = spaceLookup.get(storDoc.id);
    const entityCode = lookup?.entityCode ?? `S-${storDoc.id.slice(-4)}`;
    const docBuildingId = (storDoc.data.buildingId as string) ?? buildingIds[0] ?? '';
    const docBuildingName = units.find(u => u.buildingId === docBuildingId)?.buildingName ?? docBuildingId;
    ordinal++;
    rows.push({
      ordinal,
      buildingId: docBuildingId,
      buildingName: docBuildingName,
      entityRef: { collection: 'storage_units', id: storDoc.id },
      entityCode,
      description: (storDoc.data.name as string) ?? 'Αποθήκη',
      category: 'auxiliary',
      floor: String(storDoc.data.floor ?? storDoc.data.floorNumber ?? '—'),
      areaNetSqm: (storDoc.data.area as number) ?? 0,
      areaSqm: (storDoc.data.area as number) ?? 0,
      heightM: null,
      millesimalShares: 0,
      isManualOverride: false,
      coefficients: null,
      participatesInCalculation: true,
      linkedSpacesSummary: null,
      ownerParty: 'unassigned',
      buyerContactId: null,
    });
  }

  // --- UNIT rows with fully resolved linkedSpacesSummary ---
  for (const { id, data, buildingId, buildingName } of units) {
    ordinal++;

    const rawLinked = (data.linkedSpaces as Array<{
      spaceId: string;
      spaceType: string;
      allocationCode?: string;
    }>) ?? [];

    const linkedSpacesSummary: LinkedSpaceDetail[] | null = rawLinked.length > 0
      ? rawLinked.map(ls =>
          resolveLinkedSpaceDetail(
            ls.spaceId,
            (ls.spaceType === 'parking' ? 'parking' : 'storage') as 'parking' | 'storage',
            ls.allocationCode,
            spaceLookup,
            parking,
            storage,
          ),
        )
      : null;

    rows.push({
      ordinal,
      buildingId,
      buildingName,
      entityRef: { collection: 'units', id },
      entityCode: (data.entityCode as string) ?? (data.code as string) ?? (data.unitCode as string) ?? `U-${ordinal}`,
      description: (data.name as string) ?? (data.description as string) ?? '',
      category: 'main',
      floor: String(data.floor ?? data.floorNumber ?? ''),
      areaNetSqm: ((data.areas as Record<string, number> | undefined)?.net as number) ?? (data.area as number) ?? 0,
      areaSqm: ((data.areas as Record<string, number> | undefined)?.gross as number) ?? (data.area as number) ?? 0,
      heightM: null,
      millesimalShares: 0,
      isManualOverride: false,
      coefficients: null,
      participatesInCalculation: true,
      linkedSpacesSummary,
      ownerParty: 'unassigned',
      buyerContactId: null,
    });
  }

  return rows;
}

// ============================================================================
// ENRICH LINKED SPACES (for saved tables missing linkedSpacesSummary)
// ============================================================================

/**
 * Enrich saved rows with linkedSpacesSummary data.
 *
 * When a table is loaded from Firestore, rows saved before linkedSpacesSummary
 * was implemented will have null. This function re-resolves them by reading
 * the unit documents' linkedSpaces field from Firestore.
 *
 * Works even if parking/storage documents don't exist as separate Firestore
 * documents — falls back to allocationCode from the unit's linkedSpaces data.
 */
export async function enrichRowsWithLinkedSpaces(
  rows: MutableOwnershipTableRow[],
  buildingIds: string[],
): Promise<MutableOwnershipTableRow[]> {
  const needsEnrichment = rows.some(
    r => r.entityRef.collection === 'units' && r.linkedSpacesSummary === null,
  );

  if (!needsEnrichment || buildingIds.length === 0) return rows;

  const { parking, storage, units, spaceLookup } = await getBuildingSpaces(buildingIds);
  const unitDataMap = new Map(units.map(u => [u.id, u.data]));

  return rows.map(row => {
    if (row.entityRef.collection !== 'units' || row.linkedSpacesSummary !== null) {
      return row;
    }

    const unitData = unitDataMap.get(row.entityRef.id);
    if (!unitData) return row;

    const rawLinked = (unitData.linkedSpaces as Array<{
      spaceId: string;
      spaceType: string;
      allocationCode?: string;
    }>) ?? [];

    if (rawLinked.length === 0) return row;

    const linkedSpacesSummary: LinkedSpaceDetail[] = rawLinked.map(ls =>
      resolveLinkedSpaceDetail(
        ls.spaceId,
        (ls.spaceType === 'parking' ? 'parking' : 'storage') as 'parking' | 'storage',
        ls.allocationCode,
        spaceLookup,
        parking,
        storage,
      ),
    );

    return { ...row, linkedSpacesSummary };
  });
}
