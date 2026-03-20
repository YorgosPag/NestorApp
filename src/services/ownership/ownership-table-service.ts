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
  MutableOwnershipTableRow,
  OwnershipTableStatus,
  CalculationMethod,
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
  const totalShares = data.rows.reduce((sum, r) => sum + r.millesimalShares, 0);

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

    // Validate total
    const total = currentData.rows.reduce(
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

// ============================================================================
// AUTO-POPULATE
// ============================================================================

/**
 * Fetch units + closed parking + storage with millesimalShares from Firestore
 * Returns rows ready for calculation
 */
export async function autoPopulateRows(
  projectId: string,
  buildingIds: string[],
): Promise<MutableOwnershipTableRow[]> {
  const rows: MutableOwnershipTableRow[] = [];
  let ordinal = 0;

  // For each building, fetch units, then parking, then storage
  for (const buildingId of buildingIds) {
    // --- Fetch building name ---
    const buildingDoc = await getDoc(doc(db, COLLECTIONS.BUILDINGS, buildingId));
    const buildingName = buildingDoc.exists()
      ? (buildingDoc.data().name as string) ?? buildingId
      : buildingId;

    // --- UNITS (always have millesimal shares) ---
    const unitsRef = collection(db, COLLECTIONS.UNITS);
    const unitsQuery = query(
      unitsRef,
      where('buildingId', '==', buildingId),
    );
    const unitsSnap = await getDocs(unitsQuery);

    for (const unitDoc of unitsSnap.docs) {
      const data = unitDoc.data();
      ordinal++;
      rows.push({
        ordinal,
        buildingId,
        buildingName,
        entityRef: { collection: 'units', id: unitDoc.id },
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
        ownerParty: 'unassigned',
        buyerContactId: null,
      });
    }

    // --- CLOSED PARKING (with millesimalShares > 0) ---
    const parkingRef = collection(db, COLLECTIONS.PARKING_SPACES);
    const parkingQuery = query(
      parkingRef,
      where('buildingId', '==', buildingId),
    );
    const parkingSnap = await getDocs(parkingQuery);

    for (const parkDoc of parkingSnap.docs) {
      const data = parkDoc.data();
      const shares = (data.millesimalShares as number) ?? 0;
      // Only include if it has millesimal shares (= closed parking/garage)
      if (shares > 0 || data.type === 'closed' || data.type === 'garage') {
        ordinal++;
        rows.push({
          ordinal,
          buildingId,
          buildingName,
          entityRef: { collection: 'parking_spots', id: parkDoc.id },
          entityCode: (data.entityCode as string) ?? (data.code as string) ?? `P-${ordinal}`,
          description: (data.name as string) ?? (data.description as string) ?? 'Θέση Στάθμευσης',
          category: 'auxiliary',
          floor: String(data.floor ?? data.floorNumber ?? 'Υπόγειο'),
          areaNetSqm: (data.area as number) ?? 0,
          areaSqm: (data.area as number) ?? (data.areaSqm as number) ?? 0,
          heightM: null,
          millesimalShares: 0,
          isManualOverride: false,
          coefficients: null,
          ownerParty: 'unassigned',
          buyerContactId: null,
        });
      }
    }

    // --- STORAGE UNITS (with millesimalShares > 0) ---
    const storageRef = collection(db, COLLECTIONS.STORAGE);
    const storageQuery = query(
      storageRef,
      where('buildingId', '==', buildingId),
    );
    const storageSnap = await getDocs(storageQuery);

    for (const storDoc of storageSnap.docs) {
      const data = storDoc.data();
      const shares = (data.millesimalShares as number) ?? 0;
      if (shares > 0 || data.hasMillesimalShares === true) {
        ordinal++;
        rows.push({
          ordinal,
          buildingId,
          buildingName,
          entityRef: { collection: 'storage_units', id: storDoc.id },
          entityCode: (data.entityCode as string) ?? (data.code as string) ?? `S-${ordinal}`,
          description: (data.name as string) ?? (data.description as string) ?? 'Αποθήκη',
          category: 'auxiliary',
          floor: String(data.floor ?? data.floorNumber ?? 'Υπόγειο'),
          areaNetSqm: (data.area as number) ?? 0,
          areaSqm: (data.area as number) ?? (data.areaSqm as number) ?? 0,
          heightM: null,
          millesimalShares: 0,
          isManualOverride: false,
          coefficients: null,
          ownerParty: 'unassigned',
          buyerContactId: null,
        });
      }
    }
  }

  return rows;
}
