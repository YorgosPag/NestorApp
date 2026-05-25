/**
 * Sketch stair geometry — ADR-358 Phase 4c.
 *
 * Free-form stair following a user-drawn walkline polyline. The
 * `variant.walklinePath` length MUST equal `params.stepCount + 1` (one vertex
 * per tread boundary + closing vertex); otherwise throws. z values in the
 * input path are overridden by `z_i = i·rise` to enforce a uniform riser
 * progression (industry-aligned: a free-form sketch supplies the plan-view
 * curve, the stair tool supplies the vertical model).
 *
 * Conventions (shared with Phase 4b elliptical):
 *   - Plan view: +X right, +Y up.
 *   - Tread polygon at z = i·rise, vertices co-planar. Wedge extends
 *     ±(width/2) about each chord via chord-tangent perpendicular:
 *       [innerA, outerA, outerB, innerB]
 *     where `innerX = walkline[X] − halfW·perp(chordTangent)` and
 *     `outerX = walkline[X] + halfW·perp(chordTangent)`.
 *   - Risers vertical at the leading inner corner of segment i+1.
 *   - Stringers via Phase 2b `offsetPolyline` (shared `buildStringersFromWalkline`).
 *   - cutLine perpendicular to the first chord crossing the cut plane.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantSketch,
} from '../../../bim/types/stair-types';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  perp,
  point,
  arrowSymbol,
  bboxOfPolygons,
  splitTreadsByCutPlane,
  buildCutLine,
  buildStringersFromWalkline,
  buildHandrailsFromParams,
} from './stair-geometry-shared';
import { buildTreadLabels } from './stair-geometry-labels';

// ─── SKETCH entry ─────────────────────────────────────────────────────────────

export function computeSketch(
  params: Readonly<StairParams>,
  variant: StairVariantSketch,
): StairGeometry {
  assertWalklineLength(params.stepCount, variant.walklinePath.length);
  const walkline = enforceLinearRise(variant.walklinePath, params);
  const treads = buildSketchTreads(walkline, params.width);
  const risers = buildSketchRisers(walkline, params.width);
  const stringers = buildStringersFromWalkline(walkline, params.width);
  const arrow = arrowSymbol(walkline[0], walkline[walkline.length - 1], params.upDirection);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(treads, cutPlaneHeight);
  const cutLine = buildSketchCutLine(walkline, params.width, cutPlaneHeight);
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

// ─── SKETCH private helpers ───────────────────────────────────────────────────

function assertWalklineLength(stepCount: number, pathLength: number): void {
  if (pathLength !== stepCount + 1) {
    throw new Error(
      `StairGeometryService: sketch walklinePath length must equal stepCount+1 ` +
        `(got walklinePath.length=${pathLength}, stepCount+1=${stepCount + 1})`,
    );
  }
}

function enforceLinearRise(
  walklinePath: readonly Point3D[],
  params: Readonly<StairParams>,
): Polyline3D {
  const out: Point3D[] = new Array(walklinePath.length);
  for (let i = 0; i < walklinePath.length; i++) {
    out[i] = point(
      walklinePath[i].x,
      walklinePath[i].y,
      params.basePoint.z + params.rise * i,
    );
  }
  return out;
}

function chordTangent(a: Readonly<Point3D>, b: Readonly<Point3D>): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

function buildSketchTreads(
  walkline: readonly Point3D[],
  width: number,
): readonly Polygon3D[] {
  const halfW = width * 0.5;
  const stepCount = walkline.length - 1;
  const treads: Polygon3D[] = new Array(stepCount);
  for (let i = 0; i < stepCount; i++) {
    const n = perp(chordTangent(walkline[i], walkline[i + 1]));
    const z = walkline[i].z;
    const innerA = point(walkline[i].x - halfW * n.x, walkline[i].y - halfW * n.y, z);
    const outerA = point(walkline[i].x + halfW * n.x, walkline[i].y + halfW * n.y, z);
    const innerB = point(walkline[i + 1].x - halfW * n.x, walkline[i + 1].y - halfW * n.y, z);
    const outerB = point(walkline[i + 1].x + halfW * n.x, walkline[i + 1].y + halfW * n.y, z);
    treads[i] = [innerA, outerA, outerB, innerB];
  }
  return treads;
}

function buildSketchRisers(
  walkline: readonly Point3D[],
  width: number,
): readonly Segment3D[] {
  // ADR-370 Phase 5.3 — diagonal Segment3D (see StairGeometryService.buildStraightRisers).
  // Width axis = n (chord-perpendicular): start at −halfW edge, end at +halfW edge.
  const halfW = width * 0.5;
  const stepCount = walkline.length - 1;
  const risers: Segment3D[] = [];
  for (let i = 0; i < stepCount - 1; i++) {
    const n = perp(chordTangent(walkline[i + 1], walkline[i + 2]));
    const ix = walkline[i + 1].x - halfW * n.x;
    const iy = walkline[i + 1].y - halfW * n.y;
    const ox = walkline[i + 1].x + halfW * n.x;
    const oy = walkline[i + 1].y + halfW * n.y;
    risers.push({
      start: point(ix, iy, walkline[i].z),
      end: point(ox, oy, walkline[i + 1].z),
    });
  }
  return risers;
}

function buildSketchCutLine(
  walkline: readonly Point3D[],
  width: number,
  cutPlaneHeight: number,
): Segment3D | undefined {
  for (let i = 0; i < walkline.length - 1; i++) {
    if (walkline[i].z >= cutPlaneHeight) {
      const tangent = chordTangent(walkline[i], walkline[i + 1]);
      const mx = (walkline[i].x + walkline[i + 1].x) * 0.5;
      const my = (walkline[i].y + walkline[i + 1].y) * 0.5;
      const tread: Polygon3D = [
        point(mx, my, cutPlaneHeight),
        point(mx, my, cutPlaneHeight),
        point(mx, my, cutPlaneHeight),
        point(mx, my, cutPlaneHeight),
      ];
      return buildCutLine(tread, tangent, width, cutPlaneHeight);
    }
  }
  return undefined;
}
