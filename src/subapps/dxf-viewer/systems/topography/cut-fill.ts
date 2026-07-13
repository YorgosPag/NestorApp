/**
 * ADR-650 M6 — «πόσα κυβικά σκάβω, πόσα ρίχνω;». The volume engine. Pure: no store, no React,
 * no scene — it takes a TIN, a reference and an optional boundary, and returns numbers.
 *
 * ── Method: triangular PRISMS (Civil 3D «Volumes Dashboard», TIN-to-TIN composite) ───────
 * For every triangle of the ground, the earth between it and the reference is a prism whose
 * volume is `Area × mean Δz`. Summed over the TIN this is O(n) and EXACT for piecewise-linear
 * surfaces — no grid, no sampling error, no cell-size knob to get wrong.
 *
 * ── The reference is an INTERFACE, deliberately ──────────────────────────────────────────
 * The engine never learns whether the target ground is a flat datum («σκάψε μέχρι το +12.50»)
 * or a whole designed surface. It only ever asks one question — «what elevation do you want at
 * this point?» — so datum-mode and surface-mode are two answers to it, not two engines. Adding
 * a third reference later (a sloped plane, a road corridor) needs zero changes here.
 *
 * ── Surface-vs-surface is a LINEARISATION, and it says so ────────────────────────────────
 * When the reference is a second TIN, Δz is sampled at the ground's vertices and treated as
 * linear across each triangle. Where the two triangulations cross, that is an approximation
 * (Civil 3D's own answer is to build a composite surface). It is the standard, documented
 * trade-off — and `cut-fill-crosscheck.ts` exists precisely to catch when it drifts.
 *
 * The `null` answers matter: a reference that has no ground at a vertex (outside the proposed
 * surface) makes that triangle UNCOUNTABLE, not zero. It is skipped and reported in
 * `skippedTriangles`, never silently valued at 0 — that would invent excavation out of nothing.
 */

import type { Point2D } from '../../rendering/types/Types';
import { clipPolygonBySH, shoelaceArea } from '../../bim/geometry/shared/polygon-utils';
import type { TinSurface, TopoBoundary, CutFillResult } from './topo-types';
import { createTinSampler } from './tin-sampler';
import {
  attachDz,
  fitDzPlane,
  pieceVolumeMm3,
  splitByZeroDz,
  type DzVertex,
} from './cut-fill-geometry';

/** «What elevation should the ground have at this point?» — WORLD mm, `null` = no answer. */
export interface ElevationReference {
  readonly zAtMm: (worldXMm: number, worldYMm: number) => number | null;
}

/** (Α) A flat design level — «ίσιωσέ το στα +12.50». Answers everywhere. */
export function datumReference(datumZMm: number): ElevationReference {
  const finite = Number.isFinite(datumZMm) ? datumZMm : 0;
  return { zAtMm: () => finite };
}

/** (Β) A designed ground — the proposed TIN. Answers `null` outside its own extent. */
export function surfaceReference(proposed: TinSurface): ElevationReference {
  return createTinSampler(proposed);
}

const EMPTY_RESULT: CutFillResult = {
  cutVolumeMm3: 0,
  fillVolumeMm3: 0,
  netVolumeMm3: 0,
  cutAreaMm2: 0,
  fillAreaMm2: 0,
  evaluatedTriangles: 0,
  skippedTriangles: 0,
};

/**
 * Cut and fill of `ground` against `reference`, counted only inside `boundary` when given.
 * Returns zeros (never NaN) for an empty surface — «no survey» is an empty answer, not an error.
 */
export function computeCutFill(
  ground: TinSurface,
  reference: ElevationReference,
  boundary?: TopoBoundary | null,
): CutFillResult {
  if (ground.triangles.length === 0) return EMPTY_RESULT;

  const clip = boundaryVertices(boundary);
  const totals: Totals = { cut: 0, fill: 0, cutArea: 0, fillArea: 0, evaluated: 0, skipped: 0 };

  for (const [i, j, k] of ground.triangles) {
    accumulateTriangle(ground, [i, j, k], reference, clip, totals);
  }

  return {
    cutVolumeMm3: totals.cut,
    fillVolumeMm3: totals.fill,
    netVolumeMm3: totals.cut - totals.fill,
    cutAreaMm2: totals.cutArea,
    fillAreaMm2: totals.fillArea,
    evaluatedTriangles: totals.evaluated,
    skippedTriangles: totals.skipped,
  };
}

