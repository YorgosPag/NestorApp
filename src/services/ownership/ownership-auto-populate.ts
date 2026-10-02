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
import type { BuildingSpacesResult, ResolvedSpaceDoc } from '@/services/building-spaces.service';
import type {
  MutableOwnershipTableRow,
  LinkedSpaceDetail,
} from '@/types/ownership-table';

// ============================================================================
// LINKED SPACE RESOLVER
// ============================================================================

/**
 * Τα έγγραφα για την **περιγραφή** των παρακολουθημάτων: οι μετρούμενοι χώροι **και** όσοι βρίσκονται σε άλλο κτίριο
 * (ADR-898 §20) — η μονάδα δείχνει όλους τους χώρους της. ⛔ Μόνο για αναζήτηση· αυτοτελείς γραμμές βγαίνουν
 * **μόνο** από τους μετρούμενους.
 */
function withReferences(spaces: BuildingSpacesResult): { parking: ResolvedSpaceDoc[]; storage: ResolvedSpaceDoc[] } {
  const refs = (kind: 'parking' | 'storage') => spaces.references.filter((ref) => ref.spaceType === kind);
  return { parking: [...spaces.parking, ...refs('parking')], storage: [...spaces.storage, ...refs('storage')] };
}

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
// STANDALONE SPACE ROW
// ============================================================================

/**
 * Ό,τι διαφέρει ανά είδος σε αυτοτελή γραμμή χώρου. ⚠️ Οι περιγραφές-εφεδρείες είναι **αποθηκευμένα δεδομένα** του
 * πίνακα (όχι ετικέτα οθόνης) και έμειναν όπως ήταν — η μετάβασή τους σε i18n θέλει απόφαση για τους υπάρχοντες πίνακες.
 */
const STANDALONE_SPACE = {
  parking: { collection: 'parking_spots', codePrefix: 'P', fallbackDescription: 'Θέση Στάθμευσης', participates: false },
  storage: { collection: 'storage_units', codePrefix: 'S', fallbackDescription: 'Αποθήκη', participates: true },
} as const;

interface StandaloneContext {
  readonly spaceLookup: ReadonlyMap<string, { entityCode: string }>;
  readonly units: BuildingSpacesResult['units'];
  readonly fallbackBuildingId: string;
}

/** Χώρος χωρίς μονάδα → αυτοτελής γραμμή (μία συνάρτηση για θέση και αποθήκη — ήταν δύο δίδυμα blocks). */
function standaloneSpaceRow(
  kind: keyof typeof STANDALONE_SPACE,
  spaceDoc: ResolvedSpaceDoc,
  ordinal: number,
  ctx: StandaloneContext,
): MutableOwnershipTableRow {
  const spec = STANDALONE_SPACE[kind];
  const { data } = spaceDoc;
  const buildingId = (data.buildingId as string) ?? ctx.fallbackBuildingId;
  return {
    ordinal,
    buildingId,
    buildingName: ctx.units.find(u => u.buildingId === buildingId)?.buildingName ?? buildingId,
    entityRef: { collection: spec.collection, id: spaceDoc.id },
    entityCode: ctx.spaceLookup.get(spaceDoc.id)?.entityCode ?? `${spec.codePrefix}-${spaceDoc.id.slice(-4)}`,
    description: (data.name as string) ?? spec.fallbackDescription,
    category: 'auxiliary',
    floor: String(data.floor ?? data.floorNumber ?? '—'),
    areaNetSqm: (data.area as number) ?? 0,
    areaSqm: (data.area as number) ?? 0,
    participatesInCalculation: spec.participates,
    ...defaultOwnershipFields(),
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

  const spaces = await getBuildingSpaces(buildingIds);
  const { parking, storage, units, spaceLookup } = spaces;
  const { parking: allParking, storage: allStorage } = withReferences(spaces);

  // Collect all spaceIds that are linked to units
  const linkedSpaceIds = new Set<string>();
  for (const { data } of units) {
    const rawLinked = (data.linkedSpaces as Array<{ spaceId: string }>) ?? [];
    for (const ls of rawLinked) {
      if (ls.spaceId) linkedSpaceIds.add(ls.spaceId);
    }
  }

  // Unlinked parking/storage → standalone rows (parking first, then storage — η σειρά που είχαν)
  const standalone = { spaceLookup, units, fallbackBuildingId: buildingIds[0] ?? '' };
  for (const [kind, docs] of [['parking', parking], ['storage', storage]] as const) {
    for (const spaceDoc of docs) {
      if (linkedSpaceIds.has(spaceDoc.id)) continue;
      ordinal++;
      rows.push(standaloneSpaceRow(kind, spaceDoc, ordinal, standalone));
    }
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
            ls.allocationCode, spaceLookup, allParking, allStorage,
          ),
        )
      : null;

    rows.push({
      ordinal, buildingId, buildingName,
      entityRef: { collection: 'properties', id },
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
    r => r.entityRef.collection === 'properties' && r.linkedSpacesSummary === null,
  );

  if (!needsEnrichment || buildingIds.length === 0) return rows;

  const spaces = await getBuildingSpaces(buildingIds);
  const { units, spaceLookup } = spaces;
  const { parking: allParking, storage: allStorage } = withReferences(spaces);
  const propertyDataMap = new Map(units.map(u => [u.id, u.data]));

  return rows.map(row => {
    if (row.entityRef.collection !== 'properties' || row.linkedSpacesSummary !== null) return row;

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
        ls.allocationCode, spaceLookup, allParking, allStorage,
      ),
    );

    return { ...row, linkedSpacesSummary };
  });
}
