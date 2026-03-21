/**
 * ============================================================================
 * Building → Spaces Resolution Service (SSoT)
 * ============================================================================
 *
 * Centralized service that resolves ALL parking + storage spaces for given
 * building IDs. Handles the dual-path resolution:
 *   1. Direct query by buildingId (spaces that have buildingId set)
 *   2. Indirect via units' linkedSpaces (spaces linked to units but missing buildingId)
 *
 * @module services/building-spaces
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingSpacesService');

// ============================================================================
// TYPES
// ============================================================================

/** Raw Firestore document data with its ID */
export interface ResolvedSpaceDoc {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

/** Lookup entry for linkedSpacesSummary resolution */
export interface SpaceLookupEntry {
  readonly entityCode: string;
  readonly spaceType: 'parking' | 'storage';
}

/** Unit document with associated building context */
export interface ResolvedUnitDoc {
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly buildingId: string;
  readonly buildingName: string;
}

/** Combined result from building spaces resolution */
export interface BuildingSpacesResult {
  readonly parking: ReadonlyArray<ResolvedSpaceDoc>;
  readonly storage: ReadonlyArray<ResolvedSpaceDoc>;
  readonly units: ReadonlyArray<ResolvedUnitDoc>;
  readonly spaceLookup: ReadonlyMap<string, SpaceLookupEntry>;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Resolve a human-readable entity code from parking doc data */
function resolveParkingCode(id: string, data: Record<string, unknown>): string {
  return (data.entityCode as string)
    ?? (data.code as string)
    ?? (data.number as string)
    ?? (data.parkingNumber as string)
    ?? `P-${id.slice(-4)}`;
}

/** Resolve a human-readable entity code from storage doc data */
function resolveStorageCode(id: string, data: Record<string, unknown>): string {
  return (data.entityCode as string)
    ?? (data.code as string)
    ?? `S-${id.slice(-4)}`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Resolve ALL parking + storage spaces for the given building IDs.
 *
 * Algorithm:
 * 1. Per building: query units → extract linkedSpaces IDs
 * 2. Per building: query parking/storage by buildingId → add to results
 * 3. Compute missingIds = linkedSpaceIds − seenIds
 * 4. Fetch missing individually (parking first, then storage)
 * 5. Build spaceLookup Map for linkedSpacesSummary resolution
 */
export async function getBuildingSpaces(
  buildingIds: ReadonlyArray<string>,
): Promise<BuildingSpacesResult> {
  const parking: ResolvedSpaceDoc[] = [];
  const storage: ResolvedSpaceDoc[] = [];
  const units: ResolvedUnitDoc[] = [];
  const spaceLookup = new Map<string, SpaceLookupEntry>();
  const seenIds = new Set<string>();
  const linkedSpaceIds = new Set<string>();

  for (const buildingId of buildingIds) {
    // --- Fetch building name ---
    const buildingDoc = await getDoc(doc(db, COLLECTIONS.BUILDINGS, buildingId));
    const buildingName = buildingDoc.exists()
      ? (buildingDoc.data().name as string) ?? buildingId
      : buildingId;

    // --- UNITS: always have buildingId ---
    const unitsRef = collection(db, COLLECTIONS.UNITS);
    const unitsQuery = query(unitsRef, where('buildingId', '==', buildingId));
    const unitsSnap = await getDocs(unitsQuery);

    for (const unitDoc of unitsSnap.docs) {
      units.push({
        id: unitDoc.id,
        data: unitDoc.data() as Record<string, unknown>,
        buildingId,
        buildingName,
      });

      const rawLinked = (unitDoc.data().linkedSpaces as Array<{ spaceId: string }>) ?? [];
      for (const ls of rawLinked) {
        if (ls.spaceId) linkedSpaceIds.add(ls.spaceId);
      }
    }

    // --- PARKING by buildingId ---
    const parkingRef = collection(db, COLLECTIONS.PARKING_SPACES);
    const parkingQuery = query(parkingRef, where('buildingId', '==', buildingId));
    const parkingSnap = await getDocs(parkingQuery);

    for (const parkDoc of parkingSnap.docs) {
      if (seenIds.has(parkDoc.id)) continue;
      seenIds.add(parkDoc.id);
      const data = parkDoc.data() as Record<string, unknown>;
      parking.push({ id: parkDoc.id, data });
      spaceLookup.set(parkDoc.id, {
        entityCode: resolveParkingCode(parkDoc.id, data),
        spaceType: 'parking',
      });
    }

    // --- STORAGE by buildingId ---
    const storageRef = collection(db, COLLECTIONS.STORAGE);
    const storageQuery = query(storageRef, where('buildingId', '==', buildingId));
    const storageSnap = await getDocs(storageQuery);

    for (const storDoc of storageSnap.docs) {
      if (seenIds.has(storDoc.id)) continue;
      seenIds.add(storDoc.id);
      const data = storDoc.data() as Record<string, unknown>;
      storage.push({ id: storDoc.id, data });
      spaceLookup.set(storDoc.id, {
        entityCode: resolveStorageCode(storDoc.id, data),
        spaceType: 'storage',
      });
    }
  }

  // --- Fetch linked spaces NOT found by buildingId query ---
  const missingIds = [...linkedSpaceIds].filter(id => !seenIds.has(id));

  if (missingIds.length > 0) {
    logger.info(`Fetching ${missingIds.length} linked spaces not found by buildingId query`);
  }

  for (const spaceId of missingIds) {
    // Try parking first
    const parkDoc = await getDoc(doc(db, COLLECTIONS.PARKING_SPACES, spaceId));
    if (parkDoc.exists()) {
      seenIds.add(spaceId);
      const data = parkDoc.data() as Record<string, unknown>;
      parking.push({ id: spaceId, data });
      spaceLookup.set(spaceId, {
        entityCode: resolveParkingCode(spaceId, data),
        spaceType: 'parking',
      });
      continue;
    }

    // Try storage
    const storDoc = await getDoc(doc(db, COLLECTIONS.STORAGE, spaceId));
    if (storDoc.exists()) {
      seenIds.add(spaceId);
      const data = storDoc.data() as Record<string, unknown>;
      storage.push({ id: spaceId, data });
      spaceLookup.set(spaceId, {
        entityCode: resolveStorageCode(spaceId, data),
        spaceType: 'storage',
      });
    }
  }

  logger.info(
    `Resolved ${parking.length} parking + ${storage.length} storage + ${units.length} units for ${buildingIds.length} building(s)`,
  );

  return { parking, storage, units, spaceLookup };
}
