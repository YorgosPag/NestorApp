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
  offsetAlong,
  centrelineWidthEdges,
  edgeWidthEdges,
  landingTransitionRisers,
} from './stair-geometry-shared';
import { resolveSwitchbackBase } from './stair-geometry-generators';
import {
  assembleWinderRun,
  assertWinderMethodSupported,
  buildWinderLayout,
} from './stair-geometry-winder';
import {
  appendRunAcrossNinetyTurn,
  assembleTurnRunStair,
  beginTurnRun,
  edgeRun,
} from './stair-flight-run-builder';

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

/**
 * L-shape landing variant — two flights joined by one 90° turn landing. ONE path
 * for both the bare stair and rest-landing (πλατύσκαλα) stairs (ADR-637 Phase 2b):
 * flight 1 is a centreline run, flight 2 an edge-origin run, so an empty schedule
 * yields runs byte-identical to the old bare flights. The turn landing is anchored
 * at flight 1's real plan end (`run1.endXY`) → a rest landing inside flight 1
 * slides the corner + flight 2 with no bespoke offset math; the z-model stays
 * invariant (flight 2 from level n1+1), only the footprint grows. Walkline is the
 * bespoke `buildLShapeWalkline` with no rest landings (byte-identical) and the
 * run-stitched centreline (shared 90°-turn helper) otherwise.
 *
 * ADR-358 Phase 3d — up-arrow on the FIRST walkline segment (AutoCAD/Revit plan
 * convention); `assembleTurnRunStair` derives it from `walkline[0]→walkline[1]`.
 */
function computeLShapeWithLanding(
  params: Readonly<StairParams>,
  variant: StairVariantLShapeLanding,
): StairGeometry {
  assertLShapeCornerSupported(variant);
  const { basePoint, rise, tread, width } = params;
  const { u1, v1, n1, n2, landingDepth, turnSign } = resolveSwitchbackBase(params, variant);
  const u2: Vec2 = { x: v1.x * turnSign, y: v1.y * turnSign };
  const { common, per, run1 } = beginTurnRun(params, u1, [n1, n2]);
  const turnLanding = buildLShapeLandingAt(
    run1.endXY, u1, v1, width, landingDepth, basePoint.z + rise * n1,
  );
  // Flight 2 edge origin off the turn corner (v1·turnSign·halfW), cross-width u1.
  const flight2Origin = offsetAlong(run1.endXY, v1, turnSign * width * 0.5);
  const run2 = edgeRun(common, flight2Origin, u2, u1, n1 + 1, n2, per[1]);

  // Transition risers around the corner landing (flight 1 top → landing → flight 2
  // first tread). Flight 1 is centreline (u1); flight 2 is edge-origin (cross-width
  // u1). Level n1 landing sits at basePoint.z + rise·n1.
  const turnRisers = landingTransitionRisers(
    centrelineWidthEdges(run1.endXY, u1, width),
    edgeWidthEdges(flight2Origin, u1, width),
    basePoint.z + rise * n1,
    rise,
  );

  let walkline: Point3D[];
  if (!params.restLandings || params.restLandings.length === 0) {
    walkline = buildLShapeWalkline(basePoint, u1, u2, rise, tread, width, n1, n2);
  } else {
    walkline = [...run1.walklinePts];
    appendRunAcrossNinetyTurn(walkline, run2, u1, width);
  }
  return assembleTurnRunStair(params, [run1, run2], [turnLanding], walkline, turnRisers);
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

/**
 * ADR-637 Phase 2b — the L-corner turn landing anchored at flight 1's ACTUAL
 * plan end (`flightEnd = basePoint + u·(n1·tread)` with no rest landings, or
 * `run1.endXY` when flight 1 carries πλατύσκαλα), so a rest landing inside flight
 * 1 slides the corner + flight 2 without any bespoke offset math.
 */
function buildLShapeLandingAt(
  flightEnd: Vec2,
  u: Vec2,
  v: Vec2,
  width: number,
  landingDepth: number,
  z: number,
): Polygon3D {
  const halfW = width * 0.5;
  const corner: Vec2 = { x: flightEnd.x - v.x * halfW, y: flightEnd.y - v.y * halfW };
  return rectangleAt(corner, u, landingDepth, width, z);
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
): Point3D[] {
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
