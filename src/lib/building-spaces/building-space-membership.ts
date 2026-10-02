/**
 * @fileoverview **ΠΟΙΟΙ ΧΩΡΟΙ ΕΙΝΑΙ ΤΟΥ ΚΤΙΡΙΟΥ;** — ο ΕΝΑΣ κανόνας (ADR-898 §20 · ADR-184 · ADR-235), καθαρός, για
 * πελάτη **και** Admin SDK. Οι αναγνώστες εγχέονται· εδώ ζει μόνο η απόφαση.
 * @related `services/building-spaces.service.ts` (client SDK) · `services/objective-value/building-space-objective-values.ts`
 *   (Admin SDK) · `app/api/buildings/[buildingId]/spaces/route.ts` (οι καρτέλες χώρων)
 * @module lib/building-spaces/building-space-membership
 *
 * 🔑 **Θέση ≠ ανάθεση** (Revit: το στοιχείο ανήκει στο κτίριο όπου **βρίσκεται**, η ανάθεση είναι παράμετρος ·
 *   ΠΟΛ.1149: ο χώρος αποτιμάται στο ακίνητο όπου βρίσκεται):
 *   - **μετρά** (`counted`) στο κτίριο του δικού του `buildingId`· χωρίς `buildingId` ⇒ στο κτίριο της μονάδας που τον έχει.
 *   - στο κτίριο της μονάδας, όταν βρίσκεται **αλλού**, είναι **αναφορά** (`references`) — **ποτέ** σε σύνολο.
 *   - ο κάδος (ADR-281) δεν εμφανίζεται πουθενά.
 * 🔑 **Ένας κάτοχος ανά χώρο**: από τα `linkedSpaces` των μονάδων, κατά ταυτότητα μονάδας (ντετερμινιστικά — μια
 *   απαγορευμένη διπλή σύνδεση δίνει **πάντα** τον ίδιο κάτοχο· ADR-247: μοναδική ανά **έργο**, 409).
 */

import { SPACE_INCLUSION_TYPES, type SpaceInclusionType } from '@/config/domain-constants';
import { isTrashed } from '@/lib/firestore/trashed-status';
import { isFiniteNumber, isPlainRecord } from '@/lib/type-guards';

/** Τα είδη χώρου — η μία λίστα (η αντικειμενική και οι καρτέλες την ξαναεξάγουν). */
export const BUILDING_SPACE_KINDS = ['parking', 'storage'] as const;
export type BuildingSpaceKind = (typeof BUILDING_SPACE_KINDS)[number];

type RawDoc = Readonly<Record<string, unknown>>;

/** Ένα έγγραφο χώρου όπως το έφερε ο αναγνώστης. */
export interface SpaceRecord {
  readonly id: string;
  readonly kind: BuildingSpaceKind;
  readonly data: RawDoc;
}

/** Ό,τι χρειάζεται από μια μονάδα: ποιο κτίριο, ποιο όνομα, ποιους χώρους έχει. */
export interface SpaceOwningUnit {
  readonly id: string;
  readonly buildingId?: unknown;
  readonly name?: unknown;
  readonly linkedSpaces?: unknown;
}

/** Η σύνδεση ενός χώρου με μονάδα. */
export interface SpaceOwner {
  readonly unitId: string;
  readonly unitName: string | null;
  /** Το κτίριο της **μονάδας** — όχι κατ' ανάγκη το κτίριο του χώρου. */
  readonly unitBuildingId: string | null;
  readonly inclusion: SpaceInclusionType | null;
  readonly quantity: number | null;
}

/** Χώρος που **μετρά** σε αυτό το κτίριο. `owner` = η μονάδα του, όπου κι αν ζει εκείνη (`null` = χωρίς μονάδα). */
export interface CountedSpace extends SpaceRecord {
  readonly owner: SpaceOwner | null;
}

/** Χώρος μονάδας του κτιρίου που **βρίσκεται σε άλλο κτίριο** — φαίνεται, δεν μετρά. */
export interface ReferencedSpace extends SpaceRecord {
  readonly owner: SpaceOwner;
  readonly locatedInBuildingId: string;
}

export interface BuildingSpaceMembership {
  readonly counted: readonly CountedSpace[];
  readonly references: readonly ReferencedSpace[];
}

/** Οι αναγνώστες — ένας ανά SDK. */
export interface BuildingSpaceReader {
  /** Οι χώροι με `buildingId` = κτίριο (όλοι, και του κάδου — η απόφαση είναι εδώ). */
  readonly spacesLocatedIn: (kind: BuildingSpaceKind, buildingId: string) => Promise<readonly { readonly id: string; readonly data: RawDoc }[]>;
  /** Ένας χώρος κατά ταυτότητα, όποιου είδους κι αν είναι · `null` = δεν υπάρχει. */
  readonly spaceById: (spaceId: string) => Promise<SpaceRecord | null>;
}

const INCLUSIONS: readonly SpaceInclusionType[] = Object.values(SPACE_INCLUSION_TYPES);

