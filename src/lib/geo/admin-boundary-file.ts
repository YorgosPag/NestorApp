/**
 * @fileoverview **ΤΟ ΑΡΧΕΙΟ ΟΡΙΟΥ ΜΙΑΣ ΔΙΟΙΚΗΤΙΚΗΣ ΟΝΤΟΤΗΤΑΣ** — σχήμα, διαδρομή, ανάγνωση.
 * @related ADR-883 · `scripts/build-admin-boundaries.ts` (γραφέας) · `admin-boundaries.ts` (φορτωτής)
 * @module lib/geo/admin-boundary-file
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ ΣΥΜΒΟΛΑΙΟ, ΔΥΟ ΠΛΕΥΡΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο γεννήτορας **γράφει** αυτό το σχήμα και η οθόνη το **διαβάζει**. Αν ζούσαν σε δύο
 * αρχεία, η μέρα που θα άλλαζε το ένα θα ήταν η μέρα που ο χάρτης θα έδειχνε κενό όριο
 * χωρίς κανένα σφάλμα. Γι' αυτό η διαδρομή ({@link adminBoundaryPath}) και ο αναγνώστης
 * ({@link readAdminBoundary}) ζουν **εδώ**, μαζί.
 *
 * ⚠️ **Φύλλο χωρίς εισαγωγές χρόνου εκτέλεσης από `@/`** — μόνο τύποι (και το σχετικό `./geo-ring`). Ο γεννήτορας
 * τρέχει με `tsx` χωρίς ρύθμιση alias, άρα κάθε runtime `@/` εισαγωγή εδώ θα τον έσπαγε.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 Η ΑΝΟΧΗ ΕΙΝΑΙ ΜΕΡΟΣ ΤΟΥ ΔΕΔΟΜΕΝΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το σύνορο είναι **απλοποιημένο** *(`lib/geo/geo-simplify.ts`)*, με εγγυημένη μέγιστη
 * απόκλιση `toleranceM`. Ο κριτής «μέσα ή έξω;» τη **χρειάζεται**: μια αγγελία πιο κοντά
 * στο σύνορο από την ανοχή δεν μπορεί να κριθεί με βεβαιότητα, και λέγεται «ίσως».
 * Αρχείο χωρίς ανοχή **απορρίπτεται** — δεν μαντεύουμε πόσο θολό είναι.
 */

