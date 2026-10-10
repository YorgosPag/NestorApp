/**
 * @fileoverview **Ο ΕΝΑΣ κανόνας μοναδικότητας της στοίβας ορόφων** — καθαρός, κοινός σε διακομιστή και πελάτη.
 * @module lib/floor/floor-stack-integrity
 * @see app/api/floors/floor-stack-authority — ο ΜΟΝΟΣ που τον εφαρμόζει σε εγγραφή (μέσα σε συναλλαγή)
 *
 * 🔑 **Ίδια ερώτηση, δύο στιγμές**: «χωράει αυτός ο όροφος;» (πριν από εγγραφή — {@link judgeFloorSlot}) και
 * «έχει ήδη αυτή η στοίβα σύγκρουση;» (δεδομένα που γράφτηκαν έξω από την εφαρμογή — {@link findFloorStackConflicts}).
 * Και οι δύο περνούν από το ίδιο {@link floorSlotKey}: κανόνας εγγραφής και ανιχνευτής **δεν μπορούν να αποκλίνουν**.
 *
 * Ο κανόνας (ADR-461 R6 + όνομα):
 *   - μετρούμενοι όροφοι ⇒ **μοναδικός αριθμός** μεταξύ τους·
 *   - ειδικές στάθμες (θεμελίωση/δώμα/απόληξη/πυλωτή/σοφίτα) ⇒ **μία ανά είδος**, μοιράζονται νόμιμα αριθμό με
 *     μετρούμενο όροφο (θεμελίωση −1 δίπλα σε υπόγειο −1)·
 *   - **μοναδικό όνομα** ανά κτίριο (Revit), αγνοώντας πεζά/κεφαλαία, τόνους και κενά·
 *   - **κάθε μετρούμενος όροφος έχει ύψος** ≥ {@link MIN_STOREY_HEIGHT_M}: το υψόμετρό του απέχει τόσο από τον
 *     μετρούμενο από κάτω και από πάνω του.
 *
 * 🔴 Ως τις 2026-10-10 το ίδιο υψόμετρο ήταν **προειδοποίηση** («η Revit το επιτρέπει»). Εδώ όμως το ύψος ορόφου
 * **παράγεται** από τα υψόμετρα (ADR-451): δύο μετρούμενοι στο ίδιο υψόμετρο = όροφος ύψους μηδέν, γραμμένος στη βάση
 * από την ανασύνταξη — ακριβώς ό,τι το σχήμα του API αρνείται όταν το πληκτρολογεί άνθρωπος (`height ≥ 0,1`).
 */

import { isBuildingStorey, type FloorKind } from '@/utils/floor-naming';

/** Ό,τι χρειάζεται ο κανόνας από έναν όροφο. */
export interface FloorSlotRow {
  readonly id: string;
  readonly number: number;
  readonly name?: string | null;
  readonly kind?: FloorKind;
  readonly elevation?: number | null;
}

/** Ο όροφος όπως **θα είναι** μετά την εγγραφή. */
export type FloorSlotCandidate = Omit<FloorSlotRow, 'id'>;

export type FloorSlotClash = 'number' | 'kind' | 'name' | 'elevation';

/**
 * Μέτρα — το ελάχιστο ύψος ορόφου. **Μία** τιμή για το ρητό ύψος (σχήμα του API) και για το παράγωγο (απόσταση
 * υψομέτρων δύο διαδοχικών μετρούμενων ορόφων).
 */
export const MIN_STOREY_HEIGHT_M = 0.1;

/** Γιατί δεν χωράει — και με ποιον συγκρούεται. */
export interface FloorSlotVerdict {
  readonly clash: FloorSlotClash;
  readonly withFloorId: string;
}

/** Μία σύγκρουση που **υπάρχει ήδη** στα δεδομένα. */
export interface FloorStackConflict {
  readonly clash: FloorSlotClash;
  readonly floorIds: readonly string[];
}

/**
 * Ο κωδικός σφάλματος κάθε σύγκρουσης — το `errorCode` του `409`. Ο πελάτης ξεχωρίζει με αυτόν τη μοναδικότητα από
 * τη σύγκρουση εκδόσεων (επίσης `409`): ως τις 2026-10-10 ένας πιασμένος αριθμός έβγαινε ως «κάποιος άλλος ενημέρωσε».
 */
export const FLOOR_SLOT_ERROR_CODES = {
  number: 'FLOOR_NUMBER_TAKEN',
  kind: 'FLOOR_KIND_TAKEN',
  name: 'FLOOR_NAME_TAKEN',
  elevation: 'FLOOR_STOREY_TOO_LOW',
} as const satisfies Record<FloorSlotClash, string>;

export type FloorSlotErrorCode = (typeof FLOOR_SLOT_ERROR_CODES)[FloorSlotClash];

/** Είναι ο κωδικός άρνηση μοναδικότητας ορόφου; */
export function isFloorSlotErrorCode(code: unknown): code is FloorSlotErrorCode {
  return (Object.values(FLOOR_SLOT_ERROR_CODES) as readonly unknown[]).includes(code);
}

