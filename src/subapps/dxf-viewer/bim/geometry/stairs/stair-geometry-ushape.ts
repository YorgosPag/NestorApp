/**
 * U-shape stair geometry (ADR-358 §5.1 Phase 3b).
 *
 * Two parallel flights joined by a 180° mid-landing. Industry-standard
 * footprint (Revit / ArchiCAD / Vectorworks):
 *   - Flight 1 occupies the v1·[−halfW, +halfW] band, ascending along +u1.
 *   - Flight 2 occupies an adjacent band offset by `turnSign·width` along v1,
 *     descending back along −u1 (anti-parallel).
 *   - Landing footprint = `(2·width) × landingDepth` — spans both flights
 *     laterally, sits at the top end of flight 1 in u1 direction.
 *
 * `landingDepth: 'auto'` resolves to `width` (Q24 — NOK-compliant by
 * construction, mirrors l-shape Phase 3a convention; the prompt's industry
 * note about `max(width, tread)` collapses to `width` for any geometry where
 * `tread ≤ width`, which is the canonical case).
 *
 * z model: flight 1 treads at z ∈ [0, (n1−1)·rise]; landing at z = n1·rise;
 * flight 2 treads at z ∈ [(n1+1)·rise, stepCount·rise]. Last tread reaches the
 * top floor at stepCount·rise — same convention as l-shape Phase 3a.
 *
 * `landingCornerStyle: 'chamfer' | 'fillet'` throws with a `/Phase 3c/`
 * sentinel — square corners only in Phase 3b.
 *
 * ADR-611 — flight 1 (rectilinear) and flight 2 (edge-origin) delegate to the
 * shared generators; the `StairGeometry` assembly tail (incl. the cut-plane
 * split that was a local duplicate here) comes from `stair-geometry-generators.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  StairGeometry,
  StairParams,
  StairVariantUShape,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  offsetAlong,
  point,
} from './stair-geometry-shared';
import { resolveSwitchbackBase } from './stair-geometry-generators';
import {
  type StairRunResult,
  assembleTurnRunStair,
  beginTurnRun,
  edgeRun,
} from './stair-flight-run-builder';

/**
 * U-shape — two anti-parallel flights joined by one 180° switchback landing
 * spanning 2·width laterally. ONE path for both the bare stair and rest-landing
 * (πλατύσκαλα) stairs (ADR-637 Phase 2b): flight 1 is a centreline run, flight 2
 * an anti-parallel edge-origin run (`u2 = −u1`), so an empty schedule yields runs
 * byte-identical to the old bare flights. The switchback landing is anchored at
 * flight 1's real plan end → a rest landing inside flight 1 slides the landing +
 * flight 2 with no bespoke offset math; the z-model stays invariant (flight 2 from
 * level n1+1), only the footprint grows. Walkline is the bespoke
 * `buildUShapeWalkline` with no rest landings (byte-identical) and the run-stitched
 * centreline otherwise.
 */
export function computeUShape(
  params: Readonly<StairParams>,
  variant: StairVariantUShape,
): StairGeometry {
  assertUShapeCornerSupported(variant);
  const { basePoint, rise, tread, width } = params;
  const { u1, v1, n1, n2, landingDepth, turnSign } = resolveSwitchbackBase(params, variant);
  const u2: Vec2 = { x: -u1.x, y: -u1.y }; // 180° switchback (vs l-shape's 90°)
  const vOut: Vec2 = { x: turnSign * v1.x, y: turnSign * v1.y };
  const halfW = width * 0.5;
  const { common, per, run1 } = beginTurnRun(params, u1, [n1, n2]);
  const turnLanding = buildUShapeLandingAt(
    run1.endXY, u1, v1, turnSign, width, landingDepth, basePoint.z + rise * n1,
  );
  // Flight 2 origin = NEAR u1 edge of the landing (flight-1 plan end, u1 = n1·tread),
  // on the shared side (v1·turnSign·halfW). Flight 2 runs anti-parallel (−u1) back
  // ALONGSIDE flight 1, so it must start at the landing's near edge — starting at the
  // FAR edge (+landingDepth) would run the treads back OVER the landing footprint
  // (the treads/walkline mismatch that made flight 2 sit on top of the πλατύσκαλο).
  // Mirrors l-shape flight 2 (lateral-only offset off run1.endXY).
  const flight2Origin = offsetAlong(run1.endXY, v1, turnSign * halfW);
  const run2 = edgeRun(common, flight2Origin, u2, vOut, n1 + 1, n2, per[1]);

  let walkline: Point3D[];
  if (!params.restLandings || params.restLandings.length === 0) {
    walkline = buildUShapeWalkline(basePoint, u1, v1, u2, turnSign, rise, tread, width, n1, n2);
  } else {
    walkline = stitchUShapeWalkline(run1, run2, v1, turnSign, width);
  }
  return assembleTurnRunStair(params, [run1, run2], [turnLanding], walkline);
}

