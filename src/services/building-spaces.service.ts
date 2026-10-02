/**
 * ============================================================================
 * Building → Spaces Resolution Service — ο αναγνώστης **client SDK**
 * ============================================================================
 *
 * Ο κανόνας «ποιοι χώροι είναι του κτιρίου» ΔΕΝ ζει εδώ: ζει στο
 * `lib/building-spaces/building-space-membership.ts` (ADR-898 §20 — θέση ≠ ανάθεση),
 * κοινός με τον Admin SDK. Εδώ μόνο ο αναγνώστης και το σχήμα του πίνακα ποσοστών
 * (ADR-235). Ως 02/10 ζούσε ένας δεύτερος κανόνας εδώ, που έφερνε χώρο άλλου κτιρίου
 * ως δικό του και δεν απέκλειε τον κάδο.
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
import {
  BUILDING_SPACE_KINDS,
  readBuildingSpaceMembership,
  type BuildingSpaceKind,
  type BuildingSpaceReader,
  type SpaceRecord,
} from '@/lib/building-spaces/building-space-membership';
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
  readonly spaceType: BuildingSpaceKind;
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
  /** Οι θέσεις που **μετρούν** στα κτίρια (βρίσκονται εκεί). */
  readonly parking: ReadonlyArray<ResolvedSpaceDoc>;
  /** Οι αποθήκες που **μετρούν** στα κτίρια (βρίσκονται εκεί). */
  readonly storage: ReadonlyArray<ResolvedSpaceDoc>;
  /** Χώροι μονάδων των κτιρίων που βρίσκονται σε **άλλο** κτίριο — μόνο για αναφορά, ποτέ γραμμή/σύνολο. */
  readonly references: ReadonlyArray<ResolvedSpaceDoc & { readonly spaceType: BuildingSpaceKind; readonly locatedInBuildingId: string }>;
  readonly units: ReadonlyArray<ResolvedUnitDoc>;
  /** Κωδικός ανά χώρο — μετρούμενοι **και** αναφορές (η μονάδα δείχνει όλους τους χώρους της). */
  readonly spaceLookup: ReadonlyMap<string, SpaceLookupEntry>;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Ο ανθρώπινος κωδικός ενός χώρου, από τα πεδία του κατά είδος. */
function resolveSpaceCode(kind: BuildingSpaceKind, id: string, data: Record<string, unknown>): string {
  const text = (raw: unknown) => (typeof raw === 'string' && raw !== '' ? raw : null);
  if (kind === 'parking') {
    return text(data.entityCode) ?? text(data.code) ?? text(data.number) ?? text(data.parkingNumber) ?? `P-${id.slice(-4)}`;
  }
  return text(data.entityCode) ?? text(data.code) ?? `S-${id.slice(-4)}`;
}

const COLLECTION_OF: Readonly<Record<BuildingSpaceKind, string>> = {
  parking: COLLECTIONS.PARKING_SPACES,
  storage: COLLECTIONS.STORAGE,
};

/** Ο αναγνώστης client SDK του κανόνα. */
const clientReader: BuildingSpaceReader = {
  spacesLocatedIn: async (kind, buildingId) => {
    const snapshot = await getDocs(query(
      // 🔒 companyId: N/A — `parking_spots` / `storage_units` have no companyId field; tenant isolation
      // via buildingId → `belongsToBuildingCompany(buildingId)` in Firestore rules.
      collection(db, COLLECTION_OF[kind]),
      where('buildingId', '==', buildingId),
    ));
    return snapshot.docs.map((spaceDoc) => ({ id: spaceDoc.id, data: spaceDoc.data() }));
  },
  spaceById: async (spaceId): Promise<SpaceRecord | null> => {
    for (const kind of BUILDING_SPACE_KINDS) {
      const snapshot = await getDoc(doc(db, COLLECTION_OF[kind], spaceId));
      if (snapshot.exists()) return { id: spaceId, kind, data: snapshot.data() };
    }
    return null;
  },
};

async function readUnitsOf(buildingId: string): Promise<ResolvedUnitDoc[]> {
  const buildingDoc = await getDoc(doc(db, COLLECTIONS.BUILDINGS, buildingId));
  const rawName = buildingDoc.exists() ? buildingDoc.data().name : undefined;
  const buildingName = typeof rawName === 'string' ? rawName : buildingId;
  // tenant-scope-exempt: τα κτίρια έρχονται ήδη ελεγμένα στον μισθωτή (πίνακας ποσοστών του έργου)· μια μονάδα μπορεί
  // νόμιμα να φέρει άλλο `companyId` από το κτίριό της (ίδιο δόγμα με το `api/properties` και τον Admin αναγνώστη του
  // κανόνα), και οι κανόνες Firestore κρίνουν μέσω έργου (`belongsToProjectCompany`). ⚠️ Το παλιό σχόλιο «το
  // `properties` δεν έχει πεδίο companyId» ήταν ανακριβές — το έχει.
  const unitsSnap = await getDocs(query(
    // 🔒 companyId: N/A — εμβέλεια μέσω κτιρίου/έργου (βλ. τη δήλωση tenant-scope-exempt ακριβώς πάνω).
    collection(db, COLLECTIONS.PROPERTIES),
    where('buildingId', '==', buildingId),
  ));
  return unitsSnap.docs.map((unitDoc) => ({ id: unitDoc.id, data: unitDoc.data(), buildingId, buildingName }));
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Οι χώροι των κτιρίων (ο ΕΝΑΣ κανόνας, ADR-898 §20) + οι μονάδες τους + κωδικοί.
 * Οι κάτοχοι ορίζονται από τις μονάδες **αυτών** των κτιρίων.
 */
export async function getBuildingSpaces(
  buildingIds: ReadonlyArray<string>,
): Promise<BuildingSpacesResult> {
  const units = (await Promise.all(buildingIds.map(readUnitsOf))).flat();
  const owningUnits = units.map((unit) => ({ ...unit.data, id: unit.id, buildingId: unit.buildingId }));
  const { counted, references } = await readBuildingSpaceMembership(clientReader, buildingIds, owningUnits);

  const spaceLookup = new Map<string, SpaceLookupEntry>();
  for (const space of [...counted, ...references]) {
    spaceLookup.set(space.id, { entityCode: resolveSpaceCode(space.kind, space.id, space.data), spaceType: space.kind });
  }
  const ofKind = (kind: BuildingSpaceKind) => counted.filter((space) => space.kind === kind).map(({ id, data }) => ({ id, data }));

  logger.info(
    `Resolved ${counted.length} spaces (+${references.length} elsewhere) + ${units.length} units for ${buildingIds.length} building(s)`,
  );

  return {
    parking: ofKind('parking'),
    storage: ofKind('storage'),
    references: references.map(({ id, data, kind, locatedInBuildingId }) => ({ id, data, spaceType: kind, locatedInBuildingId })),
    units,
    spaceLookup,
  };
}
