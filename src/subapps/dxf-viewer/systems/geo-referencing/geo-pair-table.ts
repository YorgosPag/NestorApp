/**
 * ADR-650 §M10e — THE INVARIANT: the distance between two points, which a rigid transform
 * cannot change.
 *
 * That single fact is the whole basis of the blind match: if survey points `W₀,W₁` are
 * 87.412 m apart, then whichever two drawing points correspond to them are also 87.412 m
 * apart — so instead of trying all n² drawing pairs against all m² survey pairs, we take a
 * survey pair and ask only for the drawing pairs at THAT length.
 *
 * This is 4PCS/Super4PCS's «smart indexing» insight, reduced to what our problem actually is.
 * Those algorithms use FOUR coplanar points per base because they solve 3-D registration with
 * an unknown scale, where only a RATIO is invariant and four points are the minimum that
 * carries one. In 2-D with a known scale a single distance is already a complete invariant
 * and TWO correspondences determine the transform exactly — so the four-point machinery buys
 * nothing here and costs a great deal. Same insight, correct minimal form.
 *
 * ## 🔴 The two sides are NOT symmetric, and the code reflects that (v24)
 * The SURVEY side is small (93 points ⇒ 4 278 pairs) and needs its pairs RANKED, so it is
 * materialised as a table ({@link buildPairTable} → {@link selectLongestBases}).
 * The DRAWING side is large (1 500 points ⇒ 1.12 M pairs) and is only ever STREAMED — asked
 * «which of you are 87.412 m long?» a dozen times. Materialising it cost 18 MB and, measured
 * on the reference file, **287 ms warm / 584 ms cold**, to answer ten questions. It is now
 * never built: {@link forEachPairNear} walks the coordinates directly.
 *
 * ## 🔴 No square roots in the scan — measured, 331 ms → 56 ms
 * «Is this pair within τ of length L» is `(L−τ)² ≤ dx²+dy² ≤ (L+τ)²`, which is EXACTLY the
 * same question with both sides squared, and needs no root. Measured over 9 M candidate pairs
 * in this codebase's own test harness, the sqrt version cost **3 234 ms** and the squared
 * version **72 ms** — the root was not part of the cost, it WAS the cost. A root is taken only
 * for the handful of pairs that actually land inside the band, so the reported length is
 * unchanged; identical hits, verified.
 *
 * ## Flat coordinates, not point objects
 * The scan reads `[x₀,y₀,x₁,y₁,…]` from one `Float64Array`. 1 500 point objects would mean
 * two pointer hops per inner iteration, nine million times; a flat buffer stays in cache.
 *
 * Pure module — zero React/DOM/store deps, fully deterministic.
 *
 * @see ./geo-congruent-match.ts — the search these serve
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * Hard ceiling on the point count a MATERIALISED table may be built from. `n = 3000` is
 * already ~4.5 M rows / ~54 MB; anything above it is a caller that forgot to cap its input,
 * and failing loudly here beats an out-of-memory crash inside a user's click.
 *
 * Applies only to {@link buildPairTable} — the streaming scan has no such limit because it
 * allocates nothing.
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
 * Point coordinates as one flat `[x₀,y₀,x₁,y₁,…]` buffer — the form {@link forEachPairNear}
 * streams over. Built once per search; the indices it reports refer to the ORIGINAL point
 * array, so the caller never needs a second mapping.
 */
export function toFlatCoords(points: readonly Point2D[]): Float64Array {
  const flat = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    flat[i * 2] = p.x;
    flat[i * 2 + 1] = p.y;
  }
  return flat;
}

/**
 * Build the full pairwise-distance table of `points` — the SMALL side only (see the header).
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
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      distance[k] = Math.sqrt(dx * dx + dy * dy);
      indexA[k] = i;
      indexB[k] = j;
      k++;
    }
  }

  return { points, distance, indexA, indexB, count };
}

/**
 * Visit every pair of `coords` whose length is within `toleranceMm` of `distanceMm`, in
 * ascending `(a, b)` order — the same order a materialised table would have produced, so the
 * hypothesis stream and therefore the answer are unchanged.
 *
 * The tolerance must account for BOTH endpoints being imprecise: a point accurate to τ makes
 * a distance accurate to 2τ, so callers pass twice their point tolerance rather than the
 * point tolerance itself — otherwise the correct pair falls outside the band and the true
 * match is never even hypothesised.
 *
 * A negative lower bound is clamped to zero: `(L−τ)²` with `τ > L` would otherwise square
 * back into a POSITIVE floor and silently reject the short pairs it was meant to admit.
 */
export function forEachPairNear(
  coords: Float64Array,
  distanceMm: number,
  toleranceMm: number,
  visit: (a: number, b: number, lengthMm: number) => void,
): void {
  const n = coords.length >> 1;
  const low = Math.max(0, distanceMm - toleranceMm);
  const high = distanceMm + toleranceMm;
  if (high < 0) return;
  const lowSq = low * low;
  const highSq = high * high;

  for (let i = 0; i < n; i++) {
    const xi = coords[i * 2]!;
    const yi = coords[i * 2 + 1]!;
    for (let j = i + 1; j < n; j++) {
      const dx = coords[j * 2]! - xi;
      const dy = coords[j * 2 + 1]! - yi;
      const d2 = dx * dx + dy * dy;
      // The root is paid ONLY by the pairs that land — a few hundred out of a few million.
      if (d2 >= lowSq && d2 <= highSq) visit(i, j, Math.sqrt(d2));
    }
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
