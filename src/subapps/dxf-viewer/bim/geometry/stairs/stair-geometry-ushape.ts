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
  Polyline3D,
  StairGeometry,
  StairParams,
  StairVariantUShape,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  point,
} from './stair-geometry-shared';
import {
  type FlightGeometry,
  assembleTwoFlightLanding,
  buildFlightFromEdge,
  buildRectilinearFlight,
  resolveSwitchbackBase,
} from './stair-geometry-generators';

export function computeUShape(
  params: Readonly<StairParams>,
  variant: StairVariantUShape,
): StairGeometry {
  assertUShapeCornerSupported(variant);
  const { basePoint, rise, tread, nosing, width } = params;
  const { u1, v1, n1, n2, landingDepth, turnSign } = resolveSwitchbackBase(params, variant);
  // Flight 2 is anti-parallel (180° switchback) — u2 = −u1 (vs l-shape's 90°).
  const u2: Vec2 = { x: -u1.x, y: -u1.y };
  const flight1 = buildRectilinearFlight(basePoint, u1, rise, tread, nosing, width, n1);
  const landing = buildUShapeLanding(basePoint, u1, v1, turnSign, rise, tread, width, landingDepth, n1);
  const flight2 = buildUShapeFlight2(
    basePoint, u1, v1, u2, turnSign, rise, tread, nosing, width, landingDepth, n1, n2,
  );
  const walkline = buildUShapeWalkline(basePoint, u1, v1, u2, turnSign, rise, tread, width, n1, n2);
  return assembleTwoFlightLanding(params, {
    flight1,
    flight2,
    walkline,
    landing,
    dirs: [u1, u2],
    split: [n1, n2],
  });
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

function buildUShapeLanding(
  basePoint: Readonly<Point3D>,
  u: Vec2,
  v: Vec2,
  turnSign: 1 | -1,
  rise: number,
  tread: number,
  width: number,
  landingDepth: number,
  n1: number,
): Polygon3D {
  const halfW = width * 0.5;
  const along0 = n1 * tread;
  const along1 = along0 + landingDepth;
  // Landing spans 2·width laterally: from flight 1's far edge (turnSign side =
  // landing-shared with flight 2) outward by `width`, plus flight 1's own
  // width band on the opposite side.
  const vNear = turnSign === -1 ? -(halfW + width) : -halfW;
  const vFar = turnSign === -1 ? halfW : halfW + width;
  const z = basePoint.z + rise * n1;
  return [
    point(basePoint.x + u.x * along0 + v.x * vNear, basePoint.y + u.y * along0 + v.y * vNear, z),
    point(basePoint.x + u.x * along1 + v.x * vNear, basePoint.y + u.y * along1 + v.y * vNear, z),
    point(basePoint.x + u.x * along1 + v.x * vFar, basePoint.y + u.y * along1 + v.y * vFar, z),
    point(basePoint.x + u.x * along0 + v.x * vFar, basePoint.y + u.y * along0 + v.y * vFar, z),
  ];
}

/**
 * Flight 2 inner edge (shared with the landing, closest to flight 1) at
 * `v1·(turnSign·halfW)`; outer direction `vOut = turnSign·v1`. ADR-611 —
 * treads/risers via the shared `buildFlightFromEdge`.
 */
function buildUShapeFlight2(
  basePoint: Readonly<Point3D>,
  u1: Vec2,
  v1: Vec2,
  u2: Vec2,
  turnSign: 1 | -1,
  rise: number,
  tread: number,
  nosing: number,
  width: number,
  landingDepth: number,
  n1: number,
  n2: number,
): FlightGeometry {
  const halfW = width * 0.5;
  const innerEdge: Vec2 = {
    x: basePoint.x + u1.x * (n1 * tread + landingDepth) + v1.x * (turnSign * halfW),
    y: basePoint.y + u1.y * (n1 * tread + landingDepth) + v1.y * (turnSign * halfW),
  };
  const vOut: Vec2 = { x: turnSign * v1.x, y: turnSign * v1.y };
  return buildFlightFromEdge(
    innerEdge, u2, vOut, rise, tread, nosing, width, n2, basePoint.z + rise * (n1 + 1),
  );
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
): Polyline3D {
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
