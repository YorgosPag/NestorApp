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
 * ADR-611 — each arm is a shared `buildRectilinearFlight`; the `StairGeometry`
 * assembly tail comes from `stair-geometry-generators.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.3 §6.3
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantVShape,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  directionToUnitVector,
  point,
  arrowSymbol,
} from './stair-geometry-shared';
import { assembleMultiFlight, buildRectilinearFlight } from './stair-geometry-generators';

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
  const arm1 = buildRectilinearFlight(basePoint, u1, rise, tread, nosing, width, n1);
  const arm2 = buildRectilinearFlight(basePoint, u2, rise, tread, nosing, width, n2);
  const allTreads: readonly Polygon3D[] = [...arm1.treads, ...arm2.treads];
  const risers: readonly Segment3D[] = [...arm1.risers, ...arm2.risers];
  const walkline = buildVShapeWalkline(basePoint, u1, u2, rise, tread, n1, n2);
  return assembleMultiFlight(params, {
    treads: allTreads,
    risers,
    walkline,
    cutDirs: [u1, u2],
    flightSplit: [n1, n2],
    arrowSymbol: arrowSymbol(basePoint, walkline[0], upDirection),
  });
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
