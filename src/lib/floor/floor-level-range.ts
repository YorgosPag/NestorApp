/**
 * @fileoverview **ΕΥΡΟΣ ΣΤΑΘΜΗΣ** — «από ημιυπόγειο έως 3ο», η **μία** διάταξη στάθμεων (ADR-903 §9 · ADR-900 §8 #2, 2β.3).
 * @module lib/floor/floor-level-range
 *
 * 🔑 Πρότυπο: Spitogatos / xe.gr «Όροφος από–έως» — **διατεταγμένες επώνυμες στάθμες** (Υπόγειο < Ημιυπόγειο <
 * Ισόγειο < Υπερυψωμένο < Ημιώροφος < 1ος…), όχι αριθμοί. Ο αριθμός μόνος δεν φτάνει: ημιυπόγειο και υπόγειο
 * είναι και τα δύο −1, ισόγειο και υπερυψωμένο και τα δύο 0 — και ο Έλληνας αγοραστής **τα ξεχωρίζει**.
 *
 * 🔑 **Το άκρο είναι ζεύγος αριθμός + είδος** — το **ίδιο** ιδίωμα αποθήκευσης με κάθε όροφο του έργου
 * (`floor` + `floorKind`, ADR-903 §8.1). Άκρο **χωρίς** είδος (`kind: null`) = **ολόκληρη** η στάθμη του αριθμού:
 * έτσι κάθε ζήτηση και κάθε σύνδεσμος γραμμένος πριν την 2β.3 (σκέτος ακέραιος) κρίνεται **ακριβώς όπως πριν**,
 * χωρίς μετανάστευση.
 *
 * 🏆 **Μία διάταξη για τρεις πόρτες**: η κρίση της ζήτησης (`demand-match-axes`), το φίλτρο της αναζήτησης
 * (`listing-criteria-judge`) και οι επιλογείς ρωτούν **αυτό** το αρχείο. Η βαθμίδα (`levelRank`) είναι κλειδί
 * σύγκρισης, **ποτέ** δεδομένο: δεν αποθηκεύεται, δεν ταξιδεύει σε URL.
 *
 * Καθαρό — πελάτης και server.
 */

import type { FloorKind } from '@/utils/floor-naming';
import { declaredFloorRefs, type DeclaredFloorOption } from './declared-floor-options';
import { floorRefKey, parseFloorRefKey, resolveFloorKind, type FloorRef } from './floor-ref';

/** Άκρο εύρους: στάθμη με αριθμό· `kind: null` = ολόκληρη η στάθμη (άκρο πριν την 2β.3). */
export interface LevelBound {
  readonly number: number;
  readonly kind: FloorKind | null;
}

/** Εύρος στάθμης — κάθε άκρο προαιρετικό, ανεξάρτητο (ίδιο συμβόλαιο με το `CriterionRange`). */
export interface LevelRange {
  readonly min: LevelBound | null;
  readonly max: LevelBound | null;
}

/** Το ουδέτερο εύρος — καμία ερώτηση. */
export const NO_LEVEL_RANGE: LevelRange = { min: null, max: null };

/** Ποιο άκρο — για την κανονικοποίηση άκρου «ολόκληρης στάθμης» σε επιλογή. */
export type LevelEdge = 'min' | 'max';

/** Ρωτά κάτι αυτό το εύρος; Κενό εύρος = όχι. */
export function isAskedLevelRange(range: LevelRange | undefined): range is LevelRange {
  return range !== undefined && (range.min !== null || range.max !== null);
}

// ─── Η διάταξη ───────────────────────────────────────────────────────────────

/** Στρώματα μέσα σε μία στάθμη (ίδιος αριθμός). Πυλωτή ≡ ισόγειο: εναλλακτικές, όχι στοιβαγμένες. */
const STRATUM: Readonly<Record<FloorKind, number>> = {
  foundation: 0,
  basement: 0,
  'semi-basement': 1,
  ground: 0,
  pilotis: 0,
  'raised-ground': 1,
  mezzanine: 2,
  standard: 0,
  roof: 3,
  attic: 3,
  'stair-penthouse': 3,
};

/** Στρώματα ανά στάθμη — το «ολόκληρη η στάθμη» καλύπτει `[n×SPAN, n×SPAN + SPAN − 1]`. */
const SPAN = 4;

function levelRank(number: number, kind: FloorKind): number {
  return number * SPAN + STRATUM[kind];
}

function lowerRank(bound: LevelBound): number {
  return bound.kind === null ? bound.number * SPAN : levelRank(bound.number, bound.kind);
}

function upperRank(bound: LevelBound): number {
  return bound.kind === null ? bound.number * SPAN + SPAN - 1 : levelRank(bound.number, bound.kind);
}

/**
 * Είναι η στάθμη μέσα στο εύρος; Στάθμη **χωρίς αριθμό** (δώμα/σοφίτα παλιού κειμένου) ⇒ `false`: η θέση της
 * εξαρτάται από το ύψος του κτιρίου — ίδια συμπεριφορά με το παλιό `withinRange(null, …)`.
 */
export function withinLevelRange(ref: FloorRef, range: LevelRange): boolean {
  if (ref.number === null) return false;
  const rank = levelRank(ref.number, resolveFloorKind(ref));
  if (range.min !== null && rank < lowerRank(range.min)) return false;
  if (range.max !== null && rank > upperRank(range.max)) return false;
  return true;
}

/** Αντεστραμμένο εύρος («από 2ο έως ισόγειο») — η **μία** απάντηση για ζήτηση και φίλτρο. */
export function levelRangeInverted(range: LevelRange): boolean {
  return range.min !== null && range.max !== null && lowerRank(range.min) > upperRank(range.max);
}

