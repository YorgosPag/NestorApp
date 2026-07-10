/**
 * L-shape stair geometry (ADR-358 Phase 3a).
 *
 * Extracted from StairGeometryService.ts to keep that module under 500 lines.
 * Imported only by StairGeometryService.ts — treat as private implementation detail.
 *
 * ADR-611 — flight 1 (rectilinear) and flight 2 (edge-origin) delegate to the
 * shared generators (`buildRectilinearFlight` / `buildFlightFromEdge`); the
 * `StairGeometry` assembly tail comes from `stair-geometry-generators.ts`.
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  StairGeometry,
  StairParams,
  StairVariantLShape,
  StairVariantLShapeLanding,
  StairVariantLShapeWinders,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  rectangleAt,
  point,
  arrowSymbol,
} from './stair-geometry-shared';
import {
  type FlightGeometry,
  assembleTwoFlightLanding,
  buildFlightFromEdge,
  buildRectilinearFlight,
  resolveSwitchbackBase,
} from './stair-geometry-generators';
import {
  assembleWinderRun,
  assertWinderMethodSupported,
  buildWinderLayout,
} from './stair-geometry-winder';

// ─── L-SHAPE entry ────────────────────────────────────────────────────────────

export function computeLShape(
  params: Readonly<StairParams>,
  variant: StairVariantLShape,
): StairGeometry {
  // ADR-358 Phase 3f — dispatch on cornerStyle. 'landing' is the original
  // path (πλατύσκαλο at the corner); 'winders' replaces the landing with
  // NOK-compliant winder treads (σκαλοπάτια κουρμπαριστά) that preserve
  // walkline going. Both preserve total numbered surfaces = stepCount.
  if (variant.cornerStyle === 'winders') {
    return computeLShapeWithWinders(params, variant);
  }
  return computeLShapeWithLanding(params, variant);
}

function computeLShapeWithLanding(
  params: Readonly<StairParams>,
  variant: StairVariantLShapeLanding,
): StairGeometry {
  assertLShapeCornerSupported(variant);
  const { basePoint, rise, tread, nosing, width } = params;
  const { u1, v1, n1, n2, landingDepth, turnSign } = resolveSwitchbackBase(params, variant);
  const u2: Vec2 = { x: v1.x * turnSign, y: v1.y * turnSign };
  // ADR-358 Phase 3d hotfix — arrow follows walkline FIRST segment (flight 1
  // direction), not a straight diagonal from basePoint to flight-2 top
  // (industry convention: AutoCAD/Revit plan view show the UP arrow on flight
  // 1; multi-flight ascent is implied by tread numbering — see assembleTwoFlightLanding).
  const flight1 = buildRectilinearFlight(basePoint, u1, rise, tread, nosing, width, n1);
  const landing = buildLShapeLanding(basePoint, u1, v1, rise, tread, width, landingDepth, n1);
  const flight2 = buildLShapeFlight2(
    basePoint, u1, v1, u2, turnSign, rise, tread, nosing, width, n1, n2,
  );
  const walkline = buildLShapeWalkline(basePoint, u1, u2, rise, tread, width, n1, n2);
  return assembleTwoFlightLanding(params, {
    flight1,
    flight2,
    walkline,
    landing,
    dirs: [u1, u2],
    split: [n1, n2],
  });
}

/**
 * ADR-358 Phase 3f — L-shape with NOK-compliant winder treads at the corner.
 * Reuses winder kind helpers (SSoT: `stair-geometry-winder.ts`) for layout,
 * fan treads, walkline arc — l-shape supplies user-controlled `flightSplit`
 * `[n1, n2]` (vs the winder kind's symmetric auto-split).
 * Convention: 90° quarter-turn (turnSign from `turnDirection`).
 */
