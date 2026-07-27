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
 * ## Cost (ADR-650 §M10e v24 — measured, not assumed)
 * The enumeration is cheap; SCORING its output was not. 2 456 hypotheses × 1 500 probes each
 * froze the tab for 6.7 s. Two changes, neither of which alters a single answer:
 *   1. the search asks the question from the SURVEY side against an index of the drawing
 *      (`countExplainedPoints`) — 93 probes instead of 1 500, because the one-to-one rule
 *      already capped the answer at 93;
 *   2. a candidate is abandoned the moment it provably cannot reach
 *      `leader / UNIQUENESS_FACTOR`, below which it can influence neither the winner nor the
 *      uniqueness gate. The literature's version of this (preemptive RANSAC, T_{d,d}) drops
 *      candidates on a SAMPLE and accepts losing the true one; ours drops them on a proof.
 *
 * Pure module — zero React/DOM/store deps, zero randomness, fully deterministic.
 *
 * @see ./geo-pair-table.ts — the invariant table and the basis selection
 * @see ./geo-point-index.ts — the verifier (and its one-to-one rule)
 * @see ./geo-similarity-solve.ts — the least-squares refinement
 */

import type { Point2D } from '../../rendering/types/Types';
import { fromTwoPointPairs, localToWorld, type GeoReference } from './geo-transform';
import {
  buildPointSetIndex, countExplainedPoints, scoreGeoReference,
  type GeoMatchScore, type PointSetIndex,
} from './geo-point-index';
import { UNIQUENESS_FACTOR } from './geo-match-gates';
import { solveRigid2D, type PointPair } from './geo-similarity-solve';
import {
  buildPairTable, forEachPairNear, selectLongestBases, toFlatCoords, type PairTable,
} from './geo-pair-table';

export interface CongruentMatchOptions {
  /** Point acceptance radius, canonical mm. The segment band is twice this — both ends err. */
  readonly toleranceMm: number;
  /** How many survey bases to enumerate. Default 12. */
  readonly maxBases?: number;
}

const DEFAULT_MAX_BASES = 12;

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

/**
 * `true` when two references put the drawing in the SAME PLACE — measured, not compared
 * parameter by parameter.
 *
 * Comparing `rotationDeg` against a fixed epsilon is scale-dependent and therefore wrong in
 * both directions: 0.01° is 17 mm of displacement 100 m from the origin but 17 µm at 100 mm.
 * What matters is where the drawing LANDS, so both references are applied — through the SSoT
 * projection — to the origin and to a far probe point, and the larger disagreement is
 * compared against the same tolerance the verifier uses to accept a point.
 *
 * This is what makes the uniqueness gate mean what it says. Real data is noisy, so the same
 * answer re-derived from a different basis differs by a few millimetres. Treating those as
 * rival answers would make the gate reject precisely the matches that several independent
 * bases agree on — the best-evidenced ones.
 */
function sameAnswer(a: GeoReference, b: GeoReference, probe: Point2D, toleranceMm: number): boolean {
  const originGap = Math.hypot(a.originWorld.x - b.originWorld.x, a.originWorld.y - b.originWorld.y);
  if (originGap > toleranceMm) return false;

  const pa = localToWorld(probe, a);
  const pb = localToWorld(probe, b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y) <= toleranceMm;
}

/**
 * The local point that best exposes a rotation difference — the one farthest from the local
 * origin, where a given angular error produces the largest displacement.
 */