// ─── helpers ────────────────────────────────────────────────────────────────

function assertUShapeCornerSupported(variant: StairVariantUShape): void {
  const style = variant.landingCornerStyle ?? 'square';
  if (style !== 'square') {
    throw new Error(
      `StairGeometryService: landingCornerStyle '${style}' requires Phase 3c (chamfer/fillet not implemented)`,
    );
  }
}

/**
 * ADR-637 Phase 2b — the 2·width switchback landing anchored at flight 1's ACTUAL
 * plan end (`flightEnd = basePoint + u·(n1·tread)` with no rest landings, or
 * `run1.endXY` when flight 1 carries πλατύσκαλα), so a rest landing inside flight
 * 1 slides the landing + flight 2 without bespoke offset math.
 */
function buildUShapeLandingAt(
  flightEnd: Vec2,
  u: Vec2,
  v: Vec2,
  turnSign: 1 | -1,
  width: number,
  landingDepth: number,
  z: number,
): Polygon3D {
  const halfW = width * 0.5;
  // Landing spans 2·width laterally: from flight 1's far edge (turnSign side =
  // landing-shared with flight 2) outward by `width`, plus flight 1's own
  // width band on the opposite side.
  const vNear = turnSign === -1 ? -(halfW + width) : -halfW;
  const vFar = turnSign === -1 ? halfW : halfW + width;
  return [
    point(flightEnd.x + v.x * vNear, flightEnd.y + v.y * vNear, z),
    point(flightEnd.x + u.x * landingDepth + v.x * vNear, flightEnd.y + u.y * landingDepth + v.y * vNear, z),
    point(flightEnd.x + u.x * landingDepth + v.x * vFar, flightEnd.y + u.y * landingDepth + v.y * vFar, z),
    point(flightEnd.x + v.x * vFar, flightEnd.y + v.y * vFar, z),
  ];
}

/**
 * U-shape centreline stitch (rest-landing path): flight 1 (along u1) → lateral
 * 180° shift across the landing (v1·turnSign·width) → flight 2 (along −u1). The
 * lateral cross sits at the landing elevation; flight 2's own run walkline (with
 * any rest-landing stretches) follows from its centreline origin.
 */
function stitchUShapeWalkline(
  run1: StairRunResult,
  run2: StairRunResult,
  v1: Vec2,
  turnSign: 1 | -1,
  width: number,
): Point3D[] {
  const p2 = run1.walklinePts[run1.walklinePts.length - 1]; // flight-1 top centreline @ z(n1)
  const landingCross = point(
    p2.x + v1.x * (turnSign * width),
    p2.y + v1.y * (turnSign * width),
    p2.z,
  );
  return [...run1.walklinePts, landingCross, ...run2.walklinePts];
}

function buildUShapeWalkline(
  basePoint: Readonly<Point3D>,
  u1: Vec2,
  v1: Vec2,
  u2: Vec2,
  turnSign: 1 | -1,
  rise: number,
  tread: number,
  width: number,
  n1: number,
  n2: number,
): Point3D[] {
  // 4-vertex pattern with TWO sharp 90° turns at the landing entry/exit.
  // p1: basePoint.
  // p2: u1 · (n1·tread + halfW), v1·0  — landing-entry L corner (90° turn into v1·turnSign).
  // p3: u1 · (n1·tread + halfW), v1·(turnSign·width)  — landing-exit L corner (90° turn into u2).
  // p4: p3 + u2 · (halfW + (n2−1)·tread)  — flight 2 walkline end.
  const halfW = width * 0.5;
  const aTurn = n1 * tread + halfW;
  const lateral = turnSign * width;
  const flight2Run = halfW + (n2 - 1) * tread;
  return [
    point(basePoint.x, basePoint.y, basePoint.z),
    point(basePoint.x + u1.x * aTurn, basePoint.y + u1.y * aTurn, basePoint.z + rise * n1),
    point(
      basePoint.x + u1.x * aTurn + v1.x * lateral,
      basePoint.y + u1.y * aTurn + v1.y * lateral,
      basePoint.z + rise * n1,
    ),
    point(
      basePoint.x + u1.x * aTurn + v1.x * lateral + u2.x * flight2Run,
      basePoint.y + u1.y * aTurn + v1.y * lateral + u2.y * flight2Run,
      basePoint.z + rise * (n1 + n2),
    ),
  ];
}
