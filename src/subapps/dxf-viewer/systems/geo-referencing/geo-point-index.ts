/**
 * ADR-650 §M10e — THE VERIFIER. One measuring stick for every candidate alignment.
 *
 * Both branches of the auto-match produce a `GeoReference` by completely different means —
 * Σκέλος Α reads the offset the import recorded (analytic, exact), Σκέλος Β hypothesises one
 * from geometry (search). They are compared HERE, by the same function, against the same
 * tolerance. That is the point: an analytic answer and a searched answer are only comparable
 * if "how well does this fit" has a single definition.
 *
 * The score is deliberately dumb and physical: project every candidate drawing point into
 * world coordinates, and count how many land on a real survey point within τ.
 *
 * ## The one-to-one rule (this is what stops false positives)
 * A world point may be claimed by AT MOST ONE drawing point. Without that rule a degenerate
 * transform — one that collapses the whole drawing onto a small area, or a 180° rotation of
 * a symmetric grid — scores spectacularly by piling dozens of local points onto the same two
 * or three survey points. Every one of those is a "hit" to a naive counter. Enforcing
 * injectivity makes such a transform score ~2 or 3 instead of ~90, and it dies at the gate.
 * This is the same reasoning behind the mutual/one-to-one filters in modern registration
 * (TEASER++, FGR) and it is not optional.
 *
 * Deterministic: local points are visited in array order and the first claim wins, so an
 * ambiguous input resolves the same way on every run.
 *
 * @see ../../core/spatial/PointHashGrid.ts — the indexing primitive
 * @see ./geo-similarity-solve.ts — turns the inlier pairs this produces into the refined fit
 */

import type { Point2D } from '../../rendering/types/Types';
import { PointHashGrid, NO_POINT } from '../../core/spatial/PointHashGrid';
import { localToWorld, type GeoReference } from './geo-transform';
import type { PointPair } from './geo-similarity-solve';

/** An indexed survey point set, ready to be scored against many candidate transforms. */
export interface WorldPointIndex {
  /** The survey points, in ΕΓΣΑ world coords (canonical mm). Indices refer to this array. */
  readonly points: readonly Point2D[];
  readonly grid: PointHashGrid;
  /** The acceptance radius the index was cell-sized for (canonical mm). */
  readonly toleranceMm: number;
}

/** How well one candidate `GeoReference` explains the drawing↔survey correspondence. */
export interface GeoMatchScore {
  /** Drawing points that landed on a DISTINCT survey point within tolerance. */
  readonly inliers: number;
  /** Drawing points tested (the denominator the acceptance gate uses). */
  readonly total: number;
  /** RMS residual over the inliers only, in mm. `0` when there are no inliers. */
  readonly rmsMm: number;
  /** `inliers / total`, or 0 for an empty candidate set. */
  readonly inlierRatio: number;
}

/**
 * Build the reusable index over the survey points.
 *
 * Cell size IS the tolerance: {@link PointHashGrid} then answers each query from the 3×3
 * neighbourhood, which provably covers the radius. Build once, score many candidates
 * against it — the build is the only O(n) part of the whole search.
 */
export function buildWorldPointIndex(points: readonly Point2D[], toleranceMm: number): WorldPointIndex {
  return { points, grid: new PointHashGrid(points, toleranceMm), toleranceMm };
}

/**
 * Score `geo` by projecting `localPoints` into world space and counting injective hits.
 *
 * @param collect optional sink for the matched pairs. Supplied only for the WINNING
 *        candidate (so the refine step can least-squares over its inliers) — the search
 *        itself runs without it and therefore without per-candidate allocation.
 */
export function scoreGeoReference(
  localPoints: readonly Point2D[],
  index: WorldPointIndex,
  geo: GeoReference,
  collect?: (pair: PointPair) => void,
): GeoMatchScore {
  const total = localPoints.length;
  if (total === 0 || index.points.length === 0) {
    return { inliers: 0, total, rmsMm: 0, inlierRatio: 0 };
  }

  // A world point is consumable exactly once — see the one-to-one rule above.
  const claimed = new Uint8Array(index.points.length);
  let inliers = 0;
  let sumSq = 0;

  for (const local of localPoints) {
    const projected = localToWorld(local, geo);
    const hit = nearestUnclaimed(index, claimed, projected);
    if (hit === NO_POINT) continue;

    claimed[hit] = 1;
    inliers++;

    const world = index.points[hit]!;
    sumSq += (projected.x - world.x) ** 2 + (projected.y - world.y) ** 2;
    collect?.({ local, world });
  }

  return {
    inliers,
    total,
    rmsMm: inliers > 0 ? Math.sqrt(sumSq / inliers) : 0,
    inlierRatio: inliers / total,
  };
}

/**
 * Nearest survey point to `projected` that no earlier drawing point has already taken.
 *
 * Note this is greedy-nearest-first-come, not a global optimal assignment (Hungarian). That
 * is intentional: at τ = a few centimetres on a real survey the candidates are effectively
 * unique, so the two agree — and the greedy version costs one 3×3 cell walk instead of an
 * O(n³) matching inside a search loop that runs thousands of times. The gates downstream
 * demand a large inlier count AND a tight RMS, so the rare greedy mis-assignment cannot
 * promote a wrong transform; it can only cost a real one a single inlier.
 */
function nearestUnclaimed(index: WorldPointIndex, claimed: Uint8Array, projected: Point2D): number {
  let best = NO_POINT;
  let bestD2 = Infinity;

  index.grid.forEachWithin(projected.x, projected.y, index.toleranceMm, (i, d2) => {
    if (claimed[i] === 1) return;
    // `<` (not `<=`) plus ascending-index iteration ⇒ ties resolve to the lower index.
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  });

  return best;
}