function computeLShapeWithWinders(
  params: Readonly<StairParams>,
  variant: StairVariantLShapeWinders,
): StairGeometry {
  assertWinderMethodSupported(variant.winderMethod);
  const [n1, n2] = variant.flightSplit;
  const turnAngleDeg = variant.turnDirection === 'right' ? -90 : 90;
  const layout = buildWinderLayout(params, turnAngleDeg, variant.winderCount, n1, n2);
  // ADR-358 Phase 3d hotfix — arrow on FIRST flight segment (consistent with
  // landing variant industry convention: AutoCAD/Revit plan view).
  // Winders are numbered as 'tread' (NOT landings) — they ARE walkable steps.
  return assembleWinderRun(params, layout,
    (wl) => arrowSymbol(wl[0], wl[1], params.upDirection));
}

// ─── L-SHAPE private helpers ──────────────────────────────────────────────────

function assertLShapeCornerSupported(variant: StairVariantLShapeLanding): void {
  const style = variant.landingCornerStyle ?? 'square';
  if (style !== 'square') {
    throw new Error(
      `StairGeometryService: landingCornerStyle '${style}' requires Phase 3c (chamfer/fillet not implemented)`,
    );
  }
}

function buildLShapeLanding(
  basePoint: Readonly<Point3D>,
  u: Vec2,
  v: Vec2,
  rise: number,
  tread: number,
  width: number,
  landingDepth: number,
  n1: number,
): Polygon3D {
  const halfW = width * 0.5;
  const along = tread * n1;
  const corner: Vec2 = {
    x: basePoint.x + u.x * along - v.x * halfW,
    y: basePoint.y + u.y * along - v.y * halfW,
  };
  return rectangleAt(corner, u, landingDepth, width, basePoint.z + rise * n1);
}

/**
 * Flight 2 origin: corner of landing on its u2-exit side, lateral edge at u1 =
 * n1·tread. turnRight (turnSign=-1): exit on -v1 edge; turnLeft (+1): +v1 edge.
 * Width axis = u1 for BOTH turn dirs — preserves CCW alignment with the landing
 * footprint. ADR-611 — treads/risers via the shared `buildFlightFromEdge`.
 */
function buildLShapeFlight2(
  basePoint: Readonly<Point3D>,
  u1: Vec2,
  v1: Vec2,
  u2: Vec2,
  turnSign: 1 | -1,
  rise: number,
  tread: number,
  nosing: number,
  width: number,
  n1: number,
  n2: number,
): FlightGeometry {
  const halfW = width * 0.5;
  const exitLateralSign = turnSign;
  const flight2Origin: Vec2 = {
    x: basePoint.x + u1.x * (tread * n1) + v1.x * (exitLateralSign * halfW),
    y: basePoint.y + u1.y * (tread * n1) + v1.y * (exitLateralSign * halfW),
  };
  const v2 = u1;
  return buildFlightFromEdge(
    flight2Origin, u2, v2, rise, tread, nosing, width, n2, basePoint.z + rise * (n1 + 1),
  );
}

function buildLShapeWalkline(
  basePoint: Readonly<Point3D>,
  u1: Vec2,
  u2: Vec2,
  rise: number,
  tread: number,
  width: number,
  n1: number,
  n2: number,
): Polyline3D {
  // 4 vertices, single sharp 90° turn at v3 (the L corner inside the landing).
  // v2 is collinear with v1→v3 (along u1) — keeps stringer count at 4 while
  // ensuring the miter at the only real corner equals d·√2 (perp dot = 0).
  const halfW = width * 0.5;
  const a1 = tread * n1;
  const a3 = a1 + halfW;
  const flight2Run = halfW + (n2 - 1) * tread;
  return [
    point(basePoint.x, basePoint.y, basePoint.z),
    point(basePoint.x + u1.x * a1, basePoint.y + u1.y * a1, basePoint.z + rise * n1),
    point(basePoint.x + u1.x * a3, basePoint.y + u1.y * a3, basePoint.z + rise * n1),
    point(
      basePoint.x + u1.x * a3 + u2.x * flight2Run,
      basePoint.y + u1.y * a3 + u2.y * flight2Run,
      basePoint.z + rise * (n1 + n2),
    ),
  ];
}
