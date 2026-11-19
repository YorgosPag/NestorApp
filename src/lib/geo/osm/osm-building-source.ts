/**
 * @fileoverview **Η ΣΕΙΡΑ ΤΩΝ ΠΗΓΩΝ** — ποια πηγή ρωτάμε πρώτη για «ποιο κτίριο;», «υπάρχει;», «τι σχήμα έχει;».
 * @related ADR-777 · SPEC-777A §13.4 · §13.5 · §14.4 (κανόνας 2) · ./osm-archive (βαθμίδα 2) · ./osm-building (βαθμίδα 3)
 * @module lib/geo/osm/osm-building-source
 *
 * | Βαθμίδα | Πηγή | Πότε |
 * |---|---|---|
 * | 1 | τα πλακίδια **στην οθόνη** (πελάτης) | κάθε κλικ σε διανυσματικό χάρτη — 0 δίκτυο (`lib/maps/rendered-buildings`) |
 * | 2 | **το ίδιο αρχείο**, από τον διακομιστή | εδώ, **πάντα πρώτη** |
 * | 3 | Overpass (πισίνα endpoints) | **φρεσκάδα** (όταν η 2 λέει «όχι σε αυτό το build») + **εμπλουτισμός** (οδός, Τ.Κ., όροφοι, έτος) |
 *
 * 🔑 **Ο εμπλουτισμός δεν είναι πύλη.** Αν ο Overpass δεν απαντήσει, η εγγραφή **προχωρά** με ό,τι αποδεικνύει το αρχείο
 *    (ταυτότητα · κτίριο · σημείο) και τα υπόλοιπα μένουν `null` = «δεν το ξέρουμε», που ο τύπος ήδη εκφράζει. Αν ο
 *    Overpass **απαντήσει** ότι το στοιχείο **έσβησε** ή **δεν είναι πια κτίριο**, νικά: είναι η **νεότερη** πηγή, και
 *    δεν γράφουμε στο κοινό επίπεδο κάτι που το OSM σήμερα αρνείται (§13.2 — οι εθελοντές σβήνουν).
 *
 * 🔴 **Το σημείο που γράφεται βγαίνει ΠΑΝΤΑ από τη γεωμετρία της πηγής**, ποτέ από τον πελάτη (§14.4 κ.2). Το `near`
 *    εντοπίζει μόνο **ποιο πλακίδιο** να ανοίξουμε.
 *
 * **Layering**: server-only — συνθέτει δύο αναγνώστες. Καμία εξάρτηση από Firestore/React.
 */

import 'server-only';

import { createDeadline, type Deadline } from '@/lib/async-utils';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { OsmElementType } from '@/types/geo/public-place';

import { findArchiveBuildingAt, OSM_ARCHIVE_BUILD, verifyArchiveBuilding } from './osm-archive';
import type { ArchiveBuilding } from './osm-archive-building';
import {
  fetchOsmBuildingOutline,
  findOsmBuildingAt,
  verifyOsmBuilding,
  type OsmBuildingFact,
  type OsmBuildingPick,
  type OsmBuildingVerdict,
  type OsmOutlineFetch,
} from './osm-building';

/**
 * Πόσο δικαιούται ο **εμπλουτισμός** από τον Overpass μετά από επιτυχημένη επαλήθευση στο αρχείο. Μικρό επίτηδες: είναι
 * «αν προλάβει», και ο άνθρωπος περιμένει πάνω από κουμπί «Αποθήκευση».
 */
const ENRICHMENT_BUDGET_MS = 3_000;

/** Από ποιο αντίγραφο του OSM ήρθε η απάντηση — `null` = ο ζωντανός Overpass. */
export type OsmSourceSnapshot = { readonly build: string } | null;

/** Η ετυμηγορία της επαλήθευσης, μαζί με το **αντίγραφο** που την έδωσε (`OsmReference.snapshot`). */
export type OsmBuildingSourceVerdict =
  | { readonly kind: 'verified'; readonly fact: OsmBuildingFact; readonly snapshot: OsmSourceSnapshot }
  | Exclude<OsmBuildingVerdict, { readonly kind: 'verified' }>;

/** Κτίριο του αρχείου → τα γεγονότα που ξέρει το αρχείο. Ό,τι δεν κρατά η στρώση κτιρίων είναι `null`. */
function archiveFact(building: ArchiveBuilding, elementId: string): OsmBuildingFact {
  return {
    elementType: 'way',
    elementId,
    point: building.point,
    address: { street: null, houseNumber: building.houseNumber, city: null, postalCode: null },
    floorsAboveGround: null,
    constructionYear: null,
  };
}

