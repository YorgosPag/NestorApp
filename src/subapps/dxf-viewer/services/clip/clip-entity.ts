/**
 * clip-entity — SSoT per-entity crop clipping, region-agnostic.
 *
 * Κάθε τύπος οντότητας κόβεται ΜΙΑ φορά ενάντια στο `ClipRegion` interface· ο ορθογώνιος
 * και ο πολυγωνικός/λάσσο τρόπος περνούν διαφορετική strategy (`clip-region.ts`). Πριν,
 * αυτή η per-type λογική ήταν διπλασιασμένη (byte-parallel) σε `ClipToRegionService` ΚΑΙ
 * `ClipToPolygonService` (~10 clippers έκαστο).
 *
 * Algorithms:
 *  Lines            → region.clipSegment (0/1 for rect, N for concave polygon)
 *  Closed polylines → region.clipLoop (Sutherland-Hodgman)
 *  Open polylines   → per-segment region.clipSegment, chain rebuild
 *  Circle/Arc/Ellipse → 72-step boundary sampling + region.containsPoint
 *  Rectangles       → region.clipLoop of the 4 corners → axis-aligned bbox
 *  Text/MText       → character-level clip (keeps only fully-inside chars)
 *  Points           → region.containsPoint
 *  Splines          → control-point bbox overlap (conservative)
 *  AngleMeasurement → vertex inside + arms clipped to the boundary
 *  Hatch            → per-loop region.clipLoop (outer + islands); outer gone → dropped
 *  BIM structural + block/dimension/leader → all-or-nothing bbox cull
 *  xline/ray        → kept unchanged (infinite construction lines)
 */

import type {
  Entity, LineEntity, CircleEntity, ArcEntity,
  PolylineEntity, LWPolylineEntity, RectangleEntity, RectEntity,
  TextEntity, MTextEntity, AngleMeasurementEntity,
  EllipseEntity, PointEntity, SplineEntity, HatchEntity,
} from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
import type { ClipRegion } from './clip-region';
import { DEG, normAngle, arcSweepDeg, ptEq, boundsOfPoints } from './clip-geometry';
import { clipHatchLoops, bboxCullEntity } from './clip-entity-helpers';

function clipLine(e: LineEntity, region: ClipRegion): Entity[] {
  return region.clipSegment(e.start, e.end)
    .map(([a, b]) => ({ ...e, start: a, end: b }) as Entity);
}

function clipPolyline(e: PolylineEntity | LWPolylineEntity, region: ClipRegion): Entity[] {
  if (e.closed) {
    const clipped = region.clipLoop(e.vertices);
    return clipped.length >= 2 ? [{ ...e, vertices: clipped } as Entity] : [];
  }
  // Open polyline — clip each segment, rebuild connected chains.
  const chains: Point2D[][] = [];
  let current: Point2D[] = [];
  for (let i = 0; i < e.vertices.length - 1; i++) {
    const segs = region.clipSegment(e.vertices[i], e.vertices[i + 1]);
    if (segs.length === 0) {
      if (current.length > 0) { chains.push(current); current = []; }
      continue;
    }
    for (const [pA, pB] of segs) {
      if (current.length === 0) {
        current.push(pA);
      } else if (!ptEq(current[current.length - 1], pA)) {
        chains.push(current);
        current = [pA];
      }
      current.push(pB);
    }
  }
  if (current.length > 1) chains.push(current);
  return chains.map((verts) => ({ ...e, vertices: verts, closed: false }) as Entity);
}

// Sample a circular/elliptical boundary; return the parameter-ranges whose points are
// inside the region. `pointAt(u)` maps a sample parameter to a world point.
function insideRuns(
  count: number,
  paramAt: (i: number) => number,
  pointAt: (u: number) => Point2D,
  region: ClipRegion,
): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let segStart: number | null = null;
  let last = paramAt(0);
  for (let i = 0; i <= count; i++) {
    const u = paramAt(i);
    const inside = region.containsPoint(pointAt(u));
    if (inside && segStart === null) segStart = u;
    else if (!inside && segStart !== null) { runs.push([segStart, last]); segStart = null; }
    last = u;
  }
  if (segStart !== null) runs.push([segStart, last]);
  return runs;
}

function clipCircle(e: CircleEntity, region: ClipRegion): Entity[] {
  const { center, radius } = e;
  const STEPS = 72;
  const pointAt = (deg: number): Point2D => ({ x: center.x + radius * Math.cos(deg * DEG), y: center.y + radius * Math.sin(deg * DEG) });
  const runs = insideRuns(STEPS, (i) => (i / STEPS) * 360, pointAt, region);
  // Whole circle inside → keep it as a circle (not degraded to a full-sweep arc).
  if (runs.length === 1 && runs[0][0] === 0 && runs[0][1] >= 360 - 1e-6) return [e];
  return runs.map(([startAngle, endAngle]) =>
    ({ id: e.id, type: 'arc', layerId: e.layerId, color: e.color, visible: e.visible, center, radius, startAngle, endAngle, counterclockwise: true }) as ArcEntity);
}

