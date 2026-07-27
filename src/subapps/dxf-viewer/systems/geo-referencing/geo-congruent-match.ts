/**
 * ADR-650 §M10e — THE BLIND MATCH: deterministic enumeration of congruent bases.
 *
 * No labels, no known correspondences, no user picks: two point sets, and the question of
 * whether one is a rotated-and-translated copy of part of the other. This is the branch that
 * handles a drawing a surveyor moved in CAD «for convenience».
 *
 * ## Why this is NOT RANSAC — a deliberate reversal of the original blueprint
 * The plan of record said «RANSAC with a seeded PRNG». The literature has moved past that and
 * so have we. Super4PCS showed that smart indexing of the invariant reduces congruent-set
 * search from O(n²) to O(n): you ENUMERATE the compatible bases instead of drawing them from
 * a hat. TEASER++ reports dominating «all RANSAC variants» while running in milliseconds.
 * astrometry.net solves the same blind-correspondence problem with invariant hashing and zero
 * randomness. At our sizes — 93 survey points, ~560 drawing nodes — sampling is not merely
 * unnecessary, it is strictly worse: exhaustive enumeration is fast enough AND complete, so
 * there is no «unlucky seed» in which a real match is missed. A geo-reference that depends on
 * a random draw is a geo-reference the engineer cannot reproduce, and reproducibility is not
 * negotiable for something that ends up in `Project.basePoint`.
 *
 * ## The enumeration
 *   1. Take the K longest, endpoint-disjoint segments of the SURVEY (longest ⇒ sharpest angle).
 *   2. For each, find every DRAWING segment of the same length, within tolerance. Invariance
 *      guarantees the true counterpart is among them.
 *   3. Each such segment pair yields TWO hypotheses — the endpoints may correspond either way
 *      round. Testing only one order silently discards half the solution space, and it is the
 *      half that contains the answer exactly as often as the other.
 *   4. Score every surviving hypothesis with the ONE verifier, keep the best and the runner-up.
 *   5. Refine the winner by least squares over its own inliers.
 *
 * ## Search set vs. verification set
 * Hypotheses are scored during the search against the compact node sample, and the WINNER is
 * re-scored against the full candidate set. Searching over everything would multiply the cost
 * by the ratio of the two sets for no extra discrimination; verifying over everything is what
 * makes the reported inlier count honest. Never the other way round.
 *
 * Pure module — zero React/DOM/store deps, zero randomness, fully deterministic.
 *
 * @see ./geo-pair-table.ts — the invariant table and the basis selection
 * @see ./geo-point-index.ts — the verifier (and its one-to-one rule)
 * @see ./geo-similarity-solve.ts — the least-squares refinement
 */

import type { Point2D } from '../../rendering/types/Types';
import { fromTwoPointPairs, type GeoReference } from './geo-transform';
import { scoreGeoReference, type GeoMatchScore, type WorldPointIndex } from './geo-point-index';
import { solveRigid2D, type PointPair } from './geo-similarity-solve';
import { buildPairTable, forEachPairNear, selectLongestBases, type PairTable } from './geo-pair-table';

export interface CongruentMatchOptions {
  /** Point acceptance radius, canonical mm. The segment band is twice this — both ends err. */
  readonly toleranceMm: number;
  /** How many survey bases to enumerate. Default 12. */
  readonly maxBases?: number;
}

const DEFAULT_MAX_BASES = 12;

/** Two references are «the same answer» within this much translation / rotation. */
const SAME_GEO_POSITION_MM = 1;
const SAME_GEO_ROTATION_DEG = 0.01;

export interface CongruentMatch {
  /** The refined reference — least squares over the winner's inliers, never the raw hypothesis. */
  readonly geo: GeoReference;
  /** The winner's score against the FULL candidate set. */
  readonly score: GeoMatchScore;
  /** Inliers of the best MATERIALLY DIFFERENT runner-up — the uniqueness gate's denominator. */
  readonly secondBestInliers: number;
  /**
   * DIAGNOSTIC ONLY — the scale the winning correspondences wanted. Never applied; a value
   * far from 1 is the caller's evidence for reporting a unit mismatch instead of a match.
   */
  readonly scaleEstimate: number;
  /** Correspondences the refinement used (diagnostics + the scale check). */
  readonly pairs: readonly PointPair[];
  /** How many hypotheses were actually scored — shown in the proof card as work done. */
  readonly hypotheses: number;
}

/** `true` when two references would put the drawing in the same place, to within a millimetre. */
function sameGeoReference(a: GeoReference, b: GeoReference): boolean {
  return (
    Math.abs(a.originWorld.x - b.originWorld.x) <= SAME_GEO_POSITION_MM &&
    Math.abs(a.originWorld.y - b.originWorld.y) <= SAME_GEO_POSITION_MM &&
    Math.abs(a.rotationDeg - b.rotationDeg) <= SAME_GEO_ROTATION_DEG
  );
}

