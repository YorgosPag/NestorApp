/**
 * ============================================================================
 * ADR-235: Ownership Auto-Populate & Linked Space Resolution
 * ============================================================================
 *
 * Extracted from ownership-table-service.ts (Google SRP — max 500 lines).
 * Handles row generation from building spaces and linked space enrichment.
 *
 * @module services/ownership/ownership-auto-populate
 */

import { getBuildingSpaces } from '@/services/building-spaces.service';
import type { ResolvedSpaceDoc } from '@/services/building-spaces.service';
import type {
  MutableOwnershipTableRow,
  LinkedSpaceDetail,
} from '@/types/ownership-table';

// ============================================================================
// LINKED SPACE RESOLVER
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
    hasOwnShares: false,
    millesimalShares: 0,
  };
}

// ============================================================================
// AUTO-POPULATE
// ============================================================================

/** Default row shape for an unassigned row with no owner data. */
function defaultOwnershipFields() {
  return {
    heightM: null,
    millesimalShares: 0,
    isManualOverride: false,
    coefficients: null,
    linkedSpacesSummary: null,
    ownerParty: 'unassigned' as const,
    owners: null,
    preliminaryContract: null,
    finalContract: null,
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

  // Collect all spaceIds that are linked to units
  const linkedSpaceIds = new Set<string>();
  for (const { data } of units) {
    const rawLinked = (data.linkedSpaces as Array<{ spaceId: string }>) ?? [];
    for (const ls of rawLinked) {
      if (ls.spaceId) linkedSpaceIds.add(ls.spaceId);
    }
  }

  // Unlinked parking → standalone rows
  for (const parkDoc of parking) {
    if (linkedSpaceIds.has(parkDoc.id)) continue;
    const lookup = spaceLookup.get(parkDoc.id);
    const entityCode = lookup?.entityCode ?? `P-${parkDoc.id.slice(-4)}`;
    const docBuildingId = (parkDoc.data.buildingId as string) ?? buildingIds[0] ?? '';
    const docBuildingName = units.find(u => u.buildingId === docBuildingId)?.buildingName ?? docBuildingId;
    ordinal++;
    rows.push({
      ordinal, buildingId: docBuildingId, buildingName: docBuildingName,
      entityRef: { collection: 'parking_spots', id: parkDoc.id }, entityCode,
      description: (parkDoc.data.name as string) ?? 'Θέση Στάθμευσης',
      category: 'auxiliary',
      floor: String(parkDoc.data.floor ?? parkDoc.data.floorNumber ?? '—'),
      areaNetSqm: (parkDoc.data.area as number) ?? 0,
      areaSqm: (parkDoc.data.area as number) ?? 0,
      participatesInCalculation: false,
      ...defaultOwnershipFields(),
    });
  }

  // Unlinked storage → standalone rows
  for (const storDoc of storage) {
    if (linkedSpaceIds.has(storDoc.id)) continue;
    const lookup = spaceLookup.get(storDoc.id);
    const entityCode = lookup?.entityCode ?? `S-${storDoc.id.slice(-4)}`;
    const docBuildingId = (storDoc.data.buildingId as string) ?? buildingIds[0] ?? '';
    const docBuildingName = units.find(u => u.buildingId === docBuildingId)?.buildingName ?? docBuildingId;
    ordinal++;
    rows.push({
      ordinal, buildingId: docBuildingId, buildingName: docBuildingName,
      entityRef: { collection: 'storage_units', id: storDoc.id }, entityCode,
      description: (storDoc.data.name as string) ?? 'Αποθήκη',
      category: 'auxiliary',
      floor: String(storDoc.data.floor ?? storDoc.data.floorNumber ?? '—'),
      areaNetSqm: (storDoc.data.area as number) ?? 0,
      areaSqm: (storDoc.data.area as number) ?? 0,
      participatesInCalculation: true,
      ...defaultOwnershipFields(),
    });
  }

  // Unit rows with fully resolved linkedSpacesSummary
  for (const { id, data, buildingId, buildingName } of units) {
    ordinal++;
    const rawLinked = (data.linkedSpaces as Array<{
      spaceId: string; spaceType: string; allocationCode?: string;
    }>) ?? [];

    const linkedSpacesSummary: LinkedSpaceDetail[] | null = rawLinked.length > 0
      ? rawLinked.map(ls =>
          resolveLinkedSpaceDetail(
            ls.spaceId,
            (ls.spaceType === 'parking' ? 'parking' : 'storage') as 'parking' | 'storage',
            ls.allocationCode, spaceLookup, parking, storage,
          ),
        )
      : null;

    rows.push({
      ordinal, buildingId, buildingName,
      entityRef: { collection: 'units', id },
      entityCode: (data.entityCode as string) ?? (data.code as string) ?? (data.unitCode as string) ?? `U-${ordinal}`,
      description: (data.name as string) ?? (data.description as string) ?? '',
      category: 'main',
      floor: String(data.floor ?? data.floorNumber ?? ''),
      areaNetSqm: ((data.areas as Record<string, number> | undefined)?.net as number) ?? (data.area as number) ?? 0,
      areaSqm: ((data.areas as Record<string, number> | undefined)?.gross as number) ?? (data.area as number) ?? 0,
      heightM: null, millesimalShares: 0, isManualOverride: false, coefficients: null,
      participatesInCalculation: true, linkedSpacesSummary,
      ownerParty: 'unassigned', owners: null,
      preliminaryContract: null, finalContract: null,
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
 * was implemented will have null. This function re-resolves them.
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
  const propertyDataMap = new Map(units.map(u => [u.id, u.data]));

  return rows.map(row => {
    if (row.entityRef.collection !== 'units' || row.linkedSpacesSummary !== null) return row;

    const propertyData = propertyDataMap.get(row.entityRef.id);
    if (!propertyData) return row;

    const rawLinked = (propertyData.linkedSpaces as Array<{
      spaceId: string; spaceType: string; allocationCode?: string;
    }>) ?? [];

    if (rawLinked.length === 0) return row;

    const linkedSpacesSummary: LinkedSpaceDetail[] = rawLinked.map(ls =>
      resolveLinkedSpaceDetail(
        ls.spaceId,
        (ls.spaceType === 'parking' ? 'parking' : 'storage') as 'parking' | 'storage',
        ls.allocationCode, spaceLookup, parking, storage,
      ),
    );

    return { ...row, linkedSpacesSummary };
  });
}
