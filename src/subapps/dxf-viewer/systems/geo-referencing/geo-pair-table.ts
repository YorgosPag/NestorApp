/**
 * ADR-650 §M10e — THE INVARIANT TABLE: every pairwise distance of a point set.
 *
 * Under a rigid transform (rotation + translation, no scale) the distance between two points
 * is INVARIANT. That single fact is the whole basis of the blind match: if survey points
 * `W₀,W₁` are 87.412 m apart, then whichever two drawing points correspond to them are also
 * 87.412 m apart — so instead of trying all n² drawing pairs against all m² survey pairs, we
 * take a survey pair and ask only for the drawing pairs at THAT length.
 *
 * This is 4PCS/Super4PCS's «smart indexing» insight, reduced to what our problem actually is.
 * Those algorithms use FOUR coplanar points per base because they solve 3-D registration with
 * an unknown scale, where only a RATIO is invariant and four points are the minimum that
 * carries one. In 2-D with a known scale a single distance is already a complete invariant
 * and TWO correspondences determine the transform exactly — so the four-point machinery buys
 * nothing here and costs a great deal. Same insight, correct minimal form.
 *
 * ## Why a linear scan, and no sorted index
 * The obvious structure is «sort by distance, binary-search the band». We do not, on purpose:
 * the number of QUERIES is tiny (a dozen bases), while the table has ~10⁵–10⁶ rows. Sorting
 * 10⁶ rows to answer 12 queries costs more than 12 linear scans of them — a scan is ~1 ms
 * over 160 k rows on typed arrays, and it needs no permutation array (which would add another
 * 4 MB and another thing to keep consistent). Sorting wins only when queries outnumber log n.
 *
 * ## Typed arrays, not objects
 * 160 k `{a, b, d}` objects is 160 k allocations the GC must trace during an interactive
 * action. Three parallel typed arrays are one allocation each and stay in cache during the
 * scan, which is the only part of this that runs a million times.
 *
 * Pure module — zero React/DOM/store deps, fully deterministic.
 *
 * @see ./geo-congruent-match.ts — the search this table serves
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * Hard ceiling on the point count a table may be built from. `n = 3000` is already
 * ~4.5 M rows / ~54 MB; anything above it is a caller that forgot to cap its input, and
 * failing loudly here beats an out-of-memory crash inside a user's click.
 */
export const MAX_PAIR_TABLE_POINTS = 3_000;

/** All pairwise distances of a point set, as parallel typed arrays. */
export interface PairTable {
  /** The indexed points (same array the caller passed) — indices refer to this. */
  readonly points: readonly Point2D[];
  /** `distance[k]` = ‖points[indexA[k]] − points[indexB[k]]‖, canonical mm. */
  readonly distance: Float64Array;
  readonly indexA: Int32Array;
  readonly indexB: Int32Array;
  /** Number of valid rows (`n·(n−1)/2`). */
  readonly count: number;
}

/** Two points of a set, used as the reference segment of a hypothesis. */
export interface Basis {
  readonly a: number;
  readonly b: number;
  readonly lengthMm: number;
}

/**
 * Build the full pairwise-distance table of `points`.
 *
 * @throws when `points.length` exceeds {@link MAX_PAIR_TABLE_POINTS} — see the constant.
 */
export function buildPairTable(points: readonly Point2D[]): PairTable {
  const n = points.length;
  if (n > MAX_PAIR_TABLE_POINTS) {
    throw new Error(`buildPairTable: ${n} points exceeds the ${MAX_PAIR_TABLE_POINTS} ceiling — cap the input first`);
  }

  const count = (n * (n - 1)) / 2;
  const distance = new Float64Array(count);
  const indexA = new Int32Array(count);
  const indexB = new Int32Array(count);

  let k = 0;
  for (let i = 0; i < n; i++) {
    const pi = points[i]!;
    for (let j = i + 1; j < n; j++) {
      const pj = points[j]!;
      distance[k] = Math.hypot(pj.x - pi.x, pj.y - pi.y);
      indexA[k] = i;
      indexB[k] = j;
      k++;
    }
  }

  return { points, distance, indexA, indexB, count };
}

/**
 * Visit every pair whose length is within `toleranceMm` of `distanceMm`, in table order.
 *
 * The tolerance must account for BOTH endpoints being imprecise: a point accurate to τ makes
 * a distance accurate to 2τ, so callers pass twice their point tolerance rather than the
 * point tolerance itself — otherwise the correct pair falls outside the band and the true
 * match is never even hypothesised.
 */
export function forEachPairNear(
  table: PairTable,
  distanceMm: number,
  toleranceMm: number,
  visit: (a: number, b: number, lengthMm: number) => void,
): void {
  const { distance, indexA, indexB, count } = table;
  const low = distanceMm - toleranceMm;
  const high = distanceMm + toleranceMm;

  for (let k = 0; k < count; k++) {
    const d = distance[k]!;
    if (d >= low && d <= high) visit(indexA[k]!, indexB[k]!, d);
  }
}

/** Insert `row` into a descending-by-length buffer of at most `capacity` entries. */
function insertLongest(buffer: Basis[], row: Basis, capacity: number): void {
  if (buffer.length === capacity && row.lengthMm <= buffer[buffer.length - 1]!.lengthMm) return;

  // `>` (not `>=`) keeps equal-length rows in table order — identical input, identical bases.
  let at = buffer.length;
  while (at > 0 && row.lengthMm > buffer[at - 1]!.lengthMm) at--;
  buffer.splice(at, 0, row);
  if (buffer.length > capacity) buffer.pop();
}

/**
 * The `maxBases` longest segments of the set, no two of which share an endpoint.
 *
 * LONGEST because rotation precision is what a basis buys: endpoints accurate to τ on a
 * segment of length L pin the rotation to about `2τ/L`, so a 90 m basis is an order of
 * magnitude sharper than a 9 m one, and the hypothesis it generates lands its far points
 * within tolerance instead of just outside it.
 *
 * ENDPOINT-DISJOINT because bases that share a point are not independent evidence: one gross
 * blunder at that shared point would poison every hypothesis derived from it, and the search
 * would spend its whole budget re-testing the same mistake.
 *
 * A wider candidate buffer than `maxBases` is scanned so that discarding overlapping rows
 * still leaves enough survivors to fill the quota.
 */
export function selectLongestBases(table: PairTable, maxBases: number): readonly Basis[] {
  if (maxBases <= 0 || table.count === 0) return [];

  const buffer: Basis[] = [];
  const capacity = Math.min(table.count, maxBases * 8);
  for (let k = 0; k < table.count; k++) {
    insertLongest(buffer, { a: table.indexA[k]!, b: table.indexB[k]!, lengthMm: table.distance[k]! }, capacity);
  }

  const used = new Set<number>();
  const chosen: Basis[] = [];
  for (const basis of buffer) {
    if (chosen.length >= maxBases) break;
    // A zero-length segment carries no direction at all — it can never pin a rotation.
    if (basis.lengthMm <= 0 || used.has(basis.a) || used.has(basis.b)) continue;
    used.add(basis.a);
    used.add(basis.b);
    chosen.push(basis);
  }
  return chosen;
}
