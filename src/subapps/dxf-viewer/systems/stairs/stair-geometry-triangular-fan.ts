/**
 * Triangular-fan stair geometry — ADR-358 Phase 4c.
 *
 * Polygonal/wedge "fan" stair: apex coincides with `variant.apexPoint`, the
 * full sweep is `variant.openingAngle`, treads are triangular wedges sharing
 * the apex (3-vertex like spiral). Outer radius = `params.width` (industry
 * default for central-apex fan stairs).
 *
 * Phase 4c constraint: `params.stepCount === variant.stepCountPerArc` (single
 * arc). Multi-arc polygonal spiral (where `stepCount > stepCountPerArc`) is
 * deferred — throws on mismatch.
 *
 * Conventions (shared with Phase 4a spiral):
 *   - Plan view: +X right, +Y up. `turnDirection='ccw'` ⇒ sign = +1, `'cw'` ⇒ -1.
 *   - First wedge boundary at θ = 0 (along +X from apex).
 *   - Tread polygon at z = i·rise (i = 0..stepCount-1) — vertices co-planar.
 *     Vertex order: sign=+1 ⇒ [apex, outerA, outerB]; sign=-1 ⇒ [apex, outerB, outerA].
 *   - Walkline via Phase 2a `helixSample` with `innerRadius=0`, `outerRadius=width`,
 *     yielding walkline radius = width/2 = halfW (stepCount + 1 vertices).
 *   - Stringers: outer = polyline at R = width (stepCount + 1 vertices);
 *     inner = stepCount + 1 copies of `apexPoint` (degenerate, like spiral).
 *   - Risers vertical at the outer corner of the angular boundary θ_{i+1}.
 *   - cutLine tangent perpendicular to the radial at the first tread crossing
 *     the cut plane.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type { Point3D } from '../../rendering/types/Types';
import { helixSample } from '../../rendering/entities/shared/geometry-curve-utils';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantTriangularFan,
} from '../../types/stair';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  point,
  arrowSymbol,
  bboxOfPolygons,
  splitTreadsByCutPlane,
  buildCutLine,
} from './stair-geometry-shared';
import { buildTreadLabels } from './stair-geometry-labels';

const DEG2RAD = Math.PI / 180;

interface FanGrid {
  readonly sign: 1 | -1;
  readonly angleStep: number;
  readonly riseStep: number;
}

function buildFanGrid(
  variant: StairVariantTriangularFan,
  params: Readonly<StairParams>,
): FanGrid {
  const sign: 1 | -1 = variant.turnDirection === 'ccw' ? 1 : -1;
  const sweepRad = variant.openingAngle * DEG2RAD;
  return {
    sign,
    angleStep: (sign * sweepRad) / params.stepCount,
    riseStep: params.rise,
  };
}

// ─── TRIANGULAR-FAN entry ─────────────────────────────────────────────────────

export function computeTriangularFan(
  params: Readonly<StairParams>,
  variant: StairVariantTriangularFan,
): StairGeometry {
  assertStepCountMatchesArc(params.stepCount, variant.stepCountPerArc);
  const outerRadius = params.width;
  const grid = buildFanGrid(variant, params);
  const treads = buildFanTreads(params, variant, grid, outerRadius);
  const risers = buildFanRisers(params, variant, grid, outerRadius);
  const walkline = helixSample(
    variant.apexPoint,
    0,
    outerRadius,
    variant.openingAngle,
    variant.turnDirection,
    params.stepCount,
    params.rise * params.stepCount,
  );
  const stringers = buildFanStringers(params, variant, grid, outerRadius);
  const arrow = arrowSymbol(walkline[0], walkline[walkline.length - 1], params.upDirection);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(treads, cutPlaneHeight);
  const cutLine = buildFanCutLine(treads, variant, grid, outerRadius, cutPlaneHeight);
  const treadLabels = buildTreadLabels(
    treads,
    [params.stepCount],
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
    bbox: bboxOfPolygons(treads),
  };
}

// ─── TRIANGULAR-FAN private helpers ───────────────────────────────────────────

function assertStepCountMatchesArc(stepCount: number, stepCountPerArc: number): void {
  if (stepCount !== stepCountPerArc) {
    throw new Error(
      `StairGeometryService: triangular-fan requires stepCount === stepCountPerArc ` +
        `(got stepCount=${stepCount}, stepCountPerArc=${stepCountPerArc}; multi-arc polygonal spiral deferred)`,
    );
  }
}

function buildFanTreads(
  params: Readonly<StairParams>,
  variant: StairVariantTriangularFan,
  grid: FanGrid,
  outerRadius: number,
): readonly Polygon3D[] {
  const { apexPoint } = variant;
  const treads: Polygon3D[] = new Array(params.stepCount);
  for (let i = 0; i < params.stepCount; i++) {
    const theta0 = i * grid.angleStep;
    const theta1 = (i + 1) * grid.angleStep;
    const z = apexPoint.z + grid.riseStep * i;
    const apex = point(apexPoint.x, apexPoint.y, z);
    const outerA = radialPoint(apexPoint, outerRadius, theta0, z);
    const outerB = radialPoint(apexPoint, outerRadius, theta1, z);
    treads[i] = grid.sign === 1 ? [apex, outerA, outerB] : [apex, outerB, outerA];
  }
  return treads;
}

function buildFanRisers(
  params: Readonly<StairParams>,
  variant: StairVariantTriangularFan,
  grid: FanGrid,
  outerRadius: number,
): readonly Segment3D[] {
  const risers: Segment3D[] = [];
  for (let i = 0; i < params.stepCount - 1; i++) {
    const theta = (i + 1) * grid.angleStep;
    const zLow = variant.apexPoint.z + grid.riseStep * i;
    const zHigh = variant.apexPoint.z + grid.riseStep * (i + 1);
    risers.push({
      start: radialPoint(variant.apexPoint, outerRadius, theta, zLow),
      end: radialPoint(variant.apexPoint, outerRadius, theta, zHigh),
    });
  }
  return risers;
}

function buildFanStringers(
  params: Readonly<StairParams>,
  variant: StairVariantTriangularFan,
  grid: FanGrid,
  outerRadius: number,
): { readonly inner: Polyline3D; readonly outer: Polyline3D } {
  const inner: Point3D[] = new Array(params.stepCount + 1);
  const outer: Point3D[] = new Array(params.stepCount + 1);
  for (let i = 0; i <= params.stepCount; i++) {
    const theta = i * grid.angleStep;
    const z = variant.apexPoint.z + grid.riseStep * i;
    inner[i] = point(variant.apexPoint.x, variant.apexPoint.y, z);
    outer[i] = radialPoint(variant.apexPoint, outerRadius, theta, z);
  }
  return { inner, outer };
}

function buildFanCutLine(
  treads: readonly Polygon3D[],
  variant: StairVariantTriangularFan,
  grid: FanGrid,
  outerRadius: number,
  cutPlaneHeight: number,
): Segment3D | undefined {
  for (let i = 0; i < treads.length; i++) {
    const z = treads[i][0]?.z ?? 0;
    if (z >= cutPlaneHeight) {
      const theta = (i + 0.5) * grid.angleStep;
      const tangent = tangentAt(theta, grid.sign);
      const radialMid = radialPoint(
        variant.apexPoint,
        outerRadius * 0.5,
        theta,
        cutPlaneHeight,
      );
      const tread: Polygon3D = [radialMid, radialMid, radialMid, radialMid];
      return buildCutLine(tread, tangent, outerRadius, cutPlaneHeight);
    }
  }
  return undefined;
}

function radialPoint(
  center: Readonly<Point3D>,
  radius: number,
  theta: number,
  z: number,
): Point3D {
  return point(
    center.x + radius * Math.cos(theta),
    center.y + radius * Math.sin(theta),
    z,
  );
}

function tangentAt(theta: number, sign: 1 | -1): Vec2 {
  return { x: -sign * Math.sin(theta), y: sign * Math.cos(theta) };
}
