/**
 * Spiral stair geometry — ADR-358 Phase 4a.
 *
 * Apex-at-center degenerate helical: `innerRadius` is fixed at 0 by the
 * `StairVariantSpiral` type, so each tread is a triangular wedge with its
 * apex at the central column point. Convention shared with Phase 4a helical:
 *
 *   - Plan view: +X right, +Y up. `turnDirection='ccw'` ⇒ sign = +1, else -1.
 *   - Outer radius of the wedge = `params.width` (industry default for
 *     central-column spiral stairs).
 *   - Walkline radius = (innerRadius + outerRadius)/2 = width/2 — uses Phase
 *     2a `helixSample` with `innerRadius=0`.
 *   - Risers vertical at the outer corner of the angular boundary θ_{i+1}.
 *   - Stringers: `outer` = polyline at R = width sampled uniformly; `inner`
 *     collapsed to the apex (stepCount + 1 copies of `centerPoint`) since
 *     `innerRadius = 0` precludes an inner stringer.
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
  StairVariantSpiral,
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

interface AngularGrid {
  readonly sign: 1 | -1;
  readonly angleStep: number;
  readonly riseStep: number;
}

function buildAngularGrid(
  variant: StairVariantSpiral,
  params: Readonly<StairParams>,
): AngularGrid {
  const sign: 1 | -1 = variant.turnDirection === 'ccw' ? 1 : -1;
  const sweepRad = variant.sweepAngle * DEG2RAD;
  return {
    sign,
    angleStep: (sign * sweepRad) / params.stepCount,
    riseStep: params.rise,
  };
}

// ─── SPIRAL entry ─────────────────────────────────────────────────────────────

export function computeSpiral(
  params: Readonly<StairParams>,
  variant: StairVariantSpiral,
): StairGeometry {
  const outerRadius = params.width;
  const grid = buildAngularGrid(variant, params);
  const treads = buildSpiralTreads(params, variant, grid, outerRadius);
  const risers = buildSpiralRisers(params, variant, grid, outerRadius);
  const walkline = helixSample(
    variant.centerPoint,
    0,
    outerRadius,
    variant.sweepAngle,
    variant.turnDirection,
    params.stepCount,
    params.rise * params.stepCount,
  );
  const stringers = buildSpiralStringers(params, variant, grid, outerRadius);
  const arrow = arrowSymbol(walkline[0], walkline[walkline.length - 1], params.upDirection);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(treads, cutPlaneHeight);
  const cutLine = buildSpiralCutLine(treads, variant, grid, outerRadius, cutPlaneHeight);
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

// ─── SPIRAL private helpers ───────────────────────────────────────────────────

function buildSpiralTreads(
  params: Readonly<StairParams>,
  variant: StairVariantSpiral,
  grid: AngularGrid,
  outerRadius: number,
): readonly Polygon3D[] {
  const { centerPoint } = variant;
  const treads: Polygon3D[] = new Array(params.stepCount);
  for (let i = 0; i < params.stepCount; i++) {
    const theta0 = i * grid.angleStep;
    const theta1 = (i + 1) * grid.angleStep;
    const z = centerPoint.z + grid.riseStep * i;
    const apex = point(centerPoint.x, centerPoint.y, z);
    const outerA = radialPoint(centerPoint, outerRadius, theta0, z);
    const outerB = radialPoint(centerPoint, outerRadius, theta1, z);
    treads[i] = grid.sign === 1 ? [apex, outerA, outerB] : [apex, outerB, outerA];
  }
  return treads;
}

function buildSpiralRisers(
  params: Readonly<StairParams>,
  variant: StairVariantSpiral,
  grid: AngularGrid,
  outerRadius: number,
): readonly Segment3D[] {
  const risers: Segment3D[] = [];
  for (let i = 0; i < params.stepCount - 1; i++) {
    const theta = (i + 1) * grid.angleStep;
    const zLow = variant.centerPoint.z + grid.riseStep * i;
    const zHigh = variant.centerPoint.z + grid.riseStep * (i + 1);
    risers.push({
      start: radialPoint(variant.centerPoint, outerRadius, theta, zLow),
      end: radialPoint(variant.centerPoint, outerRadius, theta, zHigh),
    });
  }
  return risers;
}

function buildSpiralStringers(
  params: Readonly<StairParams>,
  variant: StairVariantSpiral,
  grid: AngularGrid,
  outerRadius: number,
): { readonly inner: Polyline3D; readonly outer: Polyline3D } {
  const inner: Point3D[] = new Array(params.stepCount + 1);
  const outer: Point3D[] = new Array(params.stepCount + 1);
  for (let i = 0; i <= params.stepCount; i++) {
    const theta = i * grid.angleStep;
    const z = variant.centerPoint.z + grid.riseStep * i;
    inner[i] = point(variant.centerPoint.x, variant.centerPoint.y, z);
    outer[i] = radialPoint(variant.centerPoint, outerRadius, theta, z);
  }
  return { inner, outer };
}

function buildSpiralCutLine(
  treads: readonly Polygon3D[],
  variant: StairVariantSpiral,
  grid: AngularGrid,
  outerRadius: number,
  cutPlaneHeight: number,
): Segment3D | undefined {
  for (let i = 0; i < treads.length; i++) {
    const z = treads[i][0]?.z ?? 0;
    if (z >= cutPlaneHeight) {
      const theta = (i + 0.5) * grid.angleStep;
      const tangent = tangentAt(theta, grid.sign);
      const radialMid = radialPoint(
        variant.centerPoint,
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
