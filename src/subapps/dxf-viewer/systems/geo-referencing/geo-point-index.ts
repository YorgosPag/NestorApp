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
 * ## 🔴 The index is built over EITHER side — and which one matters enormously (v23)
 * The one-to-one rule caps the score at `min(|drawing|, |survey|)`. On the reference file that
 * is `min(1500, 93) = 93` — so asking the question drawing-first performs 1 500 lookups to
 * discover at most 93 facts, and does it once per hypothesis, 2 456 times. Asking it
 * survey-first performs 93. Same correspondences, same tolerance, **16× fewer probes**, and
 * it is not an approximation: it is the same question addressed to the smaller set.
 *
 * The asymmetry is structural, not incidental — a survey CSV is tens to hundreds of points
 * while a site plan is thousands — so the index goes over the side that does NOT change
 * between hypotheses (the drawing), and the small side is what gets projected and probed.
 * {@link scoreGeoReference} keeps the drawing-first direction because it is the direction the
 * PROOF is stated in (points of the drawing that landed, and their residual);
 * {@link countExplainedPoints} is the survey-first direction the search runs in.
 *
 * Deterministic: source points are visited in array order and the first claim wins, so an
 * ambiguous input resolves the same way on every run.
 *
 * @see ../../core/spatial/PointHashGrid.ts — the indexing primitive
 * @see ./geo-transform.ts — `RigidMap`: both directions, one formula, trig hoisted
 * @see ./geo-similarity-solve.ts — turns the inlier pairs this produces into the refined fit
 */

import type { Point2D } from '../../rendering/types/Types';
import { PointHashGrid, NO_POINT } from '../../core/spatial/PointHashGrid';
import {
  forwardRigidMap, inverseRigidMap, mapX, mapY, type GeoReference, type RigidMap,
} from './geo-transform';
import type { PointPair } from './geo-similarity-solve';

/**
 * An indexed point set, ready to be probed by many candidate transforms.
 *
 * Named for what it IS rather than which side it holds: the search indexes the DRAWING and
 * the proof indexes the SURVEY, and a type called `WorldPointIndex` doing both would be a
 * name that lies about half its uses.
 */