function farthestFromOrigin(points: readonly Point2D[]): Point2D {
  let best = points[0] ?? { x: 0, y: 0 };
  let bestD2 = best.x * best.x + best.y * best.y;
  for (const p of points) {
    const d2 = p.x * p.x + p.y * p.y;
    if (d2 > bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  return best;
}

/** Running best/runner-up over the hypothesis stream. */
interface Leader {
  geo: GeoReference | null;
  inliers: number;
  secondBest: number;
  hypotheses: number;
  /** Probe + tolerance used by {@link sameAnswer} — fixed for the whole stream. */
  readonly probe: Point2D;
  readonly toleranceMm: number;
}

/**
 * The count below which a candidate can no longer influence ANY outcome, so scoring it to the
 * end is wasted work.
 *
 * Below `leader/UNIQUENESS_FACTOR` a candidate can neither win (that is strictly under the
 * leader, which only grows) nor trip the uniqueness gate (which asks precisely whether a rival
 * comes within that factor). Full argument — and why this is a proof rather than a heuristic —
 * on `countExplainedPoints`.
 */
function irrelevantBelow(leader: Leader): number {
  return leader.inliers / UNIQUENESS_FACTOR;
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
  const rival = leader.geo !== null && !sameAnswer(leader.geo, geo, leader.probe, leader.toleranceMm);

  if (inliers > leader.inliers) {
    if (rival) leader.secondBest = Math.max(leader.secondBest, leader.inliers);
    leader.geo = geo;
    leader.inliers = inliers;
    return;
  }
  if (rival) leader.secondBest = Math.max(leader.secondBest, inliers);
}

/** Score both endpoint orderings of one congruent segment pair. */
function considerBothOrders(
  leader: Leader,
  localA: Point2D,
  localB: Point2D,
  worldA: Point2D,
  worldB: Point2D,
  surveyPoints: readonly Point2D[],
  drawingIndex: PointSetIndex,
): void {
  const forward = fromTwoPointPairs(localA, localB, worldA, worldB);
  consider(leader, forward, countExplainedPoints(surveyPoints, drawingIndex, forward, irrelevantBelow(leader)));

  const reversed = fromTwoPointPairs(localB, localA, worldA, worldB);
  consider(leader, reversed, countExplainedPoints(surveyPoints, drawingIndex, reversed, irrelevantBelow(leader)));
}

/**
 * Enumerate every drawing segment congruent to each survey basis, scoring as we go.
 *
 * The drawing index is built ONCE here and probed by every hypothesis: the drawing does not
 * move between hypotheses — the survey does, in the drawing's frame. Indexing the moving side
 * instead would mean rebuilding the grid 2 456 times to ask the same question.
 */
function enumerateHypotheses(
  worldTable: PairTable,
  localCoords: Float64Array,
  searchPoints: readonly Point2D[],
  index: PointSetIndex,
  options: CongruentMatchOptions,
): Leader {
  const leader: Leader = {
    geo: null, inliers: 0, secondBest: 0, hypotheses: 0,
    probe: farthestFromOrigin(searchPoints), toleranceMm: options.toleranceMm,
  };
  const drawingIndex = buildPointSetIndex(searchPoints, options.toleranceMm);
  const surveyPoints = index.points;
  const bases = selectLongestBases(worldTable, options.maxBases ?? DEFAULT_MAX_BASES);
  // Both endpoints carry the point tolerance, so the segment band is twice it.
  const bandMm = options.toleranceMm * 2;

  for (const basis of bases) {
    const worldA = worldTable.points[basis.a]!;
    const worldB = worldTable.points[basis.b]!;
    forEachPairNear(localCoords, basis.lengthMm, bandMm, (a, b) => {
      considerBothOrders(leader, searchPoints[a]!, searchPoints[b]!, worldA, worldB, surveyPoints, drawingIndex);
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
  index: PointSetIndex,
  options: CongruentMatchOptions,
): CongruentMatch | null {
  if (searchPoints.length < 2 || worldBasisPoints.length < 2) return null;

  // The survey side is materialised because its pairs must be RANKED; the drawing side is
  // only ever streamed, so it never becomes 1.12 M rows in memory. See `geo-pair-table`.
  const worldTable = buildPairTable(worldBasisPoints);
  const localCoords = toFlatCoords(searchPoints);
  const leader = enumerateHypotheses(worldTable, localCoords, searchPoints, index, options);
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
