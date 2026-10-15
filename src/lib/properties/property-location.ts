/**
 * @fileoverview **Ο ΕΝΑΣ ΚΡΙΤΗΣ ΤΟΠΟΘΕΣΙΑΣ ΑΚΙΝΗΤΟΥ** — έργο → κτίριο → όροφος.
 * @related ADR-840 §7.6 · ADR-051 (κεντρικό σύστημα φίλτρων)
 * @module lib/properties/property-location
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ** (ADR-840 §7.6, 2026-10-15): τα φίλτρα «Έργο»/«Κτίριο» της «Διαθέσιμα Ακίνητα»
 * ήταν **άδεια και νεκρά** — οι επιλογές χτίζονταν από `project`/`building`, πεδία που **δεν γράφει
 * κανείς** στο Firestore (υπάρχουν μόνο `projectId`/`buildingId`), η οθόνη δεν τα εφάρμοζε καθόλου, και
 * το `/spaces/properties` τα εφάρμοζε **με όνομα** — δύο ασύμφωνες υλοποιήσεις, καμία σωστή.
 *
 * 🔑 **Μοτίβο Zillow/Idealista/Revit**: φιλτράρουμε με **ταυτότητα**, δείχνουμε **όνομα** (ο επιλυτής
 * ονομάτων είναι το `useHierarchyNames`, όχι αυτό το αρχείο). Μετονομασία δεν σπάει φίλτρο· ομώνυμα
 * κτίρια σε δύο έργα δεν συγχέονται. Και τα φίλτρα είναι **καταρράκτης**: το «Κτίριο» προσφέρει μόνο
 * κτίρια του επιλεγμένου έργου, ο «Όροφος» μόνο ορόφους του επιλεγμένου έργου+κτιρίου.
 *
 * ⚠️ **ΙΣΟΓΕΙΟ = 0.** Ο όροφος `0` είναι ψευδής τιμή: **ΠΟΤΕ** `filter(Boolean)` σε ορόφους
 * (ADR-840 §7.2 εύρημα 1). Το κλειδί ορόφου είναι `String(level)` ⇒ `'0'`.
 *
 * Καθαρό αρχείο: κανένα React, καμία ανάγνωση — το εφαρμόζουν **και οι δύο** μηχανές φίλτρων
 * (`usePublicPropertyViewer` · `usePropertyFilters`) και ο εγχυτής επιλογών (`usePropertyFiltersConfig`).
 */

import { matchesArrayFilter } from '@/components/core/AdvancedFilters/utils/applyFilters';

/** Ό,τι χρειάζεται ο κριτής από ένα ακίνητο — δομικός τύπος, ώστε να μη δένεται σε μία οθόνη. */
export interface LocatedProperty {
  readonly projectId?: string | null;
  readonly buildingId?: string | null;
  readonly floor?: number | null;
}

/** Η επιλογή του ανθρώπου. Τιμές = **ταυτότητες** (`projectId`/`buildingId`) · όροφος = `String(level)`. */
export interface LocationSelection {
  readonly project?: readonly string[];
  readonly building?: readonly string[];
  readonly floor?: readonly string[];
}

/** Τι υπάρχει να διαλέξει κανείς, δεδομένης της επιλογής πιο πάνω στον καταρράκτη. */
export interface LocationChoices {
  readonly projectIds: string[];
  readonly buildingIds: string[];
  /** Αριθμητικά ταξινομημένοι — το λεξικογραφικό βάζει τον 10ο πριν τον 2ο. */
  readonly floors: number[];
}

/** Το διαχωριστικό της γραμμής τοποθεσίας — σύμβολο, όχι κείμενο. */
const LOCATION_SEPARATOR = ' • ';

function textOf(raw: string | null | undefined): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

/** Το κλειδί ορόφου — `'0'` για το ισόγειο· `null` μόνο όταν ο όροφος **λείπει**. */
export function floorKeyOf(property: LocatedProperty): string | null {
  const { floor } = property;
  return typeof floor === 'number' && Number.isFinite(floor) ? String(floor) : null;
}