// ─── internals ─────────────────────────────────────────────────────────────────

/** Running sums — one triangle at a time, so the engine stays O(n) with no intermediate arrays. */
interface Totals {
  cut: number;
  fill: number;
  cutArea: number;
  fillArea: number;
  evaluated: number;
  skipped: number;
}

/** The whole method, for ONE triangle: sample → clip to boundary → daylight-split → two prisms. */
function accumulateTriangle(
  ground: TinSurface,
  [i, j, k]: readonly [number, number, number],
  reference: ElevationReference,
  clip: readonly Point2D[] | null,
  totals: Totals,
): void {
  const triangle = triangleDz(ground, i, j, k, reference);
  const plane = triangle ? fitDzPlane(triangle[0], triangle[1], triangle[2]) : null;
  if (!triangle || !plane) {
    totals.skipped++;
    return;
  }

  // (Γ) Clip to the site boundary. The TRIANGLE is the convex clipper, so a concave οικόπεδο is
  // handled correctly — the same S-H contract `polygonIntersectionAreaMm2` relies on. Δz is then
  // re-attached from the plane, exactly like the uncut corners.
  const piece: readonly DzVertex[] = clip
    ? attachDz(clipToBoundary(triangle, clip), plane)
    : triangle;
  if (piece.length < 3) return; // entirely outside the boundary — evaluated, contributes nothing

  // The daylight split. Without it a triangle straddling the reference cancels itself out.
  const { cut, fill } = splitByZeroDz(piece);
  const cutPiece = pieceVolumeMm3(cut, plane);
  const fillPiece = pieceVolumeMm3(fill, plane);

  totals.cut += cutPiece.volumeMm3;
  totals.cutArea += cutPiece.areaMm2;
  totals.fill += fillPiece.volumeMm3;
  totals.fillArea += fillPiece.areaMm2;
  totals.evaluated++;
}

/** The three WORLD-frame vertices with their Δz, or `null` when the reference cannot answer. */
function triangleDz(
  ground: TinSurface,
  i: number,
  j: number,
  k: number,
  reference: ElevationReference,
): readonly [DzVertex, DzVertex, DzVertex] | null {
  const a = vertexDz(ground, i, reference);
  const b = vertexDz(ground, j, reference);
  const c = vertexDz(ground, k, reference);
  return a && b && c ? [a, b, c] : null;
}

/** One vertex: LOCAL → WORLD planimetric (elevations are already world Z), then Δz. */
function vertexDz(ground: TinSurface, index: number, reference: ElevationReference): DzVertex | null {
  const local = ground.positions[index]!;
  const x = local[0] + ground.origin.x;
  const y = local[1] + ground.origin.y;
  const groundZ = ground.elevations[index]!;
  const targetZ = reference.zAtMm(x, y);
  if (targetZ === null || !Number.isFinite(groundZ) || !Number.isFinite(targetZ)) return null;
  return { x, y, dz: groundZ - targetZ };
}

/** The boundary ring, or `null` when volumes cover the whole survey. */
function boundaryVertices(boundary: TopoBoundary | null | undefined): readonly Point2D[] | null {
  if (!boundary || boundary.vertices.length < 3) return null;
  return boundary.vertices;
}

/**
 * Triangle ∩ boundary, planimetric. The TRIANGLE is the clipper because S-H requires a CONVEX
 * clip — that way the οικόπεδο may be as concave as it likes (Γ-shaped plots are the norm).
 *
 * The CCW re-winding is not defensive noise: S-H reads «inside = left of the directed edge», so
 * a clockwise clip triangle rejects EVERY point and the triangle's earth vanishes from the
 * report without a word. cdt2d hands us CCW triangles today; this makes the contract explicit
 * rather than load-bearing-by-luck.
 */
function clipToBoundary(
  triangle: readonly [DzVertex, DzVertex, DzVertex],
  boundary: readonly Point2D[],
): Point2D[] {
  const subject = boundary.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  const clip = triangle.map((v) => ({ x: v.x, y: v.y, z: 0 }));
  const ccwClip = shoelaceArea(clip) >= 0 ? clip : [...clip].reverse();
  return clipPolygonBySH(subject, ccwClip).map((p) => ({ x: p.x, y: p.y }));
}
