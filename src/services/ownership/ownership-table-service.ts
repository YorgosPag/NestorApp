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
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type {
  OwnershipPercentageTable,
  MutableOwnershipPercentageTable,
  OwnershipTableRevision,
  OwnershipTableStatus,
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
// PROJECT DATA QUERIES (used by component — keeps Firestore logic in service)
// ============================================================================

/**
 * Get building IDs linked to a project.
 */
export async function getBuildingIdsByProject(projectId: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.BUILDINGS), where('projectId', '==', projectId)),
  );
  return snap.docs.map(d => d.id);
}

/** Validation result for building data before auto-populate */
export interface BuildingDataValidation {
  readonly totalFloors: number;
  readonly totalProperties: number;
  readonly unitsWithoutArea: number;
  readonly unitsWithoutFloor: number;
}

/**
 * Validate building data before auto-populate.
 * Checks floors, units, areas, floor assignments.
 */
export async function validateBuildingData(
  buildingIds: string[],
): Promise<BuildingDataValidation> {
  let totalFloors = 0;
  let totalProperties = 0;
  let unitsWithoutArea = 0;
  let unitsWithoutFloor = 0;

  for (const bId of buildingIds) {
    const floorsSnap = await getDocs(
      query(collection(db, COLLECTIONS.FLOORS), where('buildingId', '==', bId)),
    );
    totalFloors += floorsSnap.size;

    const unitsSnap = await getDocs(
      query(collection(db, COLLECTIONS.PROPERTIES), where('buildingId', '==', bId)),
    );
    totalProperties += unitsSnap.size;

    for (const unitDoc of unitsSnap.docs) {
      const data = unitDoc.data();
      const area = (data.area as number) ?? (data.areaSqm as number) ?? 0;
      if (area <= 0) unitsWithoutArea++;
      if (!data.floorId) unitsWithoutFloor++;
    }
  }

  return { totalFloors, totalProperties, unitsWithoutArea, unitsWithoutFloor };
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

  // After finalize: write millesimalShares to unit/storage Firestore documents
  const tableDoc = await getDoc(docRef);
  if (tableDoc.exists()) {
    const rows = (tableDoc.data().rows ?? []) as OwnershipPercentageTable['rows'];
    const writes: Promise<void>[] = [];

    for (const row of rows) {
      // Units — write millesimalShares
      if (row.entityRef.collection === 'units') {
        writes.push(
          setDoc(
            doc(db, COLLECTIONS.PROPERTIES, row.entityRef.id),
            { millesimalShares: row.millesimalShares },
            { merge: true },
          ),
        );
      }

      // Linked storage with own shares — write millesimalShares
      if (row.linkedSpacesSummary) {
        for (const ls of row.linkedSpacesSummary) {
          if (ls.hasOwnShares && ls.millesimalShares > 0) {
            writes.push(
              setDoc(
                doc(db, COLLECTIONS.STORAGE, ls.spaceId),
                { millesimalShares: ls.millesimalShares },
                { merge: true },
              ),
            );
          }
        }
      }
    }

    await Promise.all(writes);
  }
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
// AUTO-POPULATE & ENRICH (extracted to ownership-auto-populate.ts — Google SRP)
// ============================================================================
export { autoPopulateRows, enrichRowsWithLinkedSpaces } from './ownership-auto-populate';
