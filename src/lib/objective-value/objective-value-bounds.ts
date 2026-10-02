/**
 * @fileoverview **Τα όρια του νόμου όταν κάτι έμεινε αναπάντητο** — «από Χ έως Υ, ανάλογα με την πρόσοψη» αντί για
 * σιωπή ή μαντεψιά (ADR-898 Φ3).
 * @related `compute-objective-value.ts` (ο ΕΝΑΣ κανόνας) · `objective-value-draft.ts` (πρόχειρο → είσοδος) ·
 *   `listing-objective-value.ts` (ο πρώτος καταναλωτής: η αγγελία)
 * @module lib/objective-value/objective-value-bounds
 *
 * 🔑 **Η μηχανή είναι ο κριτής και εδώ.** Ποιες ερωτήσεις μένουν ανοιχτές το λέει το `missing` της μηχανής — όχι
 * κανόνας γραμμένος εδώ. Όσες έχουν **πεπερασμένες** απαντήσεις (πρόσοψη, θέρμανση, ανελκυστήρας, θέση αποθήκης/θέσης,
 * και ποιο μέτωπο ισχύει) απαριθμούνται **όλες**, και κάθε συνδυασμός υπολογίζεται από τη μηχανή. Άρα το κάτω και το
 * πάνω όριο είναι **ακριβώς** η μικρότερη και η μεγαλύτερη τιμή που επιτρέπει ο νόμος με όσα ξέρουμε — όχι εκτίμηση.
 *
 * 🔑 **Ό,τι δεν απαριθμείται** (επιφάνεια, όροφος, παλαιότητα, ΣΑΟ) ⇒ `unresolved` με το `missing` της μηχανής: ένα
 * εύρος πάνω σε συνεχή άγνωστο θα ήταν τόσο φαρδύ που θα έλεγε ψέματα με αριθμούς.
 *
 * 🔑 **ΣΕ = 1,0 με σήμανση** (`commercialityAssumed`), όπως το «δεν τον ξέρω» του υπολογιστή (ADR-898 §10.2): ο
 * γεννήτορας ζωνών δεν τον κρατά ακόμη (Φ5), και η σήμανση μπαίνει **μόνο** όταν ο ΣΕ μετρά.
 */

import { computeObjectiveValue } from './compute-objective-value';
import { draftToInput, type ObjectiveValueDraft } from './objective-value-draft';
import {
  PARKING_POSITIONS,
  RESIDENCE_FRONTAGES,
  STORAGE_POSITIONS,
  type ComputedObjectiveValue,
  type ObjectiveValueForm,
  type ObjectiveValueMissing,
  type ParkingPosition,
  type PendingObjectiveValue,
  type StoragePosition,
} from './objective-value-types';

/** Ο ΣΕ όταν δεν τον ξέρουμε: το κατώτατο του νόμου (≥ 1), πάντα σημασμένο. */
export const ASSUMED_COMMERCIALITY_FACTOR = 1;

/** Ό,τι μπορεί να μείνει ανοιχτό **και** απαριθμείται. `zoneFront` = «έχει πρόσοψη σε μέτωπο με δική του τιμή;». */
export type OpenQuestion = 'zoneFront' | 'frontage' | 'hasCentralHeating' | 'hasElevator' | 'position';

export type ObjectiveValueBounds =
  /** Τίποτα ανοιχτό: ένα ποσό, με την ανάλυση της μηχανής. */
  | { readonly kind: 'exact'; readonly result: ComputedObjectiveValue; readonly commercialityAssumed: boolean }
  /** Το εύρος που επιτρέπει ο νόμος για τις ανοιχτές ερωτήσεις (με τη σειρά που τις συνάντησε η μηχανή). */
  | {
      readonly kind: 'range';
      readonly low: number;
      readonly high: number;
      readonly open: readonly OpenQuestion[];
      readonly commercialityAssumed: boolean;
    }
  /** Λείπει κάτι που δεν απαριθμείται, ή κάτι δεν επιτρέπεται — η απάντηση της μηχανής αυτούσια. */
  | { readonly kind: 'unresolved'; readonly result: PendingObjectiveValue };

type Answers = readonly Partial<ObjectiveValueDraft>[];

/**
 * **Οι θέσεις που μένουν δυνατές** όταν η θέση είναι ανοιχτή (ADR-898 §19): ό,τι ξέρουμε για τον χώρο στενεύει την
 * απαρίθμηση — αποθήκη σε υπόγειο ⇒ μόνο οι τέσσερις είσοδοι υπογείου · σκεπαστή εξωτερική θέση ⇒ ακάλυπτος ή πυλωτή.
 * Απούσα ⇒ **όλες** οι θέσεις του νόμου (ο δημόσιος υπολογιστής, η αγγελία). Κενή λίστα δεν επιτρέπεται.
 */