function mutableList(values: readonly string[] | undefined): string[] {
  return values ? [...values] : [];
}

/** **Ο ΚΡΙΤΗΣ.** Κενή επιλογή σε ένα επίπεδο = «όλα» σε αυτό το επίπεδο. */
export function matchesPropertyLocation(property: LocatedProperty, selection: LocationSelection): boolean {
  return (
    matchesArrayFilter(textOf(property.projectId), mutableList(selection.project)) &&
    matchesArrayFilter(textOf(property.buildingId), mutableList(selection.building)) &&
    matchesArrayFilter(floorKeyOf(property), mutableList(selection.floor))
  );
}

function distinctTexts(values: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const value of values) {
    const text = textOf(value);
    if (text !== null) out.add(text);
  }
  return [...out];
}

function distinctFloors(properties: readonly LocatedProperty[]): number[] {
  const out = new Set<number>();
  for (const property of properties) {
    if (floorKeyOf(property) !== null) out.add(property.floor as number);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Οι επιλογές **σε καταρράκτη**: έργα από όλα τα ακίνητα· κτίρια από τα ακίνητα του επιλεγμένου
 * έργου· όροφοι από τα ακίνητα του επιλεγμένου έργου **και** κτιρίου.
 */
export function locationChoices<P extends LocatedProperty>(
  properties: readonly P[],
  selection: LocationSelection,
): LocationChoices {
  const inProject = properties.filter((p) => matchesPropertyLocation(p, { project: selection.project }));
  const inBuilding = inProject.filter((p) => matchesPropertyLocation(p, { building: selection.building }));
  return {
    projectIds: distinctTexts(properties.map((p) => p.projectId)),
    buildingIds: distinctTexts(inProject.map((p) => p.buildingId)),
    floors: distinctFloors(inBuilding),
  };
}

function keepOnly(values: readonly string[] | undefined, allowed: readonly string[]): string[] {
  return (values ?? []).filter((value) => allowed.includes(value));
}

function sameList(a: readonly string[] | undefined, b: readonly string[]): boolean {
  const left = a ?? [];
  return left.length === b.length && left.every((value, index) => value === b[index]);
}

/**
 * Καθαρίζει κτίριο/όροφο που **δεν ανήκουν πια** στο upstream (π.χ. άλλαξε το έργο).
 *
 * 🔑 **Ιδεμποτές και ταυτοτικό**: αν τίποτα δεν αλλάζει, επιστρέφει το **ίδιο** αντικείμενο — ο
 * καλών μπορεί να το περνά από κάθε αλλαγή χωρίς περιττό render.
 * ⚠️ **Άδειος κατάλογος ⇒ καμία αλλαγή**: όσο φορτώνει, «δεν υπάρχει» σημαίνει «δεν ήρθε ακόμη»· το
 * καθάρισμα εκεί θα έσβηνε επιλογή που φτάνει από διεύθυνση/ιστορικό.
 */
export function reconcileLocationSelection<S extends LocationSelection, P extends LocatedProperty>(
  selection: S,
  properties: readonly P[],
): S {
  if (properties.length === 0) return selection;
  const building = keepOnly(selection.building, locationChoices(properties, { project: selection.project }).buildingIds);
  const floorChoices = locationChoices(properties, { project: selection.project, building }).floors.map(String);
  const floor = keepOnly(selection.floor, floorChoices);
  if (sameList(selection.building, building) && sameList(selection.floor, floor)) return selection;
  return { ...selection, building, floor };
}

/** Πόσα **διακριτά** κτίρια — με ταυτότητα. (Το παλιό `p.building` μετρούσε το `undefined` ως ένα.) */
export function countDistinctBuildings(properties: readonly LocatedProperty[]): number {
  return distinctTexts(properties.map((p) => p.buildingId)).length;
}

/** «Έργο • Κτίριο • Όροφος» — τα τμήματα που λείπουν **παραλείπονται**, ποτέ «• •». */
export function joinLocationParts(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => textOf(part) !== null).join(LOCATION_SEPARATOR);
}
