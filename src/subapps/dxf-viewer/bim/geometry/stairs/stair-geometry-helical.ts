/**
 * Helical (open-well circular) stair geometry — ADR-358 Phase 4a.
 *
 * Extracted from StairGeometryService.ts to keep that module under 500 lines.
 * Reuses Phase 2a `helixSample` for the walkline (arc-length parametrized at
 * `R = (innerRadius + outerRadius) / 2`) and emits annular wedge treads at
 * `R ∈ [innerRadius, outerRadius]`.
 *
 * Conventions (shared with Phase 3a/3b):
 *   - Plan view: +X right, +Y up. `turnDirection='ccw'` ⇒ sign = +1, `'cw'` ⇒ -1.
 *   - Tread polygon at z = i·rise (i = 0..stepCount-1) — vertices co-planar.
 *     Wedge vertex order CCW in xy:
 *       sign=+1: inner_i → outer_i → outer_next → inner_next
 *       sign=-1: inner_next → outer_next → outer_i → inner_i
 *   - Risers vertical at the inner-radius angular boundary θ_{i+1}.
 *   - Stringers = constant-radius arcs sampled at the same angular grid as
 *     treads (stepCount + 1 vertices).
 *   - cutLine tangent perpendicular to the radial at the first tread crossing
 *     the cut plane — buildCutLine receives that tangent as its `uDir`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type { Point3D } from '../../../rendering/types/Types';
import { helixSample } from '../../../rendering/entities/shared/geometry-curve-utils';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantHelical,
} from '../../../bim/types/stair-types';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  point,
  arrowSymbol,
  bboxOfPolygons,
  splitTreadsByCutPlane,
  buildCutLine,
  buildHandrailsFromParams,
} from './stair-geometry-shared';
import { buildTreadLabels } from './stair-geometry-labels';

const DEG2RAD = Math.PI / 180;

interface AngularGrid {
  readonly sign: 1 | -1;
  readonly angleStep: number;
  readonly riseStep: number;
}

function buildAngularGrid(
  variant: StairVariantHelical,
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

// ─── HELICAL entry ────────────────────────────────────────────────────────────

export function computeHelical(
  params: Readonly<StairParams>,
  variant: StairVariantHelical,
): StairGeometry {
  const grid = buildAngularGrid(variant, params);
  const treads = buildHelicalTreads(params, variant, grid);
  const risers = buildHelicalRisers(params, variant, grid);
  const walkline = helixSample(
    variant.centerPoint,
    variant.innerRadius,
    variant.outerRadius,
    variant.sweepAngle,
    variant.turnDirection,
    params.stepCount,
    params.rise * params.stepCount,
  );
  const stringers = buildHelicalStringers(params, variant, grid);
  const arrow = arrowSymbol(walkline[0], walkline[walkline.length - 1], params.upDirection);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(treads, cutPlaneHeight);
  const cutLine = buildHelicalCutLine(treads, variant, grid, params, cutPlaneHeight);
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
    handrails: buildHandrailsFromParams(walkline, params.width, params.handrails),
    landings: [],
    arrowSymbol: arrow,
    cutLine,
    treadLabels,
    bbox: bboxOfPolygons(treads),
  };
}

// ─── HELICAL private helpers ──────────────────────────────────────────────────

function buildHelicalTreads(
  params: Readonly<StairParams>,
  variant: StairVariantHelical,
  grid: AngularGrid,
): readonly Polygon3D[] {
  const { centerPoint } = variant;
  const { innerRadius, outerRadius } = variant;
  const treads: Polygon3D[] = new Array(params.stepCount);
  for (let i = 0; i < params.stepCount; i++) {
    const theta0 = i * grid.angleStep;
    const theta1 = (i + 1) * grid.angleStep;
    const z = centerPoint.z + grid.riseStep * i;
    const innerA = radialPoint(centerPoint, innerRadius, theta0, z);
    const outerA = radialPoint(centerPoint, outerRadius, theta0, z);
    const innerB = radialPoint(centerPoint, innerRadius, theta1, z);
    const outerB = radialPoint(centerPoint, outerRadius, theta1, z);
    treads[i] = grid.sign === 1
      ? [innerA, outerA, outerB, innerB]
      : [innerB, outerB, outerA, innerA];
  }
  return treads;
}

function buildHelicalRisers(
  params: Readonly<StairParams>,
  variant: StairVariantHelical,
  grid: AngularGrid,
): readonly Segment3D[] {
  // ADR-370 Phase 5.3 — diagonal Segment3D (see StairGeometryService.buildStraightRisers).
  // Helical width axis is RADIAL: start at inner edge, end at outer edge of
  // the angular boundary θ_{i+1}. Width = outerRadius − innerRadius = params.width.
  const risers: Segment3D[] = [];
  for (let i = 0; i < params.stepCount - 1; i++) {
    const theta = (i + 1) * grid.angleStep;
    const zLow = variant.centerPoint.z + grid.riseStep * i;
    const zHigh = variant.centerPoint.z + grid.riseStep * (i + 1);
    risers.push({
      start: radialPoint(variant.centerPoint, variant.innerRadius, theta, zLow),
      end: radialPoint(variant.centerPoint, variant.outerRadius, theta, zHigh),
    });
  }
  return risers;
}

function buildHelicalStringers(
  params: Readonly<StairParams>,
  variant: StairVariantHelical,
  grid: AngularGrid,
): { readonly inner: Polyline3D; readonly outer: Polyline3D } {
  const inner: Point3D[] = new Array(params.stepCount + 1);
  const outer: Point3D[] = new Array(params.stepCount + 1);
  for (let i = 0; i <= params.stepCount; i++) {
    const theta = i * grid.angleStep;
    const z = variant.centerPoint.z + grid.riseStep * i;
    inner[i] = radialPoint(variant.centerPoint, variant.innerRadius, theta, z);
    outer[i] = radialPoint(variant.centerPoint, variant.outerRadius, theta, z);
  }
  return { inner, outer };
}

function buildHelicalCutLine(
  treads: readonly Polygon3D[],
  variant: StairVariantHelical,
  grid: AngularGrid,
  params: Readonly<StairParams>,
  cutPlaneHeight: number,
): Segment3D | undefined {
  const width = variant.outerRadius - variant.innerRadius;
  for (let i = 0; i < treads.length; i++) {
    const z = treads[i][0]?.z ?? 0;
    if (z >= cutPlaneHeight) {
      const theta = (i + 0.5) * grid.angleStep;
      const tangent = tangentAt(theta, grid.sign);
      const radialMid = radialPoint(
        variant.centerPoint,
        (variant.innerRadius + variant.outerRadius) * 0.5,
        theta,
        cutPlaneHeight,
      );
      const tread: Polygon3D = [radialMid, radialMid, radialMid, radialMid];
      return buildCutLine(tread, tangent, width, cutPlaneHeight);
    }
  }
  // Defensive: silence unused param when stair stays entirely below cut plane.
  void params;
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
  // d/dθ (cos θ, sin θ) = (-sin θ, cos θ). Sign flips for cw sweep.
  return { x: -sign * Math.sin(theta), y: sign * Math.cos(theta) };
}