export interface PositionCandidates {
  readonly storage?: readonly StoragePosition[];
  readonly parking?: readonly ParkingPosition[];
}

/** Τα κενά της μηχανής με πεπερασμένες απαντήσεις. */
const ENUMERABLE = ['frontage', 'hasCentralHeating', 'hasElevator', 'position'] as const satisfies readonly ObjectiveValueMissing[] &
  readonly OpenQuestion[];
type EnumerableMissing = (typeof ENUMERABLE)[number];

function isEnumerable(missing: ObjectiveValueMissing): missing is EnumerableMissing {
  return (ENUMERABLE as readonly ObjectiveValueMissing[]).includes(missing);
}

const YES_NO = [true, false] as const;

/** Όλες οι απαντήσεις μιας ερώτησης που απαριθμείται. */
function answersFor(missing: EnumerableMissing, form: ObjectiveValueForm, positions: PositionCandidates): Answers {
  switch (missing) {
    case 'frontage':
      return RESIDENCE_FRONTAGES.map((frontage) => ({ frontage }));
    case 'hasCentralHeating':
      return YES_NO.map((hasCentralHeating) => ({ hasCentralHeating }));
    case 'hasElevator':
      return YES_NO.map((hasElevator) => ({ hasElevator }));
    case 'position':
      return form === 'parking'
        ? (positions.parking ?? PARKING_POSITIONS).map((parkingPosition) => ({ parkingPosition }))
        : (positions.storage ?? STORAGE_POSITIONS).map((storagePosition) => ({ storagePosition }));
  }
}

interface Exploration {
  readonly positions: PositionCandidates;
  readonly results: ComputedObjectiveValue[];
  readonly open: OpenQuestion[];
  commercialityAssumed: boolean;
}

function markOpen(exploration: Exploration, question: OpenQuestion): void {
  if (!exploration.open.includes(question)) exploration.open.push(question);
}

/**
 * Κατεβαίνει σε κάθε συνδυασμό απαντήσεων. Επιστρέφει την απάντηση της μηχανής όπου σταμάτησε (κάτι που δεν
 * απαριθμείται, ή άκυρη είσοδος)· `null` όταν όλοι οι κλάδοι έφτασαν σε ποσό.
 */
function explore(draft: ObjectiveValueDraft, todayIso: string, exploration: Exploration): PendingObjectiveValue | null {
  const result = computeObjectiveValue(draftToInput(draft, todayIso));
  if (result.kind === 'computed') {
    exploration.results.push(result);
    return null;
  }
  if (result.kind === 'invalid') return result;
  if (result.missing.includes('commercialityFactor')) {
    exploration.commercialityAssumed = true;
    return explore({ ...draft, commercialityFactor: ASSUMED_COMMERCIALITY_FACTOR }, todayIso, exploration);
  }
  const [next] = result.missing;
  if (next === undefined || !result.missing.every(isEnumerable) || !isEnumerable(next)) return result;
  markOpen(exploration, next);
  for (const answer of answersFor(next, draft.form, exploration.positions)) {
    const stopped = explore({ ...draft, ...answer }, todayIso, exploration);
    if (stopped !== null) return stopped;
  }
  return null;
}

/**
 * **Το ποσό ή τα όρια του νόμου** για ένα πρόχειρο. `zonePrices` = οι τιμές που μπορεί να ισχύουν (η ζώνη και τα
 * μέτωπα υπό όρο, `zonePriceCandidates`)· κενό ⇒ ισχύει όποια τιμή έχει το πρόχειρο. `positions` = οι θέσεις που μένουν
 * δυνατές όταν η θέση είναι ανοιχτή ({@link PositionCandidates}).
 */
export function objectiveValueBounds(
  draft: ObjectiveValueDraft,
  todayIso: string,
  zonePrices: readonly number[],
  positions: PositionCandidates = {},
): ObjectiveValueBounds {
  const exploration: Exploration = { positions, results: [], open: [], commercialityAssumed: false };
  const prices = zonePrices.length === 0 ? [draft.zonePrice] : zonePrices;
  if (prices.length > 1) markOpen(exploration, 'zoneFront');
  for (const zonePrice of prices) {
    const stopped = explore({ ...draft, zonePrice }, todayIso, exploration);
    if (stopped !== null) return { kind: 'unresolved', result: stopped };
  }
  const { results, open, commercialityAssumed } = exploration;
  const [only] = results;
  if (results.length === 1 && only !== undefined) return { kind: 'exact', result: only, commercialityAssumed };
  const values = results.map((result) => result.value);
  return { kind: 'range', low: Math.min(...values), high: Math.max(...values), open, commercialityAssumed };
}