function textOf(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

/** Το όνομα του χώρου όπως το γράφει η καρτέλα του: αριθμός θέσης · όνομα αποθήκης · αλλιώς ο κωδικός. */
export function spaceDisplayNameOf(space: SpaceRecord): string | null {
  return textOf(space.kind === 'parking' ? space.data.number : space.data.name) ?? textOf(space.data.code);
}

/** Το κτίριο όπου **βρίσκεται** ο χώρος · `null` = δεν δηλώθηκε. */
export function spaceBuildingIdOf(data: RawDoc): string | null {
  return textOf(data.buildingId);
}

function ownerOf(unit: SpaceOwningUnit, link: RawDoc): SpaceOwner {
  return {
    unitId: unit.id,
    unitName: textOf(unit.name),
    unitBuildingId: textOf(unit.buildingId),
    inclusion: INCLUSIONS.find((inclusion) => inclusion === link.inclusion) ?? null,
    quantity: isFiniteNumber(link.quantity) ? link.quantity : null,
  };
}

/** Χώρος → μονάδα, από τα `linkedSpaces`, κατά ταυτότητα μονάδας ώστε ο κάτοχος να είναι πάντα ο ίδιος. */
export function spaceOwnersOf(units: readonly SpaceOwningUnit[]): ReadonlyMap<string, SpaceOwner> {
  const owners = new Map<string, SpaceOwner>();
  for (const unit of [...units].sort((a, b) => a.id.localeCompare(b.id))) {
    const links = Array.isArray(unit.linkedSpaces) ? unit.linkedSpaces : [];
    for (const link of links) {
      if (!isPlainRecord(link) || typeof link.spaceId !== 'string' || owners.has(link.spaceId)) continue;
      owners.set(link.spaceId, ownerOf(unit, link));
    }
  }
  return owners;
}

/** Ζωντανός χώρος = όχι στον κάδο (ADR-281). */
export function isLiveSpace(space: SpaceRecord): boolean {
  return !isTrashed({ status: typeof space.data.status === 'string' ? space.data.status : null });
}

/**
 * **Ο κανόνας**, χωρίς I/O. `located` = οι χώροι με `buildingId` ∈ `buildingIds` · `linked` = οι υπόλοιποι χώροι που
 * έχουν μονάδες αυτών των κτιρίων. Κάθε χώρος βγαίνει **μία** φορά, σε **μία** από τις δύο λίστες.
 */
export function classifyBuildingSpaces(input: {
  readonly buildingIds: ReadonlySet<string>;
  readonly owners: ReadonlyMap<string, SpaceOwner>;
  readonly located: readonly SpaceRecord[];
  readonly linked: readonly SpaceRecord[];
}): BuildingSpaceMembership {
  const seen = new Set<string>();
  const counted: CountedSpace[] = [];
  const references: ReferencedSpace[] = [];
  for (const space of input.located) {
    if (seen.has(space.id) || !isLiveSpace(space)) continue;
    seen.add(space.id);
    counted.push({ ...space, owner: input.owners.get(space.id) ?? null });
  }
  for (const space of input.linked) {
    const owner = input.owners.get(space.id);
    if (seen.has(space.id) || !isLiveSpace(space) || owner === undefined) continue;
    if (owner.unitBuildingId === null || !input.buildingIds.has(owner.unitBuildingId)) continue;
    seen.add(space.id);
    const locatedIn = spaceBuildingIdOf(space.data);
    if (locatedIn === null || input.buildingIds.has(locatedIn)) counted.push({ ...space, owner });
    else references.push({ ...space, owner, locatedInBuildingId: locatedIn });
  }
  return { counted, references };
}

/**
 * **Οι χώροι των κτιρίων** μέσω του αναγνώστη. `units` = οι μονάδες που ορίζουν κατόχους — **τουλάχιστον** όσες ζουν
 * στα `buildingIds`· περισσότερες (π.χ. όλο το έργο) δίνουν τον κάτοχο και σε χώρο που έχει μονάδα άλλου κτιρίου.
 */
export async function readBuildingSpaceMembership(
  reader: BuildingSpaceReader,
  buildingIds: readonly string[],
  units: readonly SpaceOwningUnit[],
): Promise<BuildingSpaceMembership> {
  const ids = new Set(buildingIds);
  const owners = spaceOwnersOf(units);
  const located = await Promise.all(
    [...ids].flatMap((buildingId) =>
      BUILDING_SPACE_KINDS.map(async (kind) => (await reader.spacesLocatedIn(kind, buildingId)).map((doc) => ({ ...doc, kind }))),
    ),
  );
  const locatedFlat = located.flat();
  const locatedIds = new Set(locatedFlat.map((space) => space.id));
  const missing = [...owners.entries()]
    .filter(([spaceId, owner]) => !locatedIds.has(spaceId) && owner.unitBuildingId !== null && ids.has(owner.unitBuildingId))
    .map(([spaceId]) => spaceId);
  const linked = (await Promise.all(missing.map((spaceId) => reader.spaceById(spaceId)))).filter((space): space is SpaceRecord => space !== null);
  return classifyBuildingSpaces({ buildingIds: ids, owners, located: locatedFlat, linked });
}
