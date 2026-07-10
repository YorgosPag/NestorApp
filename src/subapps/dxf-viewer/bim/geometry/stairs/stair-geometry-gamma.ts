/**
 * Gamma (Γ) stair geometry (ADR-358 §5.1 Phase 3b).
 *
 * Three flights joined by two intermediate landings — `turnSequence` controls
 * the rotation at each landing (`left` = +90°, `right` = −90°). When both
 * turns are `'right'` the third flight ends up anti-parallel to flight 1; a
 * `'right','left'` (or `'left','right'`) sequence re-aligns it parallel.
 *
 * z model (matches the prompt §1.2):
 *   - Flight 1 treads: z ∈ [0, (n1−1)·rise]
 *   - Landing 1: z = n1·rise
 *   - Flight 2 treads: z ∈ [(n1+1)·rise, (n1+n2)·rise]
 *   - Landing 2: z = (n1+n2+1)·rise
 *   - Flight 3 treads: z ∈ [(n1+n2+2)·rise, (stepCount+1)·rise]
 *
 * Gamma's top tread therefore reaches (stepCount+1)·rise — one rise higher
 * than l-shape because every additional landing inserts a +1 rise step into
 * the z accumulator. This is the convention required by Phase 3b prompt.
 *
 * `landingCornerStyle: 'chamfer' | 'fillet'` throws with a `/Phase 3c/`
 * sentinel — square corners only in Phase 3b.
 *
 * ADR-611 — flight 1 (rectilinear) and the two intermediate flights
 * (edge-origin) delegate to the shared generators; the `StairGeometry`
 * assembly tail (incl. the cut-plane split that was a local duplicate here)
 * comes from `stair-geometry-generators.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairTurnDirectionLR,
  StairVariantGamma,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  perp,
  directionToUnitVector,
  point,
  arrowSymbol,
} from './stair-geometry-shared';
import {
  assembleMultiFlight,
  buildCornerLanding,
  buildFlightFromEdge,
  buildRectilinearFlight,
} from './stair-geometry-generators';

export function computeGamma(
  params: Readonly<StairParams>,
  variant: StairVariantGamma,
): StairGeometry {
  assertGammaCornerSupported(variant);
  const { basePoint, direction, rise, tread, nosing, width, upDirection } = params;
  const u1 = directionToUnitVector(direction);
  const v1 = perp(u1);
  const [n1, n2, n3] = variant.flightSplit;
  const turnSign1 = turnSign(variant.turnSequence[0]);
  const turnSign2 = turnSign(variant.turnSequence[1]);
  const landing1Depth = resolveDepth(variant.landings[0], width);
  const landing2Depth = resolveDepth(variant.landings[1], width);

  const u2: Vec2 = { x: turnSign1 * v1.x, y: turnSign1 * v1.y };
  const v2 = perp(u2);
  const u3: Vec2 = { x: turnSign2 * v2.x, y: turnSign2 * v2.y };

  const flight1 = buildRectilinearFlight(basePoint, u1, rise, tread, nosing, width, n1);
  const landing1 = buildCornerLanding(
    { x: basePoint.x + u1.x * (n1 * tread), y: basePoint.y + u1.y * (n1 * tread) },
    u1, perp(u1), width, landing1Depth, basePoint.z + rise * n1, /* centered = */ true,
  );
  const flight2Origin: Vec2 = {
    x: basePoint.x + u1.x * (n1 * tread) + v1.x * (turnSign1 * width * 0.5),
    y: basePoint.y + u1.y * (n1 * tread) + v1.y * (turnSign1 * width * 0.5),
  };
  const flight2 = buildFlightFromEdge(
    flight2Origin, u2, u1, rise, tread, nosing, width, n2, basePoint.z + rise * (n1 + 1),
  );
  const landing2Origin: Vec2 = {
    x: flight2Origin.x + u2.x * (n2 * tread),
    y: flight2Origin.y + u2.y * (n2 * tread),
  };
  const landing2 = buildCornerLanding(
    landing2Origin, u2, u1, width, landing2Depth,
    basePoint.z + rise * (n1 + n2 + 1), /* centered = */ false,
  );
  const flight3Origin: Vec2 = {
    x: landing2Origin.x + v2.x * (turnSign2 * width * 0.5),
    y: landing2Origin.y + v2.y * (turnSign2 * width * 0.5),
  };
  const flight3 = buildFlightFromEdge(
    flight3Origin, u3, u2, rise, tread, nosing, width, n3,
    basePoint.z + rise * (n1 + n2 + 2),
  );

  const allTreads: readonly Polygon3D[] = [
    ...flight1.treads, ...flight2.treads, ...flight3.treads,
  ];
  const risers: readonly Segment3D[] = [
    ...flight1.risers, ...flight2.risers, ...flight3.risers,
  ];
  const walkline = buildGammaWalkline(
    basePoint, u1, u2, u3, rise, tread, width, n1, n2, n3,
  );
  // ADR-358 Phase 3d hotfix — arrow on FIRST flight segment (see lshape rationale).
  return assembleMultiFlight(params, {
    treads: allTreads,
    risers,
    walkline,
    cutDirs: [u1, u2, u3],
    flightSplit: [n1, n2, n3],
    arrowSymbol: arrowSymbol(walkline[0], walkline[1], upDirection),
    landings: [landing1, landing2],
  });
}