function clipArc(e: ArcEntity, region: ClipRegion): Entity[] {
  const s = normAngle(e.startAngle);
  const ccw = e.counterclockwise !== true;
  const sweep = arcSweepDeg(s, normAngle(e.endAngle), ccw);
  const STEPS = 72;
  const pointAt = (deg: number): Point2D => ({ x: e.center.x + e.radius * Math.cos(deg * DEG), y: e.center.y + e.radius * Math.sin(deg * DEG) });
  const runs = insideRuns(STEPS, (i) => normAngle(ccw ? s + sweep * (i / STEPS) : s - sweep * (i / STEPS)), pointAt, region);
  return runs.map(([startAngle, endAngle]) => ({ ...e, startAngle, endAngle } as Entity));
}

function clipEllipse(e: EllipseEntity, region: ClipRegion): Entity[] {
  const { center, majorAxis, minorAxis } = e;
  const rotation = (e.rotation ?? 0) * DEG;
  const startP = e.startParam ?? 0;
  const rawEnd = e.endParam ?? (Math.PI * 2);
  const sweep = rawEnd > startP ? rawEnd - startP : rawEnd - startP + Math.PI * 2;
  const STEPS = 72;
  const pointAt = (t: number): Point2D => ({
    x: center.x + majorAxis * Math.cos(t) * Math.cos(rotation) - minorAxis * Math.sin(t) * Math.sin(rotation),
    y: center.y + majorAxis * Math.cos(t) * Math.sin(rotation) + minorAxis * Math.sin(t) * Math.cos(rotation),
  });
  const runs = insideRuns(STEPS, (i) => startP + sweep * (i / STEPS), pointAt, region);
  return runs.map(([startParam, endParam]) => ({ ...e, startParam, endParam } as Entity));
}

function clipRectangleBox(e: RectangleEntity | RectEntity, region: ClipRegion): Entity[] {
  const c1 = (e as RectangleEntity).corner1 ?? { x: e.x, y: e.y };
  const c2 = (e as RectangleEntity).corner2 ?? { x: e.x + e.width, y: e.y + e.height };
  const verts: Point2D[] = [
    { x: Math.min(c1.x, c2.x), y: Math.min(c1.y, c2.y) },
    { x: Math.max(c1.x, c2.x), y: Math.min(c1.y, c2.y) },
    { x: Math.max(c1.x, c2.x), y: Math.max(c1.y, c2.y) },
    { x: Math.min(c1.x, c2.x), y: Math.max(c1.y, c2.y) },
  ];
  const clipped = region.clipLoop(verts);
  if (clipped.length < 3) return [];
  const b = boundsOfPoints(clipped);
  // Rebuild an axis-aligned rectangle from the clipped bounds (RectangleRenderer uses corner1/2).
  return [{ ...e, x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY,
    corner1: { x: b.minX, y: b.minY }, corner2: { x: b.maxX, y: b.maxY } } as Entity];
}

