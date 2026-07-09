/**
 * High-level stair-run computers (ADR-611).
 *
 * Composed `StairGeometry` builders that unify whole families of kinds which
 * differ only by a configuration object — the big-player component model
 * (Revit / ArchiCAD expose a small set of StairsRun component types, not one
 * bespoke generator per visual variant):
 *
 *   - `computeRadialStair` — spiral · helical · triangular-fan (a circular run
 *     parametrised by inner/outer radius + apex flag). CurvedStairsRun analogue.
 *   - `computeWalklineStair` — elliptical · sketch (a run that follows a sampled
 *     walkline with chord-perpendicular wedge treads). SketchStairsRun analogue.
 *
 * Each concrete kind file becomes a thin thunk that supplies the config /
 * pre-sampled walkline and delegates here — no per-kind geometry duplication.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-stair-geometry-generators-ssot.md
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
  StairTurnDirectionCW,
} from '../../../bim/types/stair-types';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  point,
  buildCutLine,
  buildStringersFromWalkline,
} from './stair-geometry-shared';
import {
  type AngularGrid,
  assembleSingleFlightWalkline,
  buildAngularGrid,
  buildWalklineCutLine,
  buildWalklineRisers,
  buildWalklineTreads,
  radialPoint,
  radialTangentAt,
} from './stair-geometry-generators';

// ─── Radial stair (Revit CurvedStairsRun) ─────────────────────────────────────

/**
 * Configuration for a radial (circular) stair run. `apex = true` collapses the
 * inner radius to a point → triangular wedge treads (spiral / triangular-fan);
 * `apex = false` → annular quad treads (helical). `innerRadius` is 0 in apex
 * mode. Center is `centerPoint` (spiral/helical) or `apexPoint` (fan).
 */
export interface RadialStairConfig {
  readonly center: Readonly<Point3D>;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly sweepAngleDeg: number;
  readonly turnDirection: StairTurnDirectionCW;
  readonly apex: boolean;
}

/**
 * Compute a full radial `StairGeometry` — the single SSoT for spiral, helical
 * and triangular-fan stairs (they differ only by this config).
 */
export function computeRadialStair(
  params: Readonly<StairParams>,
  cfg: RadialStairConfig,
): StairGeometry {
  const grid = buildAngularGrid(cfg.sweepAngleDeg, cfg.turnDirection, params.stepCount, params.rise);
  const treads = buildRadialTreads(params.stepCount, grid, cfg);
  const risers = buildRadialRisers(params.stepCount, grid, cfg);
  const walkline = helixSample(
    cfg.center,
    cfg.innerRadius,
    cfg.outerRadius,
    cfg.sweepAngleDeg,
    cfg.turnDirection,
    params.stepCount,
    params.rise * params.stepCount,
  );
  const stringers = buildRadialStringers(params.stepCount, grid, cfg);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const cutLine = buildRadialCutLine(treads, grid, cfg, cutPlaneHeight);
  return assembleSingleFlightWalkline(params, { treads, risers, stringers, walkline, cutLine });
}

function buildRadialTreads(
  stepCount: number,
  grid: AngularGrid,
  cfg: RadialStairConfig,
): readonly Polygon3D[] {
  const { center, innerRadius, outerRadius, apex } = cfg;
  const treads: Polygon3D[] = new Array(stepCount);
  for (let i = 0; i < stepCount; i++) {
    const theta0 = i * grid.angleStep;
    const theta1 = (i + 1) * grid.angleStep;
    const z = center.z + grid.riseStep * i;
    const outerA = radialPoint(center, outerRadius, theta0, z);
    const outerB = radialPoint(center, outerRadius, theta1, z);
    if (apex) {
      const apexPt = point(center.x, center.y, z);
      treads[i] = grid.sign === 1 ? [apexPt, outerA, outerB] : [apexPt, outerB, outerA];
    } else {
      const innerA = radialPoint(center, innerRadius, theta0, z);
      const innerB = radialPoint(center, innerRadius, theta1, z);
      treads[i] = grid.sign === 1
        ? [innerA, outerA, outerB, innerB]
        : [innerB, outerB, outerA, innerA];
    }
  }
  return treads;
}

function buildRadialRisers(
  stepCount: number,
  grid: AngularGrid,
  cfg: RadialStairConfig,
): readonly Segment3D[] {
  // ADR-370 Phase 5.3 — diagonal Segment3D. Width axis is RADIAL: start at the
  // inner edge (apex when innerRadius=0), end at the outer edge of boundary θ_{i+1}.
  const { center, innerRadius, outerRadius } = cfg;
  const risers: Segment3D[] = [];
  for (let i = 0; i < stepCount - 1; i++) {
    const theta = (i + 1) * grid.angleStep;
    const zLow = center.z + grid.riseStep * i;
    const zHigh = center.z + grid.riseStep * (i + 1);
    risers.push({
      start: radialPoint(center, innerRadius, theta, zLow),
      end: radialPoint(center, outerRadius, theta, zHigh),
    });
  }
  return risers;
}

function buildRadialStringers(
  stepCount: number,
  grid: AngularGrid,
  cfg: RadialStairConfig,
): { readonly inner: Polyline3D; readonly outer: Polyline3D } {
  const { center, innerRadius, outerRadius } = cfg;
  const inner: Point3D[] = new Array(stepCount + 1);
  const outer: Point3D[] = new Array(stepCount + 1);
  for (let i = 0; i <= stepCount; i++) {
    const theta = i * grid.angleStep;
    const z = center.z + grid.riseStep * i;
    inner[i] = radialPoint(center, innerRadius, theta, z);
    outer[i] = radialPoint(center, outerRadius, theta, z);
  }
  return { inner, outer };
}

function buildRadialCutLine(
  treads: readonly Polygon3D[],
  grid: AngularGrid,
  cfg: RadialStairConfig,
  cutPlaneHeight: number,
): Segment3D | undefined {
  const { center, innerRadius, outerRadius } = cfg;
  const width = outerRadius - innerRadius;
  for (let i = 0; i < treads.length; i++) {
    const z = treads[i][0]?.z ?? 0;
    if (z >= cutPlaneHeight) {
      const theta = (i + 0.5) * grid.angleStep;
      const tangent = radialTangentAt(theta, grid.sign);
      const radialMid = radialPoint(
        center,
        (innerRadius + outerRadius) * 0.5,
        theta,
        cutPlaneHeight,
      );
      const tread: Polygon3D = [radialMid, radialMid, radialMid, radialMid];
      return buildCutLine(tread, tangent, width, cutPlaneHeight);
    }
  }
  return undefined;
}

// ─── Walkline-following stair (Revit SketchStairsRun) ──────────────────────────

/**
 * Compute a full walkline-following `StairGeometry` — the SSoT for elliptical
 * and sketch stairs. The caller supplies the sampled `walkline` and the winding
 * `sign` (sketch is always `+1`); treads, risers, stringers and cutLine all
 * derive from the shared walkline generators.
 */
export function computeWalklineStair(
  params: Readonly<StairParams>,
  walkline: Polyline3D,
  sign: 1 | -1,
): StairGeometry {
  const treads = buildWalklineTreads(walkline, params.width, sign);
  const risers = buildWalklineRisers(walkline, params.width, sign);
  const stringers = buildStringersFromWalkline(walkline, params.width);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const cutLine = buildWalklineCutLine(walkline, params.width, cutPlaneHeight);
  return assembleSingleFlightWalkline(params, { treads, risers, stringers, walkline, cutLine });
}
