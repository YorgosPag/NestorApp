/**
 * @fileoverview **Η αντικειμενική αξία ΚΑΘΕ μονάδας και ΚΑΘΕ χώρου ενός κτιρίου** — ο πίνακας του εργολάβου (ADR-898 Φ4), υπολογισμένος
 * στον server **κατά την ανάγνωση**.
 * @related `lib/objective-value/building-objective-value.ts` (ο καθαρός κανόνας) · `services/listings/owned-listing-projection.ts`
 *   (`ownedListingShape`: η ΙΔΙΑ προβολή με την προεπισκόπηση του κατόχου) · `app/api/buildings/[buildingId]/objective-values/route.ts`
 * @module services/objective-value/building-objective-values.service
 *
 * 🔑 **Μία αντιστοίχιση, μία προβολή**: κάθε μονάδα γίνεται σχήμα αγγελίας από τον **ίδιο** προβολέα με τη δημόσια
 * αγγελία (`projectListingShape` + `projectLevelAreas` → `readLevelAreas`), και πρόχειρο από τον **ίδιο** πυρήνα
 * (`objectiveValueBasisOf`). Καμία δεύτερη ανάγνωση `levelData`, κανένα δεύτερο χτίσιμο πρόχειρου.
 *
 * 🔑 **Μία ζώνη ανά θέση, όχι ανά μονάδα** (ADR-889 §10): οι μονάδες ενός κτιρίου μοιράζονται θέση ⇒ μία ετυμηγορία ζώνης
 * και ένα σύνολο γεγονότων δημοσίευσης ανά **διακριτή** θέση· μία γνώση τόπου ανά έργο.
 *
 * ⛔ **Τίποτα δεν γράφεται** (ADR-889 §10.2: οι τιμές ζωνών αναθεωρούνται — ποσό αποθηκευμένο = ποσό μπαγιάτικο).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { fetchConstructionPhases } from '@/lib/api/construction-doc-mappers';
import { nowISO } from '@/lib/date-local';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import {
  buildingObjectiveValueTotal,
  buildingStageOf,
  buildingUnitObjectiveValue,
  type BuildingObjectiveValueContext,
} from '@/lib/objective-value/building-objective-value';
import { buildingQuestionsOf } from '@/lib/objective-value/building-objective-value-questions';
import type { BuildingQuestionSubject } from '@/lib/objective-value/building-objective-value-questions';
import type { BuildingObjectiveValueRow, BuildingObjectiveValues } from '@/lib/objective-value/building-objective-values-contract';
import { readBuildingObjectiveValueFacts } from '@/lib/objective-value/building-objective-value-facts';
import { objectiveValueBasisOf } from '@/lib/objective-value/listing-objective-value';
import { declaredOf, readObjectiveValueDeclarations } from '@/lib/objective-value/objective-value-declarations';
import {
  resolvePublicationFacts,
  withPublicationFacts,
  type ListingPublicationFacts,
} from '@/services/listings/listing-publication-facts';
import { ownedListingShape, type CompanyProjectableProperty } from '@/services/listings/owned-listing-projection';
import type { PlaceKnowledge } from '@/services/listings/public-listing-projection';
import { collectPlaceKnowledge } from '@/services/listings/publish-public-listing';
import { resolveListingPosition } from '@/services/listings/public-listing-position';
import { readValueZoneAt } from '@/services/market/value-zones.reader';
import type { ListingPosition, PublicListing } from '@/types/public-listing';

import { readAdminBuildingSpaces, readBuildingLabels, readOwningUnits, spaceReferenceOf } from '@/services/building-spaces/building-space-admin-reader';

import { spaceRow } from './building-space-objective-values';

type UnitDocument = CompanyProjectableProperty & {
  readonly objectiveValueDeclarations?: unknown;
  readonly linkedSpaces?: unknown;
};

/** Ασύγχρονη τιμή ανά κλειδί, υπολογισμένη **μία** φορά — ταυτόχρονοι καλούντες μοιράζονται την υπόσχεση. */
function memoizedBy<A, T>(keyOf: (arg: A) => string, compute: (arg: A) => Promise<T>): (arg: A) => Promise<T> {
  const cache = new Map<string, Promise<T>>();
  return (arg) => {
    const key = keyOf(arg);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const fresh = compute(arg);
    cache.set(key, fresh);
    return fresh;
  };
}

/** Το κλειδί μιας θέσης — ίδια θέση ⇒ ίδια ζώνη και ίδια γεγονότα δημοσίευσης. */
function positionKey(position: ListingPosition): string {
  return JSON.stringify(position);
}

/** Ό,τι μοιράζονται οι μονάδες ενός περάσματος. */
interface SharedReaders {
  readonly placeOf: (projectId: string | null) => Promise<PlaceKnowledge>;
  readonly zoneOf: (position: ListingPosition) => Promise<ValueZoneVerdict>;
  readonly publicationFactsOf: (input: { readonly listing: PublicListing; readonly place: PlaceKnowledge }) => Promise<ListingPublicationFacts>;
}

function sharedReaders(db: AdminFirestore, buildingId: string, at: string): SharedReaders {
  type PublicationInput = Parameters<SharedReaders['publicationFactsOf']>[0];
  return {
    placeOf: memoizedBy(
      (projectId: string | null) => projectId ?? '',
      (projectId: string | null) => collectPlaceKnowledge(db, { buildingId, projectId }, at),
    ),
    zoneOf: memoizedBy(positionKey, (position: ListingPosition) => readValueZoneAt(position)),
    publicationFactsOf: memoizedBy(
      ({ listing }: PublicationInput) => positionKey(listing.position),
      ({ listing, place }: PublicationInput) => resolvePublicationFacts(db, listing, place),
    ),
  };
}

