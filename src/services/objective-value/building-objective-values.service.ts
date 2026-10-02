/**
 * @fileoverview **Η αντικειμενική αξία ΚΑΘΕ μονάδας ενός κτιρίου** — ο πίνακας του εργολάβου (ADR-898 Φ4), υπολογισμένος
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
import { FIELDS } from '@/config/firestore-field-constants';
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
import type {
  BuildingObjectiveValues,
  BuildingUnitObjectiveValueRow,
} from '@/lib/objective-value/building-objective-values-contract';
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
import { readValueZoneAt } from '@/services/market/value-zones.reader';
import type { PublicListing } from '@/types/public-listing';

type UnitDocument = CompanyProjectableProperty & { readonly objectiveValueDeclarations?: unknown };

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
function positionKey(listing: PublicListing): string {
  return JSON.stringify(listing.position);
}

/** Ό,τι μοιράζονται οι μονάδες ενός περάσματος. */
interface SharedReaders {
  readonly placeOf: (projectId: string | null) => Promise<PlaceKnowledge>;
  readonly zoneOf: (listing: PublicListing) => Promise<ValueZoneVerdict>;
  readonly publicationFactsOf: (input: { readonly listing: PublicListing; readonly place: PlaceKnowledge }) => Promise<ListingPublicationFacts>;
}

function sharedReaders(db: AdminFirestore, buildingId: string, at: string): SharedReaders {
  type PublicationInput = Parameters<SharedReaders['publicationFactsOf']>[0];
  return {
    placeOf: memoizedBy(
      (projectId: string | null) => projectId ?? '',
      (projectId: string | null) => collectPlaceKnowledge(db, { buildingId, projectId }, at),
    ),
    zoneOf: memoizedBy(positionKey, (listing: PublicListing) => readValueZoneAt(listing.position)),
    publicationFactsOf: memoizedBy(
      ({ listing }: PublicationInput) => positionKey(listing),
      ({ listing, place }: PublicationInput) => resolvePublicationFacts(db, listing, place),
    ),
  };
}

/** Οι μονάδες του κτιρίου — το ίδιο σύνολο με την καρτέλα «Μονάδες» (`GET /api/properties?buildingId=`). */
async function readUnits(db: AdminFirestore, buildingId: string): Promise<UnitDocument[]> {
  // tenant-scope-exempt: ο γονέας επαληθεύτηκε πριν — η διαδρομή περνά από `requireBuildingInTenant`
  // (buildingScopedRoute), και μια μονάδα μπορεί νόμιμα να φέρει άλλο `companyId` από το κτίριό της (ίδιο δόγμα με το
  // `api/properties`). Ακυρώνεται αν ποτέ κληθεί χωρίς προηγούμενο έλεγχο ιδιοκτησίας του κτιρίου.
  const snapshot = await db.collection(COLLECTIONS.PROPERTIES).where(FIELDS.BUILDING_ID, '==', buildingId).get();
  return snapshot.docs.map((doc) => ({ ...(doc.data() as Omit<UnitDocument, 'id'>), id: doc.id }));
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
async function unitRow(unit: UnitDocument, pass: UnitPass): Promise<BuildingUnitObjectiveValueRow> {
  const { readers, context, today, at } = pass;
  const place = await readers.placeOf(unit.projectId ?? pass.buildingProjectId);
  const shape = ownedListingShape({ property: unit, place, at });
  const listing = withPublicationFacts(shape, await readers.publicationFactsOf({ listing: shape, place }));
  const declared = declaredOf(readObjectiveValueDeclarations(unit.objectiveValueDeclarations));
  const basis = objectiveValueBasisOf(listing, declared, await readers.zoneOf(listing));
  return {
    id: unit.id,
    name: typeof unit.name === 'string' ? unit.name : null,
    type: typeof unit.type === 'string' ? unit.type : null,
    floor: listing.floor,
    value: buildingUnitObjectiveValue(basis, context, today),
  };
}

/** Κατά όροφο (άγνωστος στο τέλος), μετά κατά όνομα. */
function byFloorThenName(a: BuildingUnitObjectiveValueRow, b: BuildingUnitObjectiveValueRow): number {
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
  const [building, phases, units] = await Promise.all([
    readBuilding(db, buildingId),
    fetchConstructionPhases(db, buildingId),
    readUnits(db, buildingId),
  ]);
  const context: BuildingObjectiveValueContext = { stage: buildingStageOf(phases, building.facts), facts: building.facts };
  const pass: UnitPass = { readers: sharedReaders(db, buildingId, at), context, buildingProjectId: building.projectId, today, at };
  const rows = (await Promise.all(units.map((unit) => unitRow(unit, pass)))).sort(byFloorThenName);
  const values = rows.map((row) => row.value);
  return {
    valuationDate: today,
    ...context,
    units: rows,
    total: buildingObjectiveValueTotal(values),
    questions: buildingQuestionsOf(values),
  };
}