export interface PointSetIndex {
  /** The indexed points, in whatever frame the caller indexed (canonical mm). */
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
 * Build the reusable index over a point set.
 *
 * Cell size IS the tolerance: {@link PointHashGrid} then answers each query from the 3×3
 * neighbourhood, which provably covers the radius. Build once, probe many candidates
 * against it — the build is the only O(n) part of the whole search.
 */
export function buildPointSetIndex(points: readonly Point2D[], toleranceMm: number): PointSetIndex {
  return { points, grid: new PointHashGrid(points, toleranceMm), toleranceMm };
}

/** What one pass of {@link accumulateMatches} found. */
interface MatchTally {
  readonly inliers: number;
  /** Σ of squared residuals over the inliers — the RMS numerator. */
  readonly sumSq: number;
}

/**
 * The ONE matching kernel: project `source` through `map` and count injective landings in
 * `index`. Both public scorers are this function with a different map and a different index;
 * writing the loop twice — once per direction — is exactly the structural clone N.18 forbids.
 *
 * @param abandonBelow stop as soon as the tally provably cannot reach this count. `0` disables
 *        it. See {@link countExplainedPoints} for why abandoning is lossless where it is used.
 * @param collect optional sink receiving each (source, matched) pair, in visit order.
 */
function accumulateMatches(
  source: readonly Point2D[],
  map: RigidMap,
  index: PointSetIndex,
  abandonBelow: number,
  collect: ((sourcePoint: Point2D, matched: Point2D) => void) | undefined,
): MatchTally {
  // A target point is consumable exactly once — see the one-to-one rule above.
  const claimed = new Uint8Array(index.points.length);
  const n = source.length;
  let inliers = 0;
  let sumSq = 0;

  for (let i = 0; i < n; i++) {
    // Best case from here is «every remaining source point lands». If even that is not
    // enough, nothing this candidate can still do will matter to the caller.
    if (inliers + (n - i) < abandonBelow) break;

    const p = source[i]!;
    const px = mapX(map, p.x, p.y);
    const py = mapY(map, p.x, p.y);
    const hit = nearestUnclaimed(index, claimed, px, py);
    if (hit === NO_POINT) continue;

    claimed[hit] = 1;
    inliers++;

    const target = index.points[hit]!;
    sumSq += (px - target.x) ** 2 + (py - target.y) ** 2;
    collect?.(p, target);
  }

  return { inliers, sumSq };
}

/**
 * Score `geo` by projecting `localPoints` into world space and counting injective hits.
 *
 * This is the direction the PROOF CARD speaks in — «N points of the drawing landed, with an
 * RMS of x mm» — so it visits every candidate point and reports the full residual. The search
 * does not use it: see {@link countExplainedPoints}.
 *
 * @param collect optional sink for the matched pairs. Supplied only for the WINNING
 *        candidate (so the refine step can least-squares over its inliers) — the search
 *        itself runs without it and therefore without per-candidate allocation.
 */
export function scoreGeoReference(
  localPoints: readonly Point2D[],
  index: PointSetIndex,
  geo: GeoReference,
  collect?: (pair: PointPair) => void,
): GeoMatchScore {
  const total = localPoints.length;
  if (total === 0 || index.points.length === 0) {
    return { inliers: 0, total, rmsMm: 0, inlierRatio: 0 };
  }

  const sink = collect ? (local: Point2D, world: Point2D) => collect({ local, world }) : undefined;
  const tally = accumulateMatches(localPoints, forwardRigidMap(geo), index, 0, sink);

  return {
    inliers: tally.inliers,
    total,
    rmsMm: tally.inliers > 0 ? Math.sqrt(tally.sumSq / tally.inliers) : 0,
    inlierRatio: tally.inliers / total,
  };
}

/**
 * How many SURVEY points `geo` explains — the search-side score.
 *
 * Same correspondences as {@link scoreGeoReference}, asked from the smaller set: the survey
 * points are pulled back into the drawing's frame and probed against an index of the drawing,
 * which is fixed for the whole search and therefore built once. On the reference file that is
 * 93 probes per hypothesis instead of 1 500.
 *
 * ## `abandonBelow` is LOSSLESS here — this is why
 * The caller passes `leader.inliers / UNIQUENESS_FACTOR`. A candidate that cannot reach that
 * count can affect neither outcome the search has:
 *   - it cannot become the winner, since that bound is strictly below the current leader, and
 *     the leader only ever grows;
 *   - it cannot make the uniqueness gate fire, because that gate asks whether a rival is
 *     within a factor of `UNIQUENESS_FACTOR` of the winner — and this one provably is not.
 * The partial count returned for an abandoned candidate is therefore never read for anything
 * it could change. Not a heuristic, not a probability: the search's output is bit-identical to
 * scoring every candidate to the end. (Contrast with preemptive RANSAC (Nistér 2005) and the
 * T_{d,d} test (Chum & Matas), which discard on a SAMPLE and accept a real chance of dropping
 * the true hypothesis. We take the same speedup without that trade because our bound is a
 * provable one, not a statistical one.)
 */
export function countExplainedPoints(
  surveyPoints: readonly Point2D[],
  drawingIndex: PointSetIndex,
  geo: GeoReference,
  abandonBelow = 0,
): number {
  if (surveyPoints.length === 0 || drawingIndex.points.length === 0) return 0;
  return accumulateMatches(surveyPoints, inverseRigidMap(geo), drawingIndex, abandonBelow, undefined).inliers;
}

/**
 * Nearest indexed point to `(px, py)` that no earlier source point has already taken.
 *
 * Note this is greedy-nearest-first-come, not a global optimal assignment (Hungarian). That
 * is intentional: at τ = a few centimetres on a real survey the candidates are effectively
 * unique, so the two agree — and the greedy version costs one 3×3 cell walk instead of an
 * O(n³) matching inside a search loop that runs thousands of times. The gates downstream
 * demand a large inlier count AND a tight RMS, so the rare greedy mis-assignment cannot
 * promote a wrong transform; it can only cost a real one a single inlier.
 */
function nearestUnclaimed(index: PointSetIndex, claimed: Uint8Array, px: number, py: number): number {
  let best = NO_POINT;
  let bestD2 = Infinity;

  index.grid.forEachWithin(px, py, index.toleranceMm, (i, d2) => {
    if (claimed[i] === 1) return;
    // `<` (not `<=`) plus ascending-index iteration ⇒ ties resolve to the lower index.
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  });

  return best;
}
