/**
 * @fileoverview **Ο αναγνώστης Admin SDK** του κανόνα «ποιοι χώροι είναι του κτιρίου» (ADR-898 §20) — μοιράζεται από τον
 * πίνακα αντικειμενικής και τις καρτέλες χώρων (`GET /api/buildings/[buildingId]/spaces`). Ο κανόνας ζει στο
 * `lib/building-spaces/building-space-membership.ts`· εδώ μόνο ανάγνωση.
 * @module services/building-spaces/building-space-admin-reader
 *
 * ⛔ Τίποτα δεν γράφεται. Καλείται **μόνο** αφού ο καλών επαλήθευσε το κτίριο στον μισθωτή (`requireBuildingInTenant`).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import type {
  BuildingSpaceMention,
  BuildingSpaceReference,
  BuildingSpaceRelations,
  OtherBuildingRef,
} from '@/lib/building-spaces/building-space-contract';
import {
  BUILDING_SPACE_KINDS,
  readBuildingSpaceMembership,
  spaceBuildingIdOf,
  spaceDisplayNameOf,
  type BuildingSpaceKind,
  type BuildingSpaceMembership,
  type BuildingSpaceReader,
  type ReferencedSpace,
  type SpaceOwner,
  type SpaceOwningUnit,
  type SpaceRecord,
} from '@/lib/building-spaces/building-space-membership';
import { formatBuildingLabel } from '@/lib/entity-formatters';

/** Η συλλογή ανά είδος — η μία αντιστοίχιση. */
export const SPACE_COLLECTION_OF: Readonly<Record<BuildingSpaceKind, string>> = {
  parking: COLLECTIONS.PARKING_SPACES,
  storage: COLLECTIONS.STORAGE,
};

export function adminBuildingSpaceReader(db: AdminFirestore): BuildingSpaceReader {
  return {
    spacesLocatedIn: async (kind, buildingId) => {
      // tenant-scope-exempt: ο γονέας επαληθεύτηκε πριν (`requireBuildingInTenant`)· `parking_spots` / `storage_units`
      // απομονώνονται μέσω `buildingId` (ίδιο δόγμα με τις καρτέλες χώρων, ADR-184).
      const snapshot = await db.collection(SPACE_COLLECTION_OF[kind]).where(FIELDS.BUILDING_ID, '==', buildingId).get();
      return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    },
    spaceById: async (spaceId) => {
      for (const kind of BUILDING_SPACE_KINDS) {
        const data = (await db.collection(SPACE_COLLECTION_OF[kind]).doc(spaceId).get()).data();
        if (data !== undefined) return { id: spaceId, kind, data };
      }
      return null;
    },
  };
}

/** Το έγγραφο μονάδας — ο καλών λέει ποιο σχήμα περιμένει (το Firestore δεν το εγγυάται, όπως παντού στο Admin SDK). */
async function unitsWhere<T extends SpaceOwningUnit>(db: AdminFirestore, field: string, value: string): Promise<T[]> {
  // tenant-scope-exempt: ο γονέας (κτίριο → έργο) επαληθεύτηκε πριν· μια μονάδα μπορεί νόμιμα να φέρει άλλο `companyId`
  // από το κτίριό της (ίδιο δόγμα με το `api/properties`).
  const snapshot = await db.collection(COLLECTIONS.PROPERTIES).where(field, '==', value).get();
  return snapshot.docs.map((doc) => ({ ...(doc.data() as Omit<T, 'id'>), id: doc.id }) as T);
}

/**
 * Οι μονάδες που ορίζουν κατόχους: **όλο το έργο** (η σύνδεση είναι μοναδική ανά έργο, ADR-247) — ώστε χώρος του
 * κτιρίου με μονάδα **άλλου** κτιρίου να ξέρει τον κάτοχό του. Χωρίς έργο ⇒ μόνο οι μονάδες του κτιρίου.
 */
