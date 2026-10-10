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
 *   - **μοναδικό όνομα** ανά κτίριο (Revit), αγνοώντας πεζά/κεφαλαία, τόνους και κενά.
 * Ίδιο υψόμετρο **δεν** είναι σύγκρουση: η Revit το επιτρέπει, αλλά σπάει την εξαγωγή IFC ⇒ προειδοποίηση.
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
export type FloorSlotCandidate = Omit<FloorSlotRow, 'id' | 'elevation'>;

export type FloorSlotClash = 'number' | 'kind' | 'name';

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
} as const satisfies Record<FloorSlotClash, string>;

export type FloorSlotErrorCode = (typeof FLOOR_SLOT_ERROR_CODES)[FloorSlotClash];

/** Είναι ο κωδικός άρνηση μοναδικότητας ορόφου; */
export function isFloorSlotErrorCode(code: unknown): code is FloorSlotErrorCode {
  return (Object.values(FLOOR_SLOT_ERROR_CODES) as readonly unknown[]).includes(code);
}

/** Μέτρα — δύο στάθμες πιο κοντά από αυτό είναι «στο ίδιο υψόμετρο» (ίδιο κατώφλι με την ανασύνταξη στοίβας). */
const SAME_ELEVATION_EPSILON_M = 1e-4;

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
}

const ALL_CHECKS: FloorSlotChecks = { slot: true, name: true };

/**
 * **Χωράει;** `null` ⇒ ναι. Αλλιώς η πρώτη σύγκρουση, με σειρά: θέση (αριθμός/είδος) → όνομα.
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
  return null;
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
  return [...slots, ...names];
}

/** Τα ids κάθε ορόφου που μετέχει σε **οποιαδήποτε** σύγκρουση — για σήμανση στο UI. */
export function conflictedFloorIds(rows: readonly FloorSlotRow[]): ReadonlySet<string> {
  return new Set(findFloorStackConflicts(rows).flatMap((conflict) => conflict.floorIds));
}

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

/**
 * Ομάδες **μετρούμενων** ορόφων στο ίδιο υψόμετρο — προειδοποίηση, όχι σφάλμα. Οι ειδικές στάθμες εξαιρούνται:
 * η θέση τους παράγεται από τη στοίβα (ADR-461) και δεν είναι επιλογή του ανθρώπου.
 */
export function findSameElevationGroups(rows: readonly FloorSlotRow[]): string[][] {
  const counted = rows
    .filter((row) => isCountedStorey(row) && typeof row.elevation === 'number')
    .sort((a, b) => (a.elevation as number) - (b.elevation as number));
  const groups: string[][] = [];
  let run: FloorSlotRow[] = [];
  for (const row of counted) {
    const anchor = run[0];
    if (anchor && Math.abs((row.elevation as number) - (anchor.elevation as number)) > SAME_ELEVATION_EPSILON_M) {
      if (run.length > 1) groups.push(run.map((member) => member.id));
      run = [];
    }
    run.push(row);
  }
  if (run.length > 1) groups.push(run.map((member) => member.id));
  return groups;
}

/** Οι **άλλοι** όροφοι στο ίδιο υψόμετρο με αυτόν — κενό ⇒ καμία προειδοποίηση. */
export function sameElevationPeersOf(rows: readonly FloorSlotRow[], floorId: string): string[] {
  const group = findSameElevationGroups(rows).find((ids) => ids.includes(floorId));
  return group ? group.filter((id) => id !== floorId) : [];
}