// ─── Το ζεύγος αποθήκευσης ⇄ εύρος ──────────────────────────────────────────

/** Τα τέσσερα πεδία της ζήτησης (`floorMin` + `floorMinKind` · `floorMax` + `floorMaxKind`). */
export interface LevelRangePairs {
  readonly floorMin: number | null;
  readonly floorMinKind?: FloorKind | null;
  readonly floorMax: number | null;
  readonly floorMaxKind?: FloorKind | null;
}

function boundOf(number: number | null, kind: FloorKind | null | undefined): LevelBound | null {
  if (number === null || !Number.isInteger(number)) return null;
  return { number, kind: kind ?? null };
}

/** Ζεύγη ⇒ εύρος. Απόν είδος (έγγραφο πριν την 2β.3) ⇒ ολόκληρη η στάθμη. */
export function levelRangeOf(pairs: LevelRangePairs): LevelRange {
  return { min: boundOf(pairs.floorMin, pairs.floorMinKind), max: boundOf(pairs.floorMax, pairs.floorMaxKind) };
}

/** Εύρος ⇒ ζεύγη (πάντα και τα τέσσερα πεδία — κανένα «μισό» άκρο). */
export function levelRangePairs(range: LevelRange): Required<LevelRangePairs> {
  return {
    floorMin: range.min?.number ?? null,
    floorMinKind: range.min?.kind ?? null,
    floorMax: range.max?.number ?? null,
    floorMaxKind: range.max?.kind ?? null,
  };
}

// ─── Κλειδί άκρου (URL · τιμή επιλογέα) ──────────────────────────────────────

/** Άκρο ⇒ κλειδί: `'0:raised-ground'`, ή σκέτος ακέραιος για ολόκληρη στάθμη (ίδια μορφή με πριν την 2β.3). */
export function levelBoundKey(bound: LevelBound): string {
  return bound.kind === null ? String(bound.number) : floorRefKey(bound);
}

/** Το αντίστροφο. Σκέτος ακέραιος (παλιός σύνδεσμος) ⇒ ολόκληρη στάθμη· στάθμη χωρίς αριθμό ⇒ `null`. */
export function parseLevelBoundKey(key: string): LevelBound | null {
  const trimmed = key.trim();
  if (/^-?\d+$/.test(trimmed)) return { number: Number.parseInt(trimmed, 10), kind: null };
  const ref = parseFloorRefKey(trimmed);
  if (ref === null || ref.number === null) return null;
  return { number: ref.number, kind: ref.kind };
}

// ─── Οι επιλογές ─────────────────────────────────────────────────────────────

/** Η λίστα της δηλωμένης στάθμης, **μία επιλογή ανά βαθμίδα** (η πυλωτή συμπίπτει με το ισόγειο). */
function rangeRefs(): FloorRef[] {
  const seen = new Set<number>();
  return declaredFloorRefs().filter((ref) => {
    const rank = levelRank(ref.number ?? 0, resolveFloorKind(ref));
    if (seen.has(rank)) return false;
    seen.add(rank);
    return true;
  });
}

/**
 * Η επιλογή που **αντιστοιχεί** σε ένα άκρο. Άκρο ολόκληρης στάθμης (παλιό) ⇒ το χαμηλότερο στρώμα της στάθμης
 * για «από», το υψηλότερο για «έως» — η ίδια κρίση, γραμμένη με επώνυμη στάθμη.
 */
function optionRefOf(bound: LevelBound, edge: LevelEdge, refs: readonly FloorRef[]): FloorRef {
  if (bound.kind !== null) return bound;
  const atLevel = refs.filter((ref) => ref.number === bound.number);
  if (atLevel.length === 0) return { number: bound.number, kind: null };
  return edge === 'min' ? atLevel[0] : atLevel[atLevel.length - 1];
}

/** Η τιμή του επιλογέα για ένα άκρο (`''` = δεν ρωτήθηκε). */
export function levelSelectValue(bound: LevelBound | null, edge: LevelEdge): string {
  if (bound === null) return '';
  return floorRefKey(optionRefOf(bound, edge, rangeRefs()));
}

/** Οι δύο τιμές επιλογέα ενός εύρους — ο **ένας** δρόμος εύρος ⇒ φόρμα (φόρτωση ζήτησης · φίλτρα ⇒ ζήτηση). */
export function levelRangeSelectValues(range: LevelRange): { readonly min: string; readonly max: string } {
  return { min: levelSelectValue(range.min, 'min'), max: levelSelectValue(range.max, 'max') };
}

/**
 * Οι επιλογές ενός άκρου, κατά στάθμη — και το τρέχον άκρο αν είναι εκτός λίστας (π.χ. 35ος): ένα πεδίο που
 * δεν μπορεί να δείξει την αποθηκευμένη τιμή θα την έσβηνε σιωπηλά στην πρώτη αποθήκευση.
 */
export function floorRangeOptions(current: LevelBound | null, edge: LevelEdge): readonly DeclaredFloorOption[] {
  const refs = rangeRefs();
  if (current !== null) {
    const ref = optionRefOf(current, edge, refs);
    if (!refs.some((r) => floorRefKey(r) === floorRefKey(ref))) {
      refs.push(ref);
      refs.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    }
  }
  return refs.map((ref) => ({ value: floorRefKey(ref), ref }));
}

/** Τιμή επιλογέα ⇒ άκρο (`''` ⇒ `null`). Η επιλογή φέρει **πάντα** είδος. */
export function levelBoundOfSelect(value: string): LevelBound | null {
  if (value === '') return null;
  const ref = parseFloorRefKey(value);
  if (ref === null || ref.number === null) return null;
  return { number: ref.number, kind: resolveFloorKind(ref) };
}