import type { GeoBoundingBox, GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import { geoRingsNearestEdgeMetres, isPointInGeoRings } from './geo-ring';

/** Όπου ζουν τα αρχεία ορίων — κάτω από `public/`, άρα σερβίρονται στατικά. */
export const ADMIN_BOUNDARIES_DIR = 'data/admin-boundaries';

/**
 * Το όριο μιας διοικητικής οντότητας, όπως το διαβάζει η οθόνη.
 *
 * 🔑 **Η γεωμετρία μένει GeoJSON `MultiPolygon`** (`[lng, lat]`): το MapLibre τη δέχεται
 * αυτούσια, και ο κριτής την περνά από τον **υπάρχοντα** `geoJsonRings`. Δεύτερη δική μας
 * μορφή θα χρειαζόταν μετατροπή και στις δύο κατευθύνσεις.
 */
export interface AdminBoundary {
  readonly id: string;
  /** Βαθμίδα της ιεραρχίας — 3 (Περιφέρεια) έως 7 (Κοινότητα). */
  readonly level: number;
  readonly bbox: GeoBoundingBox;
  /** Εγγυημένη μέγιστη απόκλιση του απλοποιημένου συνόρου από το αληθινό, σε μέτρα. */
  readonly toleranceM: number;
  readonly geometry: GeoJSON.MultiPolygon;
  /**
   * **Οι οικισμοί που δείχνουν αυτό το όριο** (ADR-883 §5.10) — `id` οικισμού → θέση του.
   * Ζουν **μέσα στο αρχείο του ορίου** επίτηδες: είναι το ένα αρχείο που κατεβαίνει ούτως ή
   * άλλως όταν επιλεγεί ο οικισμός ⇒ η πινέζα δεν κοστίζει **κανένα** επιπλέον αίτημα.
   * Κενός χάρτης = κανένας οικισμός με επαληθευμένη θέση.
   */
  readonly places: ReadonlyMap<string, GeoPoint>;
}

/** Η μορφή των θέσεων **στο αρχείο**: `id` → `[lng, lat]` (σειρά GeoJSON). */
export type AdminBoundaryPlacesFile = Readonly<Record<string, readonly [number, number]>>;

/**
 * **Φαίνεται η πινέζα ΜΕΣΑ στο περίγραμμα που ζωγραφίζει ο χάρτης;** — μέσα στο απλοποιημένο
 * όριο, ή πιο κοντά στο σύνορο από την ανοχή του (εκεί το απλοποιημένο δεν κρίνει με βεβαιότητα).
 *
 * 🔴 **Το ΑΠΛΟΠΟΙΗΜΕΝΟ, όχι το αληθινό** — μετρημένο 2026-09-25: 3 οικισμοί σε νησίδες
 * **μικρότερες από την ανοχή** του δήμου τους ήταν μέσα στο αληθινό όριο, αλλά η νησίδα είχε
 * σβηστεί από την απλοποίηση ⇒ πινέζα **στη θάλασσα, έξω** από το περίγραμμα. Η ΜΙΑ διατύπωση:
 * τη ρωτούν ο γεννήτορας (ποια θέση γράφεται) **και** η άγκυρα (ποια γράφτηκε).
 */
export function placeWithinBoundary(point: GeoPoint, rings: readonly GeoOutline[], toleranceM: number): boolean {
  return isPointInGeoRings(point, rings) || geoRingsNearestEdgeMetres(point, rings) <= toleranceM;
}

/**
 * Το `id` της ιεραρχίας περιέχει `:` *(`municipality:0708`)*, που **απαγορεύεται** σε όνομα
 * αρχείου στα Windows. Η αντικατάσταση ζει **εδώ μόνο**: αν ο γεννήτορας έγραφε με άλλον
 * κανόνα από εκείνον που ζητά η οθόνη, κάθε όριο θα έδινε 404.
 */
export function adminBoundaryFileName(adminId: string): string {
  return `${adminId.replace(/:/g, '-')}.json`;
}

/** Η δημόσια διαδρομή του ορίου — ό,τι ζητά ο browser. */
export function adminBoundaryPath(adminId: string): string {
  return `/${ADMIN_BOUNDARIES_DIR}/${adminBoundaryFileName(adminId)}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readBoundingBox(value: unknown): GeoBoundingBox | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) return null;
  const [west, south, east, north] = value as [number, number, number, number];
  if (south > north || west > east) return null;
  return { west, south, east, north };
}

function readGeometry(value: unknown): GeoJSON.MultiPolygon | null {
  if (typeof value !== 'object' || value === null) return null;
  const geometry = value as Partial<GeoJSON.MultiPolygon>;
  if (geometry.type !== 'MultiPolygon' || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.coordinates.length === 0) return null;
  return { type: 'MultiPolygon', coordinates: geometry.coordinates };
}

function isLngLat(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
  );
}

/**
 * Οι θέσεις οικισμών — προαιρετικό πεδίο. ⚠️ Χαλασμένη θέση **πετιέται μόνη της**, δεν
 * ακυρώνει το όριο: το όριο κρίνει αγγελίες, η πινέζα είναι προσανατολισμός.
 */
function readPlaces(value: unknown): ReadonlyMap<string, GeoPoint> {
  const places = new Map<string, GeoPoint>();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return places;
  for (const [id, position] of Object.entries(value)) {
    if (isLngLat(position)) places.set(id, { lng: position[0], lat: position[1] });
  }
  return places;
}

/**
 * **Διαβάζει ό,τι ήρθε από το δίκτυο** — ή `null` αν δεν είναι όριο.
 *
 * ⚠️ **`null` = «δεν ξέρω», ΠΟΤΕ «κενό όριο».** Μια σελίδα σφάλματος, το HTML fallback
 * του διακομιστή, ένα αρχείο παλιού σχήματος: όλα δίνουν `null`, και ο καλών **λέει**
 * ότι το όριο δεν είναι διαθέσιμο αντί να κόψει όλες τις αγγελίες ως «έξω».
 */
export function readAdminBoundary(payload: unknown, expectedId: string): AdminBoundary | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const row = payload as Record<string, unknown>;

  if (row.id !== expectedId || !isFiniteNumber(row.level)) return null;
  if (!isFiniteNumber(row.toleranceM) || row.toleranceM < 0) return null;

  const bbox = readBoundingBox(row.bbox);
  const geometry = readGeometry(row.geometry);
  if (bbox === null || geometry === null) return null;

  return { id: expectedId, level: row.level, bbox, toleranceM: row.toleranceM, geometry, places: readPlaces(row.places) };
}