/** Running best/runner-up over the hypothesis stream. */
interface Leader {
  geo: GeoReference | null;
  inliers: number;
  secondBest: number;
  hypotheses: number;
}

/**
 * Fold one hypothesis into the leader board.
 *
 * A displaced champion becomes the runner-up only when it is a MATERIALLY different answer:
 * the same transform re-derived from another basis is corroboration, and counting it as a
 * rival would make the uniqueness gate reject precisely the matches that are best evidenced.
 */
function consider(leader: Leader, geo: GeoReference, inliers: number): void {
  leader.hypotheses++;
  if (inliers > leader.inliers) {
    if (leader.geo && !sameGeoReference(leader.geo, geo)) {
      leader.secondBest = Math.max(leader.secondBest, leader.inliers);
    }
    leader.geo = geo;
    leader.inliers = inliers;
    return;
  }
  if (leader.geo && !sameGeoReference(leader.geo, geo)) {
    leader.secondBest = Math.max(leader.secondBest, inliers);
  }
}

/** Score both endpoint orderings of one congruent segment pair. */
function considerBothOrders(
  leader: Leader,
  localA: Point2D,
  localB: Point2D,
  worldA: Point2D,
  worldB: Point2D,
  searchPoints: readonly Point2D[],
  index: WorldPointIndex,
): void {
  const forward = fromTwoPointPairs(localA, localB, worldA, worldB);
  consider(leader, forward, scoreGeoReference(searchPoints, index, forward).inliers);

  const reversed = fromTwoPointPairs(localB, localA, worldA, worldB);
  consider(leader, reversed, scoreGeoReference(searchPoints, index, reversed).inliers);
}

/** Enumerate every drawing segment congruent to each survey basis, scoring as we go. */
function enumerateHypotheses(
  worldTable: PairTable,
  localTable: PairTable,
  searchPoints: readonly Point2D[],
  index: WorldPointIndex,
  options: CongruentMatchOptions,
): Leader {
  const leader: Leader = { geo: null, inliers: 0, secondBest: 0, hypotheses: 0 };
  const bases = selectLongestBases(worldTable, options.maxBases ?? DEFAULT_MAX_BASES);
  // Both endpoints carry the point tolerance, so the segment band is twice it.
  const bandMm = options.toleranceMm * 2;

  for (const basis of bases) {
    const worldA = worldTable.points[basis.a]!;
    const worldB = worldTable.points[basis.b]!;
    forEachPairNear(localTable, basis.lengthMm, bandMm, (a, b) => {
      considerBothOrders(leader, localTable.points[a]!, localTable.points[b]!, worldA, worldB, searchPoints, index);
    });
  }

  return leader;
}

/**
 * Find the rigid reference that best explains `allPoints` as part of the indexed survey.
 *
 * `null` when nothing was hypothesised at all (either side too small, or no drawing segment
 * matched any survey segment's length). A returned match is NOT yet accepted — the caller
 * applies the acceptance gates; this function's job is to find the best explanation, not to
 * decide whether it is good enough.
 *
 * @param allPoints    every drawing candidate, LOCAL mm — the verification set
 * @param searchPoints the compact node sample, LOCAL mm — the enumeration + search set
 * @param worldBasisPoints survey points the BASES are drawn from, WORLD mm. May be a capped
 *        subset of what `index` holds: bases only need to exist, while scoring must see the
 *        whole survey, so the two deliberately need not be the same set.
 */
export function matchByCongruentPairs(
  allPoints: readonly Point2D[],
  searchPoints: readonly Point2D[],
  worldBasisPoints: readonly Point2D[],
  index: WorldPointIndex,
  options: CongruentMatchOptions,
): CongruentMatch | null {
  if (searchPoints.length < 2 || worldBasisPoints.length < 2) return null;

  const worldTable = buildPairTable(worldBasisPoints);
  const localTable = buildPairTable(searchPoints);
  const leader = enumerateHypotheses(worldTable, localTable, searchPoints, index, options);
  if (!leader.geo) return null;

  // The winner is re-measured against EVERYTHING, and the pairs it collects there are what
  // the refinement fits — so the final reference answers to the whole drawing, not to the
  // sample that happened to find it.
  const pairs: PointPair[] = [];
  scoreGeoReference(allPoints, index, leader.geo, (pair) => pairs.push(pair));

  const refined = solveRigid2D(pairs);
  const geo = refined ? refined.geo : leader.geo;

  return {
    geo,
    score: scoreGeoReference(allPoints, index, geo),
    secondBestInliers: leader.secondBest,
    // 1 = «no opinion» when the fit was not solvable; never a licence to scale anything.
    scaleEstimate: refined ? refined.scaleEstimate : 1,
    pairs,
    hypotheses: leader.hypotheses,
  };
}
