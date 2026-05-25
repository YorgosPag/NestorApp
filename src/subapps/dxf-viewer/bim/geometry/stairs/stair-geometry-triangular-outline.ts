/**
 * Triangular-outline stair geometry — ADR-358 Phase 4c.
 *
 * Wedge-shaped stair that fills a triangular footprint (e.g. corner room).
 * Entry side = `variant.triangleVertices[variant.entrySide]` →
 * `variant.triangleVertices[(variant.entrySide+1)%3]`. Opposite vertex (apex)
 * sits at `variant.triangleVertices[(variant.entrySide+2)%3]`. Treads are
 * equal-height linear slices PARALLEL to the entry edge, ascending toward
 * the opposite vertex. The final tread degenerates to a triangle at the apex.
 *
 * Conventions:
 *   - Plan view: +X right, +Y up. `orientation='ccw'` ⇒ CCW polygon winding,
 *     `'cw'` ⇒ reversed winding.
 *   - Tread polygon at z = i·rise (i = 0..stepCount-1) — vertices co-planar.
 *     Vertex order:
 *       ccw: [low_a, low_b, high_b, high_a]
 *       cw : [low_a, high_a, high_b, low_b]
 *     where low_a/low_b are on the entry-side slice (at t_i = i/N), high_a/high_b
 *     on the apex-side slice (at t_{i+1} = (i+1)/N). For i = stepCount-1 the
 *     two high corners both collapse onto the opposite vertex.
 *   - Walkline = midpoint polyline from entry-edge midpoint to opposite vertex
 *     (stepCount + 1 vertices), z linear i·rise.
 *   - Stringers via Phase 2b `offsetPolyline` (shared `buildStringersFromWalkline`).
 *   - Risers vertical at the apex-side corner of slice i+1 (taken at low_a of
 *     the next tread, i.e. corner on the V_a-V_c edge).
 *   - cutLine perpendicular to walkline at first tread crossing the cut plane.
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
  StairVariantTriangularOutline,
} from '../../../bim/types/stair-types';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  point,
  arrowSymbol,
  bboxOfPolygons,
  splitTreadsByCutPlane,
  buildCutLine,
  buildStringersFromWalkline,
  buildHandrailsFromParams,
} from './stair-geometry-shared';
import { buildTreadLabels } from './stair-geometry-labels';

interface OutlineLayout {
  readonly Va: Readonly<Point3D>;
  readonly Vb: Readonly<Point3D>;
  readonly Vc: Readonly<Point3D>;
  readonly sign: 1 | -1;
  readonly entryMid: { readonly x: number; readonly y: number };
  readonly axis: Vec2;
}

function buildOutlineLayout(variant: StairVariantTriangularOutline): OutlineLayout {
  const [v0, v1, v2] = variant.triangleVertices;
  const verts: readonly Point3D[] = [v0, v1, v2];
  const Va = verts[variant.entrySide];
  const Vb = verts[(variant.entrySide + 1) % 3];
  const Vc = verts[(variant.entrySide + 2) % 3];
  const sign: 1 | -1 = variant.orientation === 'ccw' ? 1 : -1;
  const entryMid = { x: (Va.x + Vb.x) * 0.5, y: (Va.y + Vb.y) * 0.5 };
  const dx = Vc.x - entryMid.x;
  const dy = Vc.y - entryMid.y;
  const len = Math.hypot(dx, dy);
  const axis: Vec2 = len < 1e-12 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
  return { Va, Vb, Vc, sign, entryMid, axis };
}

// ─── TRIANGULAR-OUTLINE entry ─────────────────────────────────────────────────

export function computeTriangularOutline(
  params: Readonly<StairParams>,
  variant: StairVariantTriangularOutline,
): StairGeometry {
  const layout = buildOutlineLayout(variant);
  const treads = buildOutlineTreads(params, layout);
  const walkline = buildOutlineWalkline(params, layout);
  const risers = buildOutlineRisers(params, layout);
  const stringers = buildStringersFromWalkline(walkline, params.width);
  const arrow = arrowSymbol(walkline[0], walkline[walkline.length - 1], params.upDirection);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(treads, cutPlaneHeight);
  const cutLine = buildOutlineCutLine(treads, layout, params.width, cutPlaneHeight);
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

// ─── TRIANGULAR-OUTLINE private helpers ───────────────────────────────────────

function sliceCorners(
  layout: OutlineLayout,
  t: number,
): { readonly a: { x: number; y: number }; readonly b: { x: number; y: number } } {
  const { Va, Vb, Vc } = layout;
  return {
    a: { x: Va.x + t * (Vc.x - Va.x), y: Va.y + t * (Vc.y - Va.y) },
    b: { x: Vb.x + t * (Vc.x - Vb.x), y: Vb.y + t * (Vc.y - Vb.y) },
  };
}

function buildOutlineTreads(
  params: Readonly<StairParams>,
  layout: OutlineLayout,
): readonly Polygon3D[] {
  const { stepCount, rise, basePoint } = params;
  const treads: Polygon3D[] = new Array(stepCount);
  for (let i = 0; i < stepCount; i++) {
    const t0 = i / stepCount;
    const t1 = (i + 1) / stepCount;
    const low = sliceCorners(layout, t0);
    const high = sliceCorners(layout, t1);
    const z = basePoint.z + rise * i;
    const lowA = point(low.a.x, low.a.y, z);
    const lowB = point(low.b.x, low.b.y, z);
    const highA = point(high.a.x, high.a.y, z);
    const highB = point(high.b.x, high.b.y, z);
    treads[i] = layout.sign === 1
      ? [lowA, lowB, highB, highA]
      : [lowA, highA, highB, lowB];
  }
  return treads;
}

function buildOutlineWalkline(
  params: Readonly<StairParams>,
  layout: OutlineLayout,
): Polyline3D {
  const { stepCount, rise, basePoint } = params;
  const { entryMid, Vc } = layout;
  const out: Point3D[] = new Array(stepCount + 1);
  for (let i = 0; i <= stepCount; i++) {
    const t = i / stepCount;
    out[i] = point(
      entryMid.x + t * (Vc.x - entryMid.x),
      entryMid.y + t * (Vc.y - entryMid.y),
      basePoint.z + rise * i,
    );
  }
  return out;
}

function buildOutlineRisers(
  params: Readonly<StairParams>,
  layout: OutlineLayout,
): readonly Segment3D[] {
  const { stepCount, rise, basePoint } = params;
  const risers: Segment3D[] = [];
  for (let i = 0; i < stepCount - 1; i++) {
    const t = (i + 1) / stepCount;
    const slice = sliceCorners(layout, t);
    const zLow = basePoint.z + rise * i;
    const zHigh = basePoint.z + rise * (i + 1);
    risers.push({
      start: point(slice.a.x, slice.a.y, zLow),
      end: point(slice.a.x, slice.a.y, zHigh),
    });
  }
  return risers;
}

function buildOutlineCutLine(
  treads: readonly Polygon3D[],
  layout: OutlineLayout,
  width: number,
  cutPlaneHeight: number,
): Segment3D | undefined {
  for (let i = 0; i < treads.length; i++) {
    const z = treads[i][0]?.z ?? 0;
    if (z >= cutPlaneHeight) {
      return buildCutLine(treads[i], layout.axis, width, cutPlaneHeight);
    }
  }
  return undefined;
}