/** Μετρά ως όροφος («Building Story»); Όροφος χωρίς `kind` (παλαιό έγγραφο) ⇒ ναι. */
export function isCountedStorey(row: { readonly kind?: FloorKind }): boolean {
  return row.kind === undefined || isBuildingStorey(row.kind);
}

/** **Η θέση που πιάνει ένας όροφος**: ο αριθμός του αν μετρά, το είδος του αν είναι ειδική στάθμη. */
export function floorSlotKey(row: { readonly number: number; readonly kind?: FloorKind }): string {
  return isCountedStorey(row) ? `number:${row.number}` : `kind:${row.kind}`;
}

/** Το όνομα όπως το συγκρίνει ο κανόνας: χωρίς τόνους, πεζά, ένα κενό ανάμεσα στις λέξεις. Κενό ⇒ δεν κρίνεται. */
export function normalizeFloorName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Ποιες όψεις του ορόφου αλλάζουν — κρίνονται **μόνο** αυτές, ώστε παλαιά σύγκρουση να μη μπλοκάρει άσχετη αλλαγή. */
export interface FloorSlotChecks {
  readonly slot: boolean;
  readonly name: boolean;
  /** Το ύψος ορόφου που αφήνει το υψόμετρο — αλλάζει με το υψόμετρο **και** με τη θέση (αριθμός/είδος). */
  readonly elevation: boolean;
}

const ALL_CHECKS: FloorSlotChecks = { slot: true, name: true, elevation: true };

/** Μετρούμενος όροφος με γνωστό υψόμετρο — ο μόνος που έχει παράγωγο ύψος. */
type PlacedStorey<T> = T & { readonly elevation: number };

function isPlacedStorey<T extends { readonly kind?: FloorKind; readonly elevation?: number | null }>(
  row: T,
): row is PlacedStorey<T> {
  return isCountedStorey(row) && typeof row.elevation === 'number' && Number.isFinite(row.elevation);
}

/** Αφήνει το `upper` ύψος ορόφου κάτω από το ελάχιστο πάνω από το `lower`; Σύγκριση στο χιλιοστό (χωρίς float drift). */
function isStoreyTooLow(lower: number, upper: number): boolean {
  return Math.round((upper - lower) * 1000) < Math.round(MIN_STOREY_HEIGHT_M * 1000);
}

/**
 * Ο γείτονας που ο υποψήφιος **στριμώχνει**: ο πλησιέστερος μετρούμενος από κάτω (κατά αριθμό) που δεν του αφήνει
 * ύψος, ή ο πλησιέστερος από πάνω στον οποίο δεν αφήνει ο ίδιος. Όροφος στον **ίδιο** αριθμό δεν κρίνεται εδώ — είναι
 * σύγκρουση θέσης. Ειδική στάθμη ή άγνωστο υψόμετρο ⇒ δεν κρίνεται (η θέση της παράγεται από τη στοίβα, ADR-461).
 */
function squeezedNeighbour(others: readonly FloorSlotRow[], candidate: FloorSlotCandidate): FloorSlotRow | null {
  if (!isPlacedStorey(candidate)) return null;
  const placed = others.filter(isPlacedStorey);
  const below = placed.filter((row) => row.number < candidate.number).sort((a, b) => b.number - a.number)[0];
  if (below && isStoreyTooLow(below.elevation, candidate.elevation)) return below;
  const above = placed.filter((row) => row.number > candidate.number).sort((a, b) => a.number - b.number)[0];
  if (above && isStoreyTooLow(candidate.elevation, above.elevation)) return above;
  return null;
}

/**
 * **Χωράει;** `null` ⇒ ναι. Αλλιώς η πρώτη σύγκρουση, με σειρά: θέση (αριθμός/είδος) → όνομα → ύψος ορόφου.
 *
 * @param excludeId ο ίδιος ο όροφος, όταν επεξεργάζεται — δεν συγκρούεται με τον εαυτό του
 */
export function judgeFloorSlot(
  siblings: readonly FloorSlotRow[],
  candidate: FloorSlotCandidate,
  checks: FloorSlotChecks = ALL_CHECKS,
  excludeId?: string,
): FloorSlotVerdict | null {
  const others = siblings.filter((row) => row.id !== excludeId);
  if (checks.slot) {
    const key = floorSlotKey(candidate);
    const holder = others.find((row) => floorSlotKey(row) === key);
    if (holder) return { clash: isCountedStorey(candidate) ? 'number' : 'kind', withFloorId: holder.id };
  }
  const name = checks.name ? normalizeFloorName(candidate.name) : '';
  if (name !== '') {
    const namesake = others.find((row) => normalizeFloorName(row.name) === name);
    if (namesake) return { clash: 'name', withFloorId: namesake.id };
  }
  const squeezed = checks.elevation ? squeezedNeighbour(others, candidate) : null;
  return squeezed ? { clash: 'elevation', withFloorId: squeezed.id } : null;
}