async function readBuilding(db: AdminFirestore, buildingId: string) {
  const data = (await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get()).data() ?? {};
  return {
    facts: readBuildingObjectiveValueFacts(data.objectiveValueFacts),
    projectId: typeof data.projectId === 'string' ? data.projectId : null,
  };
}

interface UnitPass {
  readonly readers: SharedReaders;
  readonly context: BuildingObjectiveValueContext;
  readonly buildingProjectId: string | null;
  readonly today: string;
  readonly at: string;
}

/** Μία μονάδα: προβολή → γεγονότα δημοσίευσης → πυρήνας με τις ΩΜΕΣ δηλώσεις → επικάλυψη κτιρίου. */
async function unitRow(unit: UnitDocument, pass: UnitPass): Promise<BuildingObjectiveValueRow> {
  const { readers, context, today, at } = pass;
  const place = await readers.placeOf(unit.projectId ?? pass.buildingProjectId);
  const shape = ownedListingShape({ property: unit, place, at });
  const listing = withPublicationFacts(shape, await readers.publicationFactsOf({ listing: shape, place }));
  const declared = declaredOf(readObjectiveValueDeclarations(unit.objectiveValueDeclarations));
  const basis = objectiveValueBasisOf(listing, declared, await readers.zoneOf(listing.position));
  return {
    id: unit.id,
    kind: 'unit',
    name: typeof unit.name === 'string' ? unit.name : null,
    type: typeof unit.type === 'string' ? unit.type : null,
    floor: listing.floor,
    value: buildingUnitObjectiveValue(basis, context, today),
    space: null,
  };
}

/**
 * Οι χώροι του κτιρίου (ADR-898 §20, θέση ≠ ανάθεση): όσοι **μετρούν** εδώ ⇒ γραμμές· όσοι ανήκουν σε μονάδα του αλλά
 * βρίσκονται αλλού ⇒ αναφορές χωρίς ποσό. Η θέση τους είναι η θέση του **κτιρίου** (η ίδια γνώση τόπου με τις μονάδες,
 * χωρίς άρνηση αποκάλυψης — ο εργολάβος βλέπει πάντα) ⇒ μία ετυμηγορία ζώνης για όλους.
 */
async function spaceRows(db: AdminFirestore, buildingId: string, units: readonly UnitDocument[], pass: UnitPass) {
  const { counted, references } = await readAdminBuildingSpaces(db, buildingId, units);
  const others = [
    ...counted.map((space) => space.owner?.unitBuildingId ?? buildingId),
    ...references.map((space) => space.locatedInBuildingId),
  ].filter((id) => id !== buildingId);
  const buildingLabels = await readBuildingLabels(db, others);
  const referenceRows = references.map((space) => spaceReferenceOf(space, buildingLabels));
  if (counted.length === 0) return { rows: [], references: referenceRows };
  const place = await pass.readers.placeOf(pass.buildingProjectId);
  const verdict = await pass.readers.zoneOf(resolveListingPosition(place, null));
  const rowPass = { buildingId, context: pass.context, verdict, today: pass.today, buildingLabels };
  return { rows: counted.map((space) => spaceRow(space, rowPass)), references: referenceRows };
}

/** Κατά όροφο (άγνωστος στο τέλος), μετά κατά όνομα. */
function byFloorThenName(a: BuildingObjectiveValueRow, b: BuildingObjectiveValueRow): number {
  const floorA = a.floor ?? Number.POSITIVE_INFINITY;
  const floorB = b.floor ?? Number.POSITIVE_INFINITY;
  if (floorA !== floorB) return floorA < floorB ? -1 : 1;
  return (a.name ?? a.id).localeCompare(b.name ?? b.id, 'el');
}

/**
 * **Ο πίνακας του κτιρίου.** `today` = ημερομηνία αποτίμησης (`YYYY-MM-DD`). Η θεματοφυλακή (μισθωτής) έχει κριθεί
 * από τον καλούντα.
 */
export async function readBuildingObjectiveValues(
  db: AdminFirestore,
  buildingId: string,
  today: string,
): Promise<BuildingObjectiveValues> {
  const at = nowISO();
  const [building, phases] = await Promise.all([readBuilding(db, buildingId), fetchConstructionPhases(db, buildingId)]);
  // Οι μονάδες όλου του έργου ορίζουν κατόχους (ADR-247)· γραμμές γίνονται μόνο του κτιρίου — το ίδιο σύνολο με την
  // καρτέλα «Μονάδες» (`GET /api/properties?buildingId=`).
  const owningUnits = await readOwningUnits<UnitDocument>(db, buildingId, building.projectId);
  const units = owningUnits.filter((unit) => unit.buildingId === buildingId);
  const context: BuildingObjectiveValueContext = { stage: buildingStageOf(phases, building.facts), facts: building.facts };
  const pass: UnitPass = { readers: sharedReaders(db, buildingId, at), context, buildingProjectId: building.projectId, today, at };
  const [unitRows, spaces] = await Promise.all([Promise.all(units.map((unit) => unitRow(unit, pass))), spaceRows(db, buildingId, owningUnits, pass)]);
  const rows = [...unitRows, ...spaces.rows.map((space) => space.row)].sort(byFloorThenName);
  const subjects: BuildingQuestionSubject[] = [
    ...unitRows.map((row) => ({ value: row.value, positionFact: null })),
    ...spaces.rows.map((space) => space.subject),
  ];
  return {
    valuationDate: today,
    ...context,
    rows,
    references: spaces.references,
    total: buildingObjectiveValueTotal(rows),
    questions: buildingQuestionsOf(subjects),
  };
}