export async function readOwningUnits<T extends SpaceOwningUnit = SpaceOwningUnit>(
  db: AdminFirestore,
  buildingId: string,
  projectId: string | null,
): Promise<T[]> {
  const [ofBuilding, ofProject] = await Promise.all([
    unitsWhere<T>(db, FIELDS.BUILDING_ID, buildingId),
    projectId === null ? Promise.resolve<T[]>([]) : unitsWhere<T>(db, FIELDS.PROJECT_ID, projectId),
  ]);
  const byId = new Map<string, T>();
  for (const unit of [...ofBuilding, ...ofProject]) if (!byId.has(unit.id)) byId.set(unit.id, unit);
  return [...byId.values()];
}

/** Οι χώροι του κτιρίου (μετρούμενοι + αναφορές) με κατόχους από όλο το έργο. */
export async function readAdminBuildingSpaces(
  db: AdminFirestore,
  buildingId: string,
  units: readonly SpaceOwningUnit[],
): Promise<BuildingSpaceMembership> {
  return readBuildingSpaceMembership(adminBuildingSpaceReader(db), [buildingId], units);
}

/** Ένα άλλο κτίριο ως αναφορά, με την ετικέτα του αν διαβάστηκε. */
export function otherBuildingRefOf(buildingId: string, labels: ReadonlyMap<string, string | null>): OtherBuildingRef {
  return { buildingId, label: labels.get(buildingId) ?? null };
}

/** Χώρος μονάδας του κτιρίου που βρίσκεται αλλού → αναφορά **χωρίς** ποσό (ο ΙΔΙΟΣ τύπος για πίνακα και καρτέλες). */
export function spaceReferenceOf(space: ReferencedSpace, labels: ReadonlyMap<string, string | null>): BuildingSpaceReference {
  return { ...spaceMentionOf(space, space.owner), locatedIn: otherBuildingRefOf(space.locatedInBuildingId, labels) };
}

function spaceMentionOf(space: SpaceRecord, owner: SpaceOwner): BuildingSpaceMention {
  return { id: space.id, kind: space.kind, name: spaceDisplayNameOf(space), ownerUnitId: owner.unitId, ownerUnitName: owner.unitName };
}

/**
 * **Ό,τι δείχνουν οι καρτέλες χώρων δίπλα στη λίστα τους** (ADR-184 · ADR-898 §20): αναφορές σε χώρους άλλου κτιρίου
 * και χώρους χωρίς κτίριο που μετρούν εδώ. Ο ΙΔΙΟΣ κανόνας με τον πίνακα αντικειμενικής.
 */
export async function readBuildingSpaceRelations(db: AdminFirestore, buildingId: string): Promise<BuildingSpaceRelations> {
  const building = (await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get()).data();
  const projectId = typeof building?.projectId === 'string' && building.projectId !== '' ? building.projectId : null;
  const units = await readOwningUnits(db, buildingId, projectId);
  const { counted, references } = await readAdminBuildingSpaces(db, buildingId, units);
  const labels = await readBuildingLabels(db, references.map((space) => space.locatedInBuildingId));
  const unplaced = counted.flatMap((space) => (space.owner !== null && spaceBuildingIdOf(space.data) === null ? [spaceMentionOf(space, space.owner)] : []));
  return { references: references.map((space) => spaceReferenceOf(space, labels)), unplaced };
}

/** Οι ετικέτες άλλων κτιρίων (`κωδικός — όνομα`) · `null` = δεν υπάρχει πια. */
export async function readBuildingLabels(db: AdminFirestore, buildingIds: readonly string[]): Promise<ReadonlyMap<string, string | null>> {
  const unique = [...new Set(buildingIds)];
  const entries = await Promise.all(
    unique.map(async (id) => {
      const data = (await db.collection(COLLECTIONS.BUILDINGS).doc(id).get()).data();
      const text = (raw: unknown) => (typeof raw === 'string' ? raw : null);
      const label = data === undefined ? '' : formatBuildingLabel(text(data.code), text(data.name));
      return [id, label === '' ? null : label] as const;
    }),
  );
  return new Map(entries);
}
