/**
 * ADR-650 §M10e — COORDINATE-FRAME SPLIT: one drawing, several unrelated coordinate systems.
 *
 * A survey DXF routinely mixes frames. The reference file has 560 points in ΕΓΣΑ'87 and two
 * in a local frame at X ≈ −13 m — an inset, a detail, a legend, a title block, or geometry
 * someone pasted from another drawing. Handing all of them to the matcher as one cloud is
 * wrong twice over: the outliers drag any centroid-based estimate, and a frame that IS the
 * survey gets its inlier RATIO diluted by points that could never match anything.
 *
 * So the drawing is cut into frames FIRST, each frame is matched independently, and the best
 * one wins on its own merits. That is also what makes the answer explainable: the proof card
 * can say which part of the drawing matched, not just that something did.
 *
 * ## The cut
 * Frames are separated by EMPTY SPACE — kilometres of it — while the points inside one frame
 * are continuous at survey scale. So: sort along an axis, and cut wherever the gap between
 * two consecutive points is implausibly large. Single-linkage, one dimension at a time (X,
 * then Y within each X-group), which is enough for translated frames and cannot merge two
 * genuinely distant groups.
 *
 * The threshold is `max(absoluteFloorMm, madFactor × MAD(gaps))`:
 *   - the MAD term ADAPTS — a dense 50 m plot and a sparse 5 km road corridor have different
 *     ideas of «a big gap», and a fixed number would shred one or merge the other;
 *   - the absolute floor stops a pathologically regular grid (MAD ≈ 0) from being cut into
 *     dust, which is the failure mode a purely relative threshold always has.
 *
 * ## Why `clusterElevations` (bim/structural/analytical) is NOT reused — measured decision
 * It is also a sorted greedy 1-D clustering, so the SSoT audit flagged it. It is a DIFFERENT
 * rule: it bounds each cluster's DIAMETER (`z − cluster[0] ≤ tol`) against a FIXED structural
 * tolerance, because a storey must not drift. This one is single-linkage against an ADAPTIVE
 * threshold, because a survey frame is arbitrarily wide and must not be cut. Rewriting either
 * in terms of the other would move structural storeys to serve a topography feature. Two
 * rules, two homes, verified non-cloning by jscpd.
 *
 * Pure module — zero React/DOM/store deps, fully deterministic.
 *
 * @see ./geo-ref-candidate-points.ts — produces the input
 * @see ../../utils/statistics.ts — median / mad (the ONLY home for both)
 */

import { mad } from '../../utils/statistics';
import type { LocalCandidatePoint } from './geo-ref-candidate-points';

export interface CoordinateFrameOptions {
  /**
   * Never cut on a gap smaller than this, however tight the data. Default 1 000 000 mm
   * (1 km): survey frames are separated by kilometres, plot detail never is.
   */
  readonly absoluteFloorMm?: number;
  /** Multiplier on the MAD of consecutive gaps. Default 50 — far outside ordinary spacing jitter. */
  readonly madFactor?: number;
  /**
   * Frames smaller than this are dropped. Default 3: two points cannot evidence a rotation,
   * so a 2-point frame can only ever produce an unverifiable answer.
   */
  readonly minClusterSize?: number;
}

const DEFAULT_ABSOLUTE_FLOOR_MM = 1_000_000;
const DEFAULT_MAD_FACTOR = 50;
const DEFAULT_MIN_CLUSTER_SIZE = 3;

/** One coordinate frame — a set of points that are mutually reachable at survey scale. */
export interface PointCluster {
  readonly points: readonly LocalCandidatePoint[];
}

/** The gap above which two consecutive sorted values belong to different frames. */
function gapThreshold(sorted: readonly number[], floorMm: number, madFactor: number): number {
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i]! - sorted[i - 1]!);
  // MAD 0 (perfectly regular spacing, or fewer than two gaps) means «no usable spread» —
  // the floor then carries the decision alone, which is exactly what it is for.
  return Math.max(floorMm, madFactor * mad(gaps));
}

/** Split one already-sorted-by-`coord` group wherever the consecutive gap exceeds the threshold. */
function splitAlongAxis(
  group: readonly LocalCandidatePoint[],
  coord: (p: LocalCandidatePoint) => number,
  floorMm: number,
  madFactor: number,
): LocalCandidatePoint[][] {
  if (group.length < 2) return [[...group]];

  const sorted = [...group].sort((a, b) => coord(a) - coord(b));
  const threshold = gapThreshold(sorted.map(coord), floorMm, madFactor);

  const out: LocalCandidatePoint[][] = [[sorted[0]!]];
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (coord(current) - coord(previous) > threshold) out.push([current]);
    else out[out.length - 1]!.push(current);
  }
  return out;
}

/**
 * Cut `points` into coordinate frames, largest first.
 *
 * Largest-first is not cosmetic: the orchestrator tries frames in order and the biggest one
 * is both the most likely survey and the one whose acceptance gate is hardest to pass by
 * accident, so a false positive from a tiny frame can never pre-empt a real match.
 *
 * Ties in size keep their relative order (`Array.prototype.sort` is stable), so identical
 * input always yields identical output — including which of two equal frames is tried first.
 */
export function splitByCoordinateFrame(
  points: readonly LocalCandidatePoint[],
  options: CoordinateFrameOptions = {},
): readonly PointCluster[] {
  const floorMm = options.absoluteFloorMm ?? DEFAULT_ABSOLUTE_FLOOR_MM;
  const madFactor = options.madFactor ?? DEFAULT_MAD_FACTOR;
  const minSize = options.minClusterSize ?? DEFAULT_MIN_CLUSTER_SIZE;
  if (points.length === 0) return [];

  const byX = splitAlongAxis(points, (p) => p.x, floorMm, madFactor);
  const frames: LocalCandidatePoint[][] = [];
  for (const column of byX) {
    frames.push(...splitAlongAxis(column, (p) => p.y, floorMm, madFactor));
  }

  return frames
    .filter((f) => f.length >= minSize)
    .sort((a, b) => b.length - a.length)
    .map((f) => ({ points: f }));
}
