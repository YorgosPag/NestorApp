/**
 * Elliptical helical stair geometry — ADR-358 Phase 4b.
 *
 * Walkline sits ON the (rotated, translated) ellipse perimeter, sampled by
 * arc-length via Phase 2b `ellipseSample`. Treads extend ±`width/2` to either
 * side of the walkline along the local chord-perpendicular — industry-standard
 * approach for stair on curved walkline (Revit/ArchiCAD/Vectorworks). The local
 * offset is NOT a true ellipse offset (which is non-elliptical and would require
 * Clipper-class machinery); for stair widths small vs. semi-axes the error is
 * imperceptible and matches Phase 2b `offsetPolyline` convention used by every
 * other curved kind.
 *
 * Conventions (shared with Phase 4a):
 *   - Plan view: +X right, +Y up. `turnDirection='ccw'` ⇒ sign = +1, `'cw'` ⇒ -1.
 *   - Tread polygon at z = i·rise (i = 0..stepCount-1), co-planar.
 *     Wedge vertex order:
 *       sign=+1: inner_i → outer_i → outer_next → inner_next
 *       sign=-1: inner_next → outer_next → outer_i → inner_i
 *   - Risers vertical at the inner corner of the angular boundary i+1.
 *   - Stringers via Phase 2b `offsetPolyline` (shared `buildStringersFromWalkline`).
 *   - cutLine emitted at first tread crossing `cutPlaneHeight`, tangent ≈ chord.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type { Point3D } from '../../../rendering/types/Types';
import { ellipseSample } from '../../../rendering/entities/shared/geometry-curve-utils';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantElliptical,
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
} from './stair-geometry-shared';
import { buildTreadLabels } from './stair-geometry-labels';

// ─── ELLIPTICAL entry ─────────────────────────────────────────────────────────

export function computeElliptical(
  params: Readonly<StairParams>,
  variant: StairVariantElliptical,
): StairGeometry {
  const sign: 1 | -1 = variant.turnDirection === 'ccw' ? 1 : -1;
  const walkline = ellipseSample(
    variant.centerPoint,
    variant.semiMajor,
    variant.semiMinor,
    variant.sweepAngle,
    variant.turnDirection,
    variant.rotation,
    params.stepCount,
    params.rise * params.stepCount,
  );
  const treads = buildEllipticalTreads(walkline, params.width, sign);
  const risers = buildEllipticalRisers(walkline, params.width, sign);
  const stringers = buildStringersFromWalkline(walkline, params.width);
  const arrow = arrowSymbol(walkline[0], walkline[walkline.length - 1], params.upDirection);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(treads, cutPlaneHeight);
  const cutLine = buildEllipticalCutLine(walkline, params.width, cutPlaneHeight);
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

// ─── ELLIPTICAL private helpers ───────────────────────────────────────────────

function chordTangent(a: Readonly<Point3D>, b: Readonly<Point3D>): Vec2 {
  return normalize2D(b.x - a.x, b.y - a.y);
}

function normalize2D(dx: number, dy: number): Vec2 {
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

function buildEllipticalTreads(
  walkline: readonly Point3D[],
  width: number,
  sign: 1 | -1,
): readonly Polygon3D[] {
  const halfW = width * 0.5;
  const stepCount = walkline.length - 1;
  const treads: Polygon3D[] = new Array(stepCount);
  for (let i = 0; i < stepCount; i++) {
    const tangent = chordTangent(walkline[i], walkline[i + 1]);
    const n = perp(tangent);
    const z = walkline[i].z;
    const innerA = point(walkline[i].x - halfW * n.x, walkline[i].y - halfW * n.y, z);
    const outerA = point(walkline[i].x + halfW * n.x, walkline[i].y + halfW * n.y, z);
    const innerB = point(walkline[i + 1].x - halfW * n.x, walkline[i + 1].y - halfW * n.y, z);
    const outerB = point(walkline[i + 1].x + halfW * n.x, walkline[i + 1].y + halfW * n.y, z);
    treads[i] = sign === 1
      ? [innerA, outerA, outerB, innerB]
      : [innerB, outerB, outerA, innerA];
  }
  return treads;
}

function buildEllipticalRisers(
  walkline: readonly Point3D[],
  width: number,
  sign: 1 | -1,
): readonly Segment3D[] {
  const halfW = width * 0.5;
  const stepCount = walkline.length - 1;
  const risers: Segment3D[] = [];
  for (let i = 0; i < stepCount - 1; i++) {
    const tangentNext = chordTangent(walkline[i + 1], walkline[i + 2]);
    const nNext = perp(tangentNext);
    const innerSign = sign === 1 ? -1 : 1;
    const ix = walkline[i + 1].x + innerSign * halfW * nNext.x;
    const iy = walkline[i + 1].y + innerSign * halfW * nNext.y;
    risers.push({
      start: point(ix, iy, walkline[i].z),
      end: point(ix, iy, walkline[i + 1].z),
    });
  }
  return risers;
}

function buildEllipticalCutLine(
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

// Walkline type re-exported indirectly via StairGeometry.walkline.
export type { Polyline3D };
