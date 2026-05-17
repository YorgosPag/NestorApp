/**
 * V-shape stair geometry (ADR-358 Phase 3c).
 *
 * Two straight arms diverging from a shared `basePoint` (apex at z = 0). No
 * connecting landing — arms are independent flights ascending in directions
 * `d` and `d + armAngleDeg` (math frame, CCW positive when angle > 0).
 *
 * z-model:
 *   Arm i tread j sits at z = j·rise for j = 0..armSplit[i] − 1. Both arms
 *   share the z=0 step (first tread of each arm starts at `basePoint`); they
 *   do NOT overlap because they extend in different directions.
 *
 * Imported only by `StairGeometryService.ts` — treat as private impl detail.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.3 §6.3
 */

import type { Point3D } from '../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantVShape,
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

const MIN_ARM_ANGLE_DEG = 15;
const MAX_ARM_ANGLE_DEG = 170;

// ─── V-SHAPE entry ────────────────────────────────────────────────────────────

export function computeVShape(
  params: Readonly<StairParams>,
  variant: StairVariantVShape,
): StairGeometry {
  assertVShapeConstraints(variant);
  const { basePoint, direction, rise, tread, nosing, width, upDirection } = params;
  const [n1, n2] = variant.armSplit;
  const u1 = directionToUnitVector(direction);
  const u2 = directionToUnitVector(direction + variant.armAngleDeg);
  const arm1 = buildVShapeArm(basePoint, u1, rise, tread, nosing, width, n1);
  const arm2 = buildVShapeArm(basePoint, u2, rise, tread, nosing, width, n2);
  const allTreads: readonly Polygon3D[] = [...arm1.treads, ...arm2.treads];
  const risers: readonly Segment3D[] = [...arm1.risers, ...arm2.risers];
  const walkline = buildVShapeWalkline(basePoint, u1, u2, rise, tread, n1, n2);
  const stringers = buildStringersFromWalkline(walkline, width);
  const arrow = arrowSymbol(basePoint, walkline[0], upDirection);
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
    landings: [],
    arrowSymbol: arrow,
    cutLine,
    treadLabels,
    bbox: bboxOfPolygons(allTreads),
  };
}

// ─── V-SHAPE private helpers ──────────────────────────────────────────────────

function assertVShapeConstraints(variant: StairVariantVShape): void {
  const { armAngleDeg, armSplit } = variant;
  if (!(armAngleDeg >= MIN_ARM_ANGLE_DEG && armAngleDeg <= MAX_ARM_ANGLE_DEG)) {
    throw new Error(
      `StairGeometryService: v-shape armAngleDeg ${armAngleDeg}° outside ` +
      `[${MIN_ARM_ANGLE_DEG}, ${MAX_ARM_ANGLE_DEG}] (degenerate overlap or back-to-back)`,
    );
  }
  if (armSplit[0] < 1 || armSplit[1] < 1) {
    throw new Error(
      `StairGeometryService: v-shape armSplit [${armSplit[0]}, ${armSplit[1]}] must satisfy armSplit[i] ≥ 1`,
    );
  }
}

function buildVShapeArm(
  basePoint: Readonly<Point3D>,
  u: Vec2,
  rise: number,
  tread: number,
  nosing: number,
  width: number,
  n: number,
): { readonly treads: readonly Polygon3D[]; readonly risers: readonly Segment3D[] } {
  const v = perp(u);
  const halfW = width * 0.5;
  const depth = tread + nosing;
  const treads: Polygon3D[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const along = tread * i;
    const corner: Vec2 = {
      x: basePoint.x + u.x * along - v.x * halfW,
      y: basePoint.y + u.y * along - v.y * halfW,
    };
    treads[i] = rectangleAt(corner, u, depth, width, basePoint.z + rise * i);
  }
  const risers: Segment3D[] = [];
  for (let i = 0; i < n - 1; i++) {
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

/**
 * V walkline: 3-vertex polyline running tip-of-arm-1 → apex → tip-of-arm-2.
 * Apex sits at z = basePoint.z so the offsetPolyline stringer pass produces a
 * V-shaped pair of side rails. Tips sit at the centerline endpoint of each
 * arm (one tread span past the last tread, matching l-shape's flight2Run
 * convention so the walkline reaches the top floor level).
 */
function buildVShapeWalkline(
  basePoint: Readonly<Point3D>,
  u1: Vec2,
  u2: Vec2,
  rise: number,
  tread: number,
  n1: number,
  n2: number,
): Polyline3D {
  const a1 = tread * n1;
  const a2 = tread * n2;
  return [
    point(basePoint.x + u1.x * a1, basePoint.y + u1.y * a1, basePoint.z + rise * n1),
    point(basePoint.x, basePoint.y, basePoint.z),
    point(basePoint.x + u2.x * a2, basePoint.y + u2.y * a2, basePoint.z + rise * n2),
  ];
}
