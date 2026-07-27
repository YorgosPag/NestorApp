/**
 * ADR-650 §M10e — least-squares 2D alignment from KNOWN correspondences (Umeyama / Kabsch).
 *
 * Given N matched pairs `(local_i, world_i)` this returns the RIGID transform (rotation +
 * translation) that minimises Σ‖world_i − (R·local_i + t)‖² — in closed form, no iteration,
 * no initial guess, no convergence to babysit. It is the refinement stage: the matcher
 * proposes a correspondence set, this turns it into the single best transform for that set.
 *
 * ## Rigid, never scaled — deliberately
 * The classical Umeyama estimator also solves for a scale `s`. We compute it and REFUSE TO
 * APPLY IT ({@link SimilaritySolution.scaleEstimate} is diagnostic only). A geo-reference
 * that scales would silently resize the building: a 3.00 m room becomes 3.05 m and every
 * downstream quantity — areas, volumes, the BOQ — is wrong by that factor, invisibly. Revit
 * shared coordinates and Civil 3D real-world coordinates are rigid for exactly this reason.
 * A scale far from 1 is not a transform to apply, it is a UNIT MISMATCH to report.
 *
 * ## Relationship to `fromTwoPointPairs`
 * `geo-transform.fromTwoPointPairs` is the EXACT two-correspondence case and stays the SSoT
 * for it (the matcher calls it to hypothesise). This module is the N-correspondence
 * least-squares generalisation used to refine a hypothesis over its inliers. Different
 * mathematics (accumulated cross/dot products vs. a single segment angle), different job —
 * they are not two spellings of one thing.
 *
 * Pure module — zero React/DOM/store deps, fully deterministic.
 *
 * @see ./geo-transform.ts — GeoReference, localToWorld, fromTwoPointPairs
 */

import type { Point2D } from '../../rendering/types/Types';
import { localToWorld, type GeoReference } from './geo-transform';

/** One known correspondence: a point in the drawing's local frame and its world (ΕΓΣΑ) twin. */
export interface PointPair {
  readonly local: Point2D;
  readonly world: Point2D;
}

/** The fitted alignment plus the numbers the acceptance gates and the UI need. */
export interface SimilaritySolution {
  /** The RIGID reference (rotation + translation). Scale is never baked in. */
  readonly geo: GeoReference;
  /**
   * DIAGNOSTIC ONLY — the scale the pairs would have wanted. ~1 for a correct pair of
   * drawings. Far from 1 ⇒ the two files are in different units; the caller reports a
   * unit mismatch and produces NO geo-reference. Never multiply anything by this.
   */
  readonly scaleEstimate: number;
  /** RMS residual of the RIGID fit, in the input units (canonical mm). */
  readonly rmsMm: number;
  /** Worst single residual (mm) — an RMS can hide one bad correspondence. */
  readonly maxResidualMm: number;
  readonly pairCount: number;
}

/** Arithmetic mean position of a pair set on one side. */
function centroid(pairs: readonly PointPair[], side: 'local' | 'world'): Point2D {
  let sx = 0;
  let sy = 0;
  for (const pair of pairs) {
    sx += pair[side].x;
    sy += pair[side].y;
  }
  return { x: sx / pairs.length, y: sy / pairs.length };
}

/** Cross/dot accumulations of the mean-centred pairs — the whole of the closed-form solution. */
interface CentredMoments {
  /** Σ(a·b) — the "how aligned" term. */
  readonly dot: number;
  /** Σ(a×b) — the "how rotated" term. */
  readonly cross: number;
  /** Σ‖a‖² of the local side; 0 ⇒ every local point is the same point (unsolvable). */
  readonly localEnergy: number;
  /** Σ‖b‖² of the world side — only needed for the scale diagnostic. */
  readonly worldEnergy: number;
}

function centredMoments(pairs: readonly PointPair[], localC: Point2D, worldC: Point2D): CentredMoments {
  let dot = 0;
  let cross = 0;
  let localEnergy = 0;
  let worldEnergy = 0;

  for (const { local, world } of pairs) {
    // Centre FIRST: raw ΕΓΣΑ'87 values are ~4.5e9 mm, and accumulating their products
    // directly would burn most of a float64's 15-16 significant digits before the fit
    // even starts. Centred, the magnitudes are drawing-sized and the solution is exact.
    const ax = local.x - localC.x;
    const ay = local.y - localC.y;
    const bx = world.x - worldC.x;
    const by = world.y - worldC.y;

    dot += ax * bx + ay * by;
    cross += ax * by - ay * bx;
    localEnergy += ax * ax + ay * ay;
    worldEnergy += bx * bx + by * by;
  }

  return { dot, cross, localEnergy, worldEnergy };
}

/** RMS + worst residual of `geo` over `pairs`, measured through the SSoT projection. */
function residuals(pairs: readonly PointPair[], geo: GeoReference): { rmsMm: number; maxResidualMm: number } {
  let sumSq = 0;
  let worst = 0;

  for (const { local, world } of pairs) {
    // localToWorld is the ONLY projection in the system — measuring with a re-derived
    // formula would let the scorer and the renderer disagree about what "aligned" means.
    const projected = localToWorld(local, geo);
    const d2 = (projected.x - world.x) ** 2 + (projected.y - world.y) ** 2;
    sumSq += d2;
    if (d2 > worst) worst = d2;
  }

  return { rmsMm: Math.sqrt(sumSq / pairs.length), maxResidualMm: Math.sqrt(worst) };
}

/**
 * Closed-form least-squares RIGID fit over `pairs`.
 *
 * `null` when the problem is not posed: fewer than two correspondences, or a local set with
 * no spread (every point coincident — infinitely many rotations fit equally well, so any
 * answer would be an arbitrary one dressed up as a measurement).
 */
export function solveRigid2D(pairs: readonly PointPair[]): SimilaritySolution | null {
  if (pairs.length < 2) return null;

  const localC = centroid(pairs, 'local');
  const worldC = centroid(pairs, 'world');
  const { dot, cross, localEnergy, worldEnergy } = centredMoments(pairs, localC, worldC);

  if (localEnergy <= 0) return null;

  // θ = atan2(Σ cross, Σ dot) — the exact minimiser of the squared residual over rotations.
  const rotationDeg = Math.atan2(cross, dot) * (180 / Math.PI);

  // Rotate the local centroid, then translate so the centroids coincide: the rigid optimum
  // always maps centroid onto centroid. Expressed as originWorld to match GeoReference,
  // whose contract is `world = R·local + originWorld`.
  const rad = Math.atan2(cross, dot);
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const geo: GeoReference = {
    originWorld: {
      x: worldC.x - (localC.x * c - localC.y * s),
      y: worldC.y - (localC.x * s + localC.y * c),
    },
    rotationDeg,
  };

  return {
    geo,
    scaleEstimate: scaleFrom(dot, cross, localEnergy, worldEnergy),
    ...residuals(pairs, geo),
    pairCount: pairs.length,
  };
}

/**
 * The Umeyama scale the data would have wanted, `hypot(Σdot, Σcross) / Σ‖a‖²` — reported,
 * never applied. Falls back to 1 (a neutral "no opinion") when the world side is degenerate,
 * so a caller comparing against 1 cannot be tricked into declaring a unit mismatch by a
 * pathological input.
 */
function scaleFrom(dot: number, cross: number, localEnergy: number, worldEnergy: number): number {
  if (localEnergy <= 0 || worldEnergy <= 0) return 1;
  return Math.hypot(dot, cross) / localEnergy;
}