/** Τρέχει με μια δική μας προθεσμία και την κλείνει στο τέλος. */
async function within<T>(ms: number, run: (deadline: Deadline) => Promise<T>): Promise<T> {
  const deadline = createDeadline(ms);
  try {
    return await run(deadline);
  } finally {
    deadline.dispose();
  }
}

/**
 * Το αρχείο επαλήθευσε ⇒ ο Overpass **εμπλουτίζει, αν προλάβει**. Το σημείο μένει του αρχείου (ίδια σημασία, `out
 * center`, και είναι το **αναπαραγώγιμο**).
 */
async function enrichedFromArchive(elementId: string, building: ArchiveBuilding): Promise<OsmBuildingSourceVerdict> {
  const snapshot = { build: OSM_ARCHIVE_BUILD };
  const live = await within(ENRICHMENT_BUDGET_MS, (deadline) => verifyOsmBuilding('way', elementId, { deadline }));
  switch (live.kind) {
    case 'verified':
      return { kind: 'verified', fact: { ...live.fact, point: building.point }, snapshot };
    case 'absent':
    case 'not-a-building':
      return live;
    case 'unavailable':
      return { kind: 'verified', fact: archiveFact(building, elementId), snapshot };
  }
}

/**
 * **Υπάρχει αυτό το στοιχείο ως κτίριο;** — η επαλήθευση πηγής του §14.4 κ.2, με τη σειρά των βαθμίδων.
 *
 * @param near Πού έγινε η χειρονομία· **μόνο** για τον εντοπισμό του πλακιδίου. Χωρίς αυτό (παλιοί πελάτες, `node`,
 *             `relation`) ⇒ κατευθείαν ο Overpass, όπως πριν.
 */
export async function verifyBuildingFromSources(
  elementType: OsmElementType,
  elementId: string,
  near: GeoPoint | null,
): Promise<OsmBuildingSourceVerdict> {
  if (elementType === 'way' && near !== null) {
    const archived = await verifyArchiveBuilding(elementId, near);
    if (archived.kind === 'verified') return enrichedFromArchive(elementId, archived.building);
  }
  const live = await verifyOsmBuilding(elementType, elementId);
  return live.kind === 'verified' ? { ...live, snapshot: null } : live;
}

/**
 * **Ποιο κτίριο είναι εδώ;** — για τον επιλογέα όταν η βαθμίδα 1 δεν έχει τι να πει (εφεδρικός raster χάρτης).
 *
 * ⚠️ Το αρχείο λέει `none` ⇒ ρωτάμε τον Overpass για **νεότερο** κτίριο· αν εκείνος δεν απαντήσει, η απάντηση μένει
 *    `none` — το αρχείο **απάντησε**, και ο άνθρωπος έχει ήδη πινέζα/σχεδίαση (§13.6). Μόνο όταν **και οι δύο** δεν
 *    απάντησαν η απάντηση είναι `unavailable`.
 */
export async function findBuildingFromSources(point: GeoPoint, deadline: Deadline): Promise<OsmBuildingPick> {
  const archived = await findArchiveBuildingAt(point, deadline);
  if (archived.kind === 'found') {
    const { building } = archived;
    return { kind: 'found', fact: archiveFact(building, building.ref.elementId), outline: building.outline };
  }
  const live = await findOsmBuildingAt(point, { deadline });
  return archived.kind === 'none' && live.kind === 'unavailable' ? { kind: 'none' } : live;
}

/**
 * **Τι σχήμα έχει;** — για να **ζωγραφιστεί** τώρα (ποτέ αποθήκευση, §13.4). Αρχείο πρώτα· αλλιώς Overpass.
 * @param near Το αποθηκευμένο σημείο του τόπου — εντοπίζει το πλακίδιο.
 */
export async function buildingOutlineFromSources(
  elementType: OsmElementType,
  elementId: string,
  near: GeoPoint | null,
): Promise<OsmOutlineFetch> {
  if (elementType === 'way' && near !== null) {
    const archived = await verifyArchiveBuilding(elementId, near);
    if (archived.kind === 'verified') return { kind: 'outline', outline: archived.building.outline };
  }
  return fetchOsmBuildingOutline(elementType, elementId);
}
