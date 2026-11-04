/**
 * =============================================================================
 * ΣΥΝΟΛΑ ΔΙΑΣΤΗΜΑΤΩΝ ΣΤΗΝ ΕΥΘΕΙΑ (SSoT) — ένωση, τομή, διαφορά, κάλυψη
 * =============================================================================
 *
 * Ένα σύνολο είναι **κανονικοποιημένος** πίνακας κλειστών διαστημάτων `[lo, hi]`, ταξινομημένων, ξένων μεταξύ τους
 * και μη κενών (`hi > lo`). Κάθε πράξη δέχεται κανονικοποιημένα σύνολα και επιστρέφει κανονικοποιημένο σύνολο, άρα οι
 * πράξεις συντίθενται χωρίς δεύτερο πέρασμα.
 *
 * Χρήση: η κάλυψη μιας ευθείας από τμήματα (παρειές τοίχων, ADR-929 Φ2 / ADR-911 Δ5): ποιο κομμάτι μιας παρειάς
 * έχει απέναντι παρειά, ποιο έχει ήδη χρησιμοποιηθεί, πού υπάρχει κενό.
 *
 * Καθαρό, χωρίς εξαρτήσεις.
 *
 * @module lib/geometry/interval-set
 */

export interface Interval {
  readonly lo: number;
  readonly hi: number;
}

export type IntervalSet = readonly Interval[];

/**
 * Κανονικοποίηση: ταξινόμηση + συγχώνευση όσων απέχουν ≤ `joinGap` (0 ⇒ μόνο όσα αγγίζουν ή επικαλύπτονται).
 * Τα κενά ή ανάποδα διαστήματα πετιούνται.
 */
export function normalizeIntervals(intervals: readonly Interval[], joinGap = 0): Interval[] {
  const sorted = intervals.filter((i) => i.hi > i.lo).sort((a, b) => a.lo - b.lo);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.lo - last.hi <= joinGap) out[out.length - 1] = { lo: last.lo, hi: Math.max(last.hi, i.hi) };
    else out.push(i);
  }
  return out;
}

/** Τομή δύο κανονικοποιημένων συνόλων, σε O(n + m). */
export function intersectIntervals(a: IntervalSet, b: IntervalSet): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i].lo, b[j].lo);
    const hi = Math.min(a[i].hi, b[j].hi);
    if (hi > lo) out.push({ lo, hi });
    if (a[i].hi < b[j].hi) i++;
    else j++;
  }
  return out;
}

/** Διαφορά `a − b`, σε O(n + m). */
export function subtractIntervals(a: IntervalSet, b: IntervalSet): Interval[] {
  const out: Interval[] = [];
  let j = 0;
  for (const { lo, hi } of a) {
    let cursor = lo;
    while (j < b.length && b[j].hi <= cursor) j++;
    let k = j;
    while (k < b.length && b[k].lo < hi) {
      if (b[k].lo > cursor) out.push({ lo: cursor, hi: b[k].lo });
      cursor = Math.max(cursor, b[k].hi);
      k++;
    }
    if (cursor < hi) out.push({ lo: cursor, hi });
  }
  return out;
}

/** Ένωση δύο κανονικοποιημένων συνόλων. */
export function unionIntervals(a: IntervalSet, b: IntervalSet): Interval[] {
  return normalizeIntervals([...a, ...b]);
}

/** `true` όταν το σύνολο καλύπτει **ολόκληρο** το `[lo, hi]`, με ανοχή `tol` σε κάθε άκρο. */
export function coversInterval(set: IntervalSet, lo: number, hi: number, tol = 0): boolean {
  return set.some((i) => i.lo <= lo + tol && i.hi >= hi - tol);
}

/** Το διάστημα του συνόλου που περιέχει το `x` (με ανοχή `tol`), ή `null`. */
export function intervalContaining(set: IntervalSet, x: number, tol = 0): Interval | null {
  return set.find((i) => i.lo - tol <= x && x <= i.hi + tol) ?? null;
}
