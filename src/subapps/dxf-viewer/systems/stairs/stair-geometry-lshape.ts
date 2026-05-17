/**
 * L-shape stair geometry (ADR-358 Phase 3a).
 *
 * Extracted from StairGeometryService.ts to keep that module under 500 lines.
 * Imported only by StairGeometryService.ts — treat as private implementation detail.
 */

import type { Point3D } from '../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantLShape,
} from '../../types/stair';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  perp,
  directionToUnitVector,
  point,
  rectangleAt,
  arrowSymbol,
  bboxOfPolygons,
  splitTreadsByCutPlane,
  buildCutLineForFlights,
  buildStringersFromWalkline,
} from './stair-geometry-shared';
import { buildTreadLabels } from './stair-geometry-labels';

// ─── L-SHAPE entry ────────────────────────────────────────────────────────────

export function computeLShape(
  params: Readonly<StairParams>,
  variant: StairVariantLShape,
): StairGeometry {
  assertLShapeCornerSupported(variant);
  const { basePoint, direction, rise, tread, nosing, width, upDirection } = params;
  const u1 = directionToUnitVector(direction);
  const v1 = perp(u1);
  const [n1, n2] = variant.flightSplit;
  const landingDepth = variant.landingDepth === 'auto' ? width : variant.landingDepth;
  const turnSign: 1 | -1 = variant.turnDirection === 'right' ? -1 : 1;
  const u2: Vec2 = { x: v1.x * turnSign, y: v1.y * turnSign };
  const flight1 = buildLShapeFlight1(basePoint, u1, v1, rise, tread, nosing, width, n1);
  const landing = buildLShapeLanding(basePoint, u1, v1, rise, tread, width, landingDepth, n1);
  const flight2 = buildLShapeFlight2(
    basePoint, u1, v1, u2, turnSign, rise, tread, nosing, width, n1, n2,
  );
  const allTreads: readonly Polygon3D[] = [...flight1.treads, ...flight2.treads];
  const risers: readonly Segment3D[] = [...flight1.risers, ...flight2.risers];
  const walkline = buildLShapeWalkline(basePoint, u1, u2, rise, tread, width, n1, n2);
  const stringers = buildStringersFromWalkline(walkline, width);
  // ADR-358 Phase 3d hotfix — arrow follows walkline FIRST segment (flight 1
  // direction) instead of cutting a straight diagonal from basePoint to the
  // top of flight 2 (industry convention: AutoCAD/Revit plan view show the
  // UP arrow on flight 1 with the "UP" label — multi-flight ascent is
  // implied by tread numbering, not by a polyline arrow).
  const arrow = arrowSymbol(walkline[0], walkline[1], upDirection);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(allTreads, cutPlaneHeight);
  const cutLine = buildCutLineForFlights(
    allTreads, [n1, n2], [u1, u2], width, cutPlaneHeight,
  );
  const treadLabels = buildTreadLabels(
    allTreads,
    [n1, n2],
    params.treadLabelDisplay,
    params.treadLabelEveryN,
    params.treadLabelRestartPerFlight,
    params.treadNumberStart,
  );
  return {
    treads: split.below,
    treadsBelowCut: split.below,
    treadsAboveCut: split.above,
    risers,
    stringers,
    walkline,
    handrails: {},
    landings: [landing],
    arrowSymbol: arrow,
    cutLine,
    treadLabels,
    bbox: bboxOfPolygons([...allTreads, landing]),
  };
}

// ─── L-SHAPE private helpers ──────────────────────────────────────────────────

function assertLShapeCornerSupported(variant: StairVariantLShape): void {
  const style = variant.landingCornerStyle ?? 'square';
  if (style !== 'square') {
    throw new Error(
      `StairGeometryService: landingCornerStyle '${style}' requires Phase 3c (chamfer/fillet not implemented)`,
    );
  }
}

function buildLShapeFlight1(
  basePoint: Readonly<Point3D>,
  u: Vec2,
  v: Vec2,
  rise: number,
  tread: number,
  nosing: number,
  width: number,
  n1: number,
): { readonly treads: readonly Polygon3D[]; readonly risers: readonly Segment3D[] } {
  const halfW = width * 0.5;
  const depth = tread + nosing;
  const treads: Polygon3D[] = new Array(n1);
  for (let i = 0; i < n1; i++) {
    const along = tread * i;
    const corner: Vec2 = {
      x: basePoint.x + u.x * along - v.x * halfW,
      y: basePoint.y + u.y * along - v.y * halfW,
    };
    treads[i] = rectangleAt(corner, u, depth, width, basePoint.z + rise * i);
  }
  const risers: Segment3D[] = [];
  for (let i = 0; i < n1 - 1; i++) {
    const along = tread * (i + 1);
    const cx = basePoint.x + u.x * along;
    const cy = basePoint.y + u.y * along;
    risers.push({
      start: point(cx - v.x * halfW, cy - v.y * halfW, basePoint.z + rise * i),
      end: point(cx - v.x * halfW, cy - v.y * halfW, basePoint.z + rise * (i + 1)),
    });
  }
  return { treads, risers };
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
): { readonly treads: readonly Polygon3D[]; readonly risers: readonly Segment3D[] } {
  // Flight 2 origin: corner of landing on its u2-exit side, lateral edge at u1 = n1·tread.
  // turnRight (turnSign=-1): exit on -v1 edge. turnLeft (turnSign=+1): exit on +v1 edge.
  const halfW = width * 0.5;
  const depth = tread + nosing;
  const exitLateralSign = turnSign;
  const flight2Origin: Vec2 = {
    x: basePoint.x + u1.x * (tread * n1) + v1.x * (exitLateralSign * halfW),
    y: basePoint.y + u1.y * (tread * n1) + v1.y * (exitLateralSign * halfW),
  };
  // Width axis = u1 for BOTH turn dirs — preserves CCW alignment with landing footprint.
  const v2 = u1;
  const treads: Polygon3D[] = new Array(n2);
  for (let i = 0; i < n2; i++) {
    const along2 = tread * i;
    const ox = flight2Origin.x + u2.x * along2;
    const oy = flight2Origin.y + u2.y * along2;
    const tz = basePoint.z + rise * (n1 + 1 + i);
    treads[i] = [
      point(ox, oy, tz),
      point(ox + u2.x * depth, oy + u2.y * depth, tz),
      point(ox + u2.x * depth + v2.x * width, oy + u2.y * depth + v2.y * width, tz),
      point(ox + v2.x * width, oy + v2.y * width, tz),
    ];
  }
  const risers: Segment3D[] = [];
  for (let i = 0; i < n2 - 1; i++) {
    const along2 = tread * (i + 1);
    const cx = flight2Origin.x + u2.x * along2;
    const cy = flight2Origin.y + u2.y * along2;
    risers.push({
      start: point(cx, cy, basePoint.z + rise * (n1 + 1 + i)),
      end: point(cx, cy, basePoint.z + rise * (n1 + 2 + i)),
    });
  }
  return { treads, risers };
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