/** Ομάδες με περισσότερα από ένα μέλη, κατά κλειδί. */
function crowdedGroups(rows: readonly FloorSlotRow[], keyOf: (row: FloorSlotRow) => string): string[][] {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === '') continue;
    groups.set(key, [...(groups.get(key) ?? []), row.id]);
  }
  return [...groups.values()].filter((ids) => ids.length > 1);
}

/**
 * **Οι συγκρούσεις που υπάρχουν ήδη** — δεδομένα που γράφτηκαν έξω από το σύνορο (απευθείας στη βάση) ή πριν από αυτό.
 * Κενός πίνακας ⇒ η στοίβα τηρεί τον κανόνα.
 */
export function findFloorStackConflicts(rows: readonly FloorSlotRow[]): FloorStackConflict[] {
  const slots = crowdedGroups(rows, floorSlotKey).map((floorIds): FloorStackConflict => {
    const first = rows.find((row) => row.id === floorIds[0]);
    return { clash: first && isCountedStorey(first) ? 'number' : 'kind', floorIds };
  });
  const names = crowdedGroups(rows, (row) => normalizeFloorName(row.name)).map(
    (floorIds): FloorStackConflict => ({ clash: 'name', floorIds }),
  );
  return [...slots, ...names, ...findTooLowStoreys(rows)];
}

/**
 * Ζεύγη **διαδοχικών** μετρούμενων ορόφων (κατά αριθμό, μετά υψόμετρο) όπου ο κάτω μένει χωρίς ύψος: ίδιο υψόμετρο,
 * σχεδόν ίδιο, ή αντεστραμμένο. Είναι το ίδιο ζεύγος από το οποίο ο πίνακας ορόφων παράγει το ύψος που δείχνει.
 */
function findTooLowStoreys(rows: readonly FloorSlotRow[]): FloorStackConflict[] {
  const placed = rows.filter(isPlacedStorey).sort((a, b) => a.number - b.number || a.elevation - b.elevation);
  const conflicts: FloorStackConflict[] = [];
  for (let i = 0; i + 1 < placed.length; i++) {
    if (isStoreyTooLow(placed[i].elevation, placed[i + 1].elevation)) {
      conflicts.push({ clash: 'elevation', floorIds: [placed[i].id, placed[i + 1].id] });
    }
  }
  return conflicts;
}

/** Τα ids των ορόφων χωρίς ύψος — ο **κάτω** κάθε ζεύγους: αυτουνού το παράγωγο ύψος είναι άκυρο. */
export function tooLowStoreyIds(rows: readonly FloorSlotRow[]): ReadonlySet<string> {
  return new Set(findTooLowStoreys(rows).map((conflict) => conflict.floorIds[0]));
}

/**
 * Τα ids κάθε ορόφου που μετέχει σε σύγκρουση **μοναδικότητας** (αριθμός/είδος/όνομα) — για το σήμα «διπλός» στο UI.
 * Ο όροφος χωρίς ύψος δεν είναι «διπλός»: έχει δικό του μήνυμα και δική του σήμανση ({@link tooLowStoreyIds}).
 */
export function conflictedFloorIds(rows: readonly FloorSlotRow[]): ReadonlySet<string> {
  return new Set(
    findFloorStackConflicts(rows).filter((conflict) => conflict.clash !== 'elevation').flatMap((conflict) => conflict.floorIds),
  );
}

/**
 * Το `errorCode` της άρνησης (`422`) όταν η διαγραφή θα άφηνε κενό στη στοίβα. Ζει δίπλα στο κατηγόρημα ώστε ο
 * πελάτης να μεταφράζει την άρνηση του διακομιστή με τον **ίδιο** κωδικό που εκείνος ρίχνει.
 */
export const FLOOR_INTERMEDIATE = 'FLOOR_INTERMEDIATE';

/**
 * Είναι ο όροφος **ενδιάμεσος** — μετρούμενος, με μετρούμενο όροφο από κάτω **και** από πάνω; Η διαγραφή του θα
 * άφηνε κενό στη στοίβα (ADR-461 R3: οι ειδικές στάθμες ούτε «σφηνώνουν» ούτε σφηνώνονται).
 *
 * 🔑 Όροφος που **μοιράζεται** τον αριθμό του με άλλον μετρούμενο (σύγκρουση προς επίλυση) **δεν** είναι ενδιάμεσος:
 * η διαγραφή του δεν αφήνει κενό — αφήνει τη στοίβα σωστή. Χωρίς αυτό, ένα διπλότυπο στη μέση κτιρίου δεν θα
 * μπορούσε να σβηστεί ποτέ.
 */
export function isIntermediateStorey(rows: readonly FloorSlotRow[], floorId: string): boolean {
  const target = rows.find((row) => row.id === floorId);
  if (!target || !isCountedStorey(target)) return false;
  const others = rows.filter((row) => row.id !== floorId && isCountedStorey(row));
  if (others.some((row) => row.number === target.number)) return false;
  return others.some((row) => row.number < target.number) && others.some((row) => row.number > target.number);
}