function clipText(e: TextEntity | MTextEntity, region: ClipRegion): Entity[] {
  const textNode = e.textNode;
  const plainText = textNode
    ? textNode.paragraphs.flatMap((p) => p.runs).map((run) => ('top' in run ? '' : run.text)).join('')
    : (e.text ?? '');
  if (!plainText) return region.containsPoint(e.position) ? [e] : [];

  // charH mirrors resolveTextHeight() (ADR-344 Phase 6.E).
  let charH: number;
  if (textNode) {
    const run0 = textNode.paragraphs[0]?.runs[0];
    const runH = (run0 && !('top' in run0)) ? (run0.style.height ?? 0) : 0;
    charH = runH > 0 ? runH : TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE;
  } else {
    charH = (e.height && e.height > 0 ? e.height : 0) || (e.fontSize && e.fontSize > 0 ? e.fontSize : 0) || 2.5;
  }
  const charW = charH * 0.6;
  const chars = [...plainText];
  if (chars.length === 0) return [];

  const align = e.alignment ?? 'left';
  const totalW = chars.length * charW;
  const localStart = align === 'center' ? -totalW / 2 : align === 'right' ? -totalW : 0;
  const rotRad = ((e.rotation ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad), sinR = Math.sin(rotRad);
  const px = e.position.x, py = e.position.y;
  const toWorld = (lx: number, ly: number): Point2D => ({ x: px + lx * cosR - ly * sinR, y: py + lx * sinR + ly * cosR });

  // textBaseline='top': entity position is the top, text descends to local y = -charH.
  const charFullyInside = (i: number): boolean =>
    [toWorld(localStart + i * charW, 0), toWorld(localStart + (i + 1) * charW, 0),
     toWorld(localStart + (i + 1) * charW, -charH), toWorld(localStart + i * charW, -charH)]
      .every((p) => region.containsPoint(p));

  const keptIndices = chars.map((_, i) => i).filter(charFullyInside);
  if (keptIndices.length === 0) return [];
  const keptText = keptIndices.map((i) => chars[i]).join('');
  const newPos = toWorld(localStart + keptIndices[0] * charW, 0);

  if (textNode) {
    const paras = textNode.paragraphs;
    if (paras.length === 1 && paras[0].runs.length === 1 && !('top' in paras[0].runs[0])) {
      const newTextNode = { ...textNode, paragraphs: [{ ...paras[0], runs: [{ ...paras[0].runs[0], text: keptText }] }] };
      return [{ ...e, position: newPos, textNode: newTextNode } as Entity];
    }
    return [{ ...e, position: newPos } as Entity]; // multi-run mtext: move insertion point only
  }
  return [{ ...e, text: keptText, position: newPos, alignment: 'left' } as Entity];
}

function clipPoint(e: PointEntity, region: ClipRegion): Entity[] {
  return region.containsPoint(e.position) ? [e] : [];
}

function clipSpline(e: SplineEntity, region: ClipRegion): Entity[] {
  if (!e.controlPoints || e.controlPoints.length === 0) return [e];
  return region.bboxOverlaps(boundsOfPoints(e.controlPoints)) ? [e] : [];
}

function clipAngleMeasurement(e: AngleMeasurementEntity, region: ClipRegion): Entity[] {
  // Junction (vertex) outside → discard entire measurement.
  if (!region.containsPoint(e.vertex)) return [];
  // Vertex inside → the sub-segment starting at the vertex is arm[0]; clip both arms.
  const arm1 = region.clipSegment(e.vertex, e.point1);
  const arm2 = region.clipSegment(e.vertex, e.point2);
  if (arm1.length === 0 || arm2.length === 0) return [];
  return [{ ...e, point1: arm1[0][1], point2: arm2[0][1] } as Entity];
}

function clipHatch(e: HatchEntity, region: ClipRegion): Entity[] {
  return clipHatchLoops(e, (loop) => region.clipLoop(loop))
    ?? bboxCullEntity(e, (b) => region.bboxOverlaps(b));
}

/** Clip a single entity to the region. Returns 0..N replacement entities. */
export function clipEntity(entity: Entity, region: ClipRegion): Entity[] {
  switch (entity.type) {
    case 'line': return clipLine(entity as LineEntity, region);
    case 'circle': return clipCircle(entity as CircleEntity, region);
    case 'arc': return clipArc(entity as ArcEntity, region);
    case 'polyline': return clipPolyline(entity as PolylineEntity, region);
    case 'lwpolyline': return clipPolyline(entity as LWPolylineEntity, region);
    case 'ellipse': return clipEllipse(entity as EllipseEntity, region);
    case 'rectangle': return clipRectangleBox(entity as RectangleEntity, region);
    case 'rect': return clipRectangleBox(entity as RectEntity, region);
    case 'text': return clipText(entity as TextEntity, region);
    case 'mtext': return clipText(entity as MTextEntity, region);
    case 'point': return clipPoint(entity as PointEntity, region);
    case 'spline': return clipSpline(entity as SplineEntity, region);
    case 'angle-measurement': return clipAngleMeasurement(entity as AngleMeasurementEntity, region);
    case 'hatch': return clipHatch(entity as HatchEntity, region);
    // Infinite construction lines — big players keep them on crop (never culled).
    case 'xline':
    case 'ray': return [entity];
    // BIM structural (wall/column/beam/slab/foundation/…) + block/dimension/leader.
    default: return bboxCullEntity(entity, (b) => region.bboxOverlaps(b));
  }
}

/** Clip an overlay/lasso polygon loop to the region (world-space Array<[x,y]>).
 *  null = fully outside (delete); same ref = fully inside (skip); else clipped. */
export function clipRegionLoop(
  polygon: Array<[number, number]>,
  region: ClipRegion,
): Array<[number, number]> | null {
  if (polygon.length === 0) return null;
  if (!region.bboxOverlaps(boundsOfPoints(polygon))) return null;
  const pts: Point2D[] = polygon.map(([x, y]) => ({ x, y }));
  if (pts.every((p) => region.containsPoint(p))) return polygon; // fully inside → same ref
  const clipped = region.clipLoop(pts);
  if (clipped.length < 3) return null;
  return clipped.map((p) => [p.x, p.y] as [number, number]);
}