// ─── helpers ────────────────────────────────────────────────────────────────

function turnSign(d: StairTurnDirectionLR): 1 | -1 {
  return d === 'right' ? -1 : 1;
}

function resolveDepth(d: 'auto' | number, width: number): number {
  return d === 'auto' ? width : d;
}

function assertGammaCornerSupported(variant: StairVariantGamma): void {
  const style = variant.landingCornerStyle ?? 'square';
  if (style !== 'square') {
    throw new Error(
      `StairGeometryService: landingCornerStyle '${style}' requires Phase 3c (chamfer/fillet not implemented)`,
    );
  }
}

function buildGammaWalkline(
  basePoint: Readonly<Point3D>,
  u1: Vec2,
  u2: Vec2,
  u3: Vec2,
  rise: number,
  tread: number,
  width: number,
  n1: number,
  n2: number,
  n3: number,
): Polyline3D {
  // 6-vertex pattern. Sharp 90° turns occur at p3 (landing 1) and p5 (landing
  // 2). p2 and p4 are collinear with their successors so each stringer offset
  // produces 6 vertices with two miter corners (outer/inner miter = halfW·√2).
  const halfW = width * 0.5;
  const a1 = n1 * tread;
  const a3 = a1 + halfW;
  const flight2InnerRun = halfW + (n2 - 1) * tread;
  const flight3Run = halfW + (n3 - 1) * tread;
  const zL1 = basePoint.z + rise * n1;
  const zL2 = basePoint.z + rise * (n1 + n2 + 1);
  const zTop = basePoint.z + rise * (n1 + n2 + n3 + 1);
  // p3 = landing 1 corner (xy at u1·a3 from basePoint)
  const p3x = basePoint.x + u1.x * a3;
  const p3y = basePoint.y + u1.y * a3;
  // p4 = collinear extension along u2 by flight2InnerRun
  const p4x = p3x + u2.x * flight2InnerRun;
  const p4y = p3y + u2.y * flight2InnerRun;
  // p5 = p4 + u2·halfW (landing 2 corner)
  const p5x = p4x + u2.x * halfW;
  const p5y = p4y + u2.y * halfW;
  return [
    point(basePoint.x, basePoint.y, basePoint.z),
    point(basePoint.x + u1.x * a1, basePoint.y + u1.y * a1, zL1),
    point(p3x, p3y, zL1),
    point(p4x, p4y, zL2),
    point(p5x, p5y, zL2),
    point(p5x + u3.x * flight3Run, p5y + u3.y * flight3Run, zTop),
  ];
}
