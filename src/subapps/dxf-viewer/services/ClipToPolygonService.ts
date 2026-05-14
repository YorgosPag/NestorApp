/**
 * ClipToPolygonService — clips a DXF scene to a freehand polygon (lasso) region.
 *
 * Algorithms used per entity type:
 *   Lines             → parametric segment-polygon intersection (exact, any polygon shape)
 *   Open polylines    → per-segment parametric clip, chain rebuild (exact)
 *   Closed polylines  → Sutherland-Hodgman generalised (exact for convex lasso)
 *   Circles/Arcs      → 72-step sampling + point-in-polygon
 *   Ellipses          → 72-step parametric sampling + point-in-polygon
 *   Rectangles        → Sutherland-Hodgman generalised (same as closed polyline)
 *   Text/MText/Points → point-in-polygon on anchor position
 *   Splines           → control-point bbox inside test (conservative)
 *   AngleMeasurement  → vertex must be inside polygon
 *   hatch/block/…     → kept unchanged (conservative)
 *
 * NOTE: Sutherland-Hodgman is exact for convex clip polygons. For concave
 * lasso regions the algorithm produces an over-inclusive approximation —
 * some entities on the concave-inward side may be retained. Acceptable for v1.
 */

import type {
  Entity, LineEntity, CircleEntity, ArcEntity,
  PolylineEntity, LWPolylineEntity, RectangleEntity, RectEntity,
  TextEntity, MTextEntity, AngleMeasurementEntity,
  EllipseEntity, PointEntity, SplineEntity,
} from '../types/entities';
import type { Point2D } from '../rendering/types/Types';
import { TEXT_SIZE_LIMITS } from '../config/text-rendering-config';

const DEG = Math.PI / 180;

// ── Polygon geometry helpers ──────────────────────────────────────────────────

/** Ray-casting point-in-polygon. Works for convex AND concave polygons. */
function pointInPolygon(p: Point2D, poly: Array<[number, number]>): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Generalised Sutherland-Hodgman polygon clip.
 * Subject = polygon to clip; clip = clip boundary polygon.
 * Exact for convex clip polygon; approximate for concave.
 */
function sutherlandHodgmanGeneral(subject: Point2D[], clip: Array<[number, number]>): Point2D[] {
  if (subject.length === 0 || clip.length < 3) return [];
  let output = [...subject];
  const n = clip.length;

  for (let i = 0; i < n && output.length > 0; i++) {
    const [ax, ay] = clip[i];
    const [bx, by] = clip[(i + 1) % n];

    const inside = (p: Point2D) => (bx - ax) * (p.y - ay) - (by - ay) * (p.x - ax) >= 0;
    const intersect = (a: Point2D, b: Point2D): Point2D => {
      const dx1 = b.x - a.x, dy1 = b.y - a.y;
      const dx2 = bx - ax, dy2 = by - ay;
      const denom = dx1 * dy2 - dy1 * dx2;
      if (Math.abs(denom) < 1e-10) return a;
      const t = ((ax - a.x) * dy2 - (ay - a.y) * dx2) / denom;
      return { x: a.x + t * dx1, y: a.y + t * dy1 };
    };

    const input = output;
    output = [];
    for (let k = 0; k < input.length; k++) {
      const curr = input[k];
      const prev = input[(k + input.length - 1) % input.length];
      const currIn = inside(curr);
      const prevIn = inside(prev);
      if (currIn) {
        if (!prevIn) output.push(intersect(prev, curr));
        output.push(curr);
      } else if (prevIn) {
        output.push(intersect(prev, curr));
      }
    }
  }
  return output;
}

/**
 * Parametric segment-polygon clip.
 * Finds all t values where segment AB crosses polygon edges,
 * then keeps sub-segments whose midpoint passes point-in-polygon.
 * Correct for ANY polygon shape (convex OR concave).
 */
function clipSegmentByPolygon(
  ax: number, ay: number, bx: number, by: number,
  poly: Array<[number, number]>,
): Array<[number, number, number, number]> {
  const dx = bx - ax, dy = by - ay;
  const ts: number[] = [0, 1];
  const n = poly.length;

  for (let i = 0; i < n; i++) {
    const [cx, cy] = poly[i];
    const [ex, ey] = poly[(i + 1) % n];
    const ecx = ex - cx, ecy = ey - cy;
    const denom = dx * ecy - dy * ecx;
    if (Math.abs(denom) < 1e-10) continue;
    const t = ((cx - ax) * ecy - (cy - ay) * ecx) / denom;
    if (t <= 0 || t >= 1) continue;
    const s = ((cx - ax) * dy - (cy - ay) * dx) / denom;
    if (s >= 0 && s <= 1) ts.push(t);
  }

  ts.sort((a, b) => a - b);
  const result: Array<[number, number, number, number]> = [];

  for (let i = 0; i < ts.length - 1; i++) {
    const t0 = ts[i], t1 = ts[i + 1];
    if (t1 - t0 < 1e-10) continue;
    const mid: Point2D = { x: ax + ((t0 + t1) / 2) * dx, y: ay + ((t0 + t1) / 2) * dy };
    if (pointInPolygon(mid, poly)) {
      result.push([ax + t0 * dx, ay + t0 * dy, ax + t1 * dx, ay + t1 * dy]);
    }
  }
  return result;
}

function normAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function arcSweepDeg(s: number, e: number, ccw: boolean): number {
  if (ccw) return e >= s ? e - s : 360 - s + e;
  return s >= e ? s - e : 360 - e + s;
}

// ── Per-entity clip functions ─────────────────────────────────────────────────

function clipLineByPoly(e: LineEntity, poly: Array<[number, number]>): Entity[] {
  const segs = clipSegmentByPolygon(e.start.x, e.start.y, e.end.x, e.end.y, poly);
  return segs.map(([x1, y1, x2, y2]) =>
    ({ ...e, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }) as Entity,
  );
}

function clipCircleByPoly(e: CircleEntity, poly: Array<[number, number]>): Entity[] {
  const { center, radius } = e;
  const STEPS = 72;
  const arcs: Entity[] = [];
  let segStart: number | null = null;
  let lastDeg = 0;
  for (let i = 0; i <= STEPS; i++) {
    const deg = (i / STEPS) * 360;
    const pt: Point2D = { x: center.x + radius * Math.cos(deg * DEG), y: center.y + radius * Math.sin(deg * DEG) };
    const inside = pointInPolygon(pt, poly);
    if (inside && segStart === null) { segStart = deg; }
    else if (!inside && segStart !== null) {
      arcs.push({ id: e.id, type: 'arc', layer: e.layer, color: e.color, visible: e.visible, center, radius, startAngle: segStart, endAngle: lastDeg, counterclockwise: true } as ArcEntity);
      segStart = null;
    }
    lastDeg = deg;
  }
  if (segStart !== null) {
    arcs.push({ id: e.id, type: 'arc', layer: e.layer, color: e.color, visible: e.visible, center, radius, startAngle: segStart, endAngle: lastDeg, counterclockwise: true } as ArcEntity);
  }
  return arcs;
}

function clipArcByPoly<T extends { startAngle: number; endAngle: number; counterclockwise?: boolean; center: Point2D; radius: number }>(
  e: T, poly: Array<[number, number]>,
): T[] {
  const s = normAngle(e.startAngle);
  const ccw = e.counterclockwise !== true;
  const sweep = arcSweepDeg(s, normAngle(e.endAngle), ccw);
  const STEPS = 72;
  const result: T[] = [];
  let segStart: number | null = null;
  let lastDeg = s;
  for (let i = 0; i <= STEPS; i++) {
    const deg = normAngle(ccw ? s + sweep * (i / STEPS) : s - sweep * (i / STEPS));
    const pt: Point2D = { x: e.center.x + e.radius * Math.cos(deg * DEG), y: e.center.y + e.radius * Math.sin(deg * DEG) };
    const inside = pointInPolygon(pt, poly);
    if (inside && segStart === null) { segStart = deg; }
    else if (!inside && segStart !== null) {
      result.push({ ...e, startAngle: segStart, endAngle: lastDeg });
      segStart = null;
    }
    lastDeg = deg;
  }
  if (segStart !== null) result.push({ ...e, startAngle: segStart, endAngle: lastDeg });
  return result;
}

function clipPolylineByPoly(e: PolylineEntity | LWPolylineEntity, poly: Array<[number, number]>): Entity[] {
  if (e.closed) {
    const clipped = sutherlandHodgmanGeneral(e.vertices, poly);
    return clipped.length >= 2 ? [{ ...e, vertices: clipped } as Entity] : [];
  }
  const chains: Point2D[][] = [];
  let current: Point2D[] = [];
  for (let i = 0; i < e.vertices.length - 1; i++) {
    const a = e.vertices[i], b = e.vertices[i + 1];
    const segs = clipSegmentByPolygon(a.x, a.y, b.x, b.y, poly);
    for (const [x1, y1, x2, y2] of segs) {
      const pA: Point2D = { x: x1, y: y1 }, pB: Point2D = { x: x2, y: y2 };
      if (current.length === 0) {
        current.push(pA);
      } else if (Math.abs(current[current.length - 1].x - pA.x) > 1e-9 || Math.abs(current[current.length - 1].y - pA.y) > 1e-9) {
        chains.push(current);
        current = [pA];
      }
      current.push(pB);
    }
    if (segs.length === 0 && current.length > 1) { chains.push(current); current = []; }
  }
  if (current.length > 1) chains.push(current);
  return chains.map(verts => ({ ...e, vertices: verts, closed: false }) as Entity);
}

function clipRectByPoly(e: RectangleEntity | RectEntity, poly: Array<[number, number]>): Entity[] {
  const c1 = (e as RectangleEntity).corner1 ?? { x: e.x, y: e.y };
  const c2 = (e as RectangleEntity).corner2 ?? { x: e.x + e.width, y: e.y + e.height };
  const verts: Point2D[] = [c1, { x: c2.x, y: c1.y }, c2, { x: c1.x, y: c2.y }];
  const clipped = sutherlandHodgmanGeneral(verts, poly);
  if (clipped.length < 3) return [];
  const xs = clipped.map(p => p.x), ys = clipped.map(p => p.y);
  const x1 = Math.min(...xs), y1 = Math.min(...ys);
  const x2 = Math.max(...xs), y2 = Math.max(...ys);
  return [{ ...e, x: x1, y: y1, width: x2 - x1, height: y2 - y1, corner1: { x: x1, y: y1 }, corner2: { x: x2, y: y2 } } as Entity];
}

function clipTextByPoly(e: TextEntity, poly: Array<[number, number]>): Entity[] {
  const plainText = e.textNode
    ? e.textNode.paragraphs.flatMap(p => p.runs).map(r => ('top' in r ? '' : r.text)).join('')
    : (e.text ?? '');
  if (!plainText) return pointInPolygon(e.position, poly) ? [e] : [];

  let charH: number;
  if (e.textNode) {
    const run0 = e.textNode.paragraphs[0]?.runs[0];
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

  const toWorld = (lx: number, ly: number): Point2D => ({
    x: px + lx * cosR - ly * sinR, y: py + lx * sinR + ly * cosR,
  });
  const charFullyInside = (i: number): boolean =>
    [toWorld(localStart + i * charW, 0), toWorld(localStart + (i + 1) * charW, 0),
     toWorld(localStart + (i + 1) * charW, -charH), toWorld(localStart + i * charW, -charH)]
    .every(p => pointInPolygon(p, poly));

  const kept = chars.map((_, i) => i).filter(charFullyInside);
  if (kept.length === 0) return [];
  const keptText = kept.map(i => chars[i]).join('');
  const newPos = toWorld(localStart + kept[0] * charW, 0);

  if (e.textNode) {
    const paras = e.textNode.paragraphs;
    if (paras.length === 1 && paras[0].runs.length === 1 && !('top' in paras[0].runs[0])) {
      const newTextNode = { ...e.textNode, paragraphs: [{ ...paras[0], runs: [{ ...paras[0].runs[0], text: keptText }] }] };
      return [{ ...e, position: newPos, textNode: newTextNode } as Entity];
    }
    return [{ ...e, position: newPos } as Entity];
  }
  return [{ ...e, text: keptText, position: newPos, alignment: 'left' } as Entity];
}

function clipEllipseByPoly(e: EllipseEntity, poly: Array<[number, number]>): Entity[] {
  const { center, majorAxis, minorAxis } = e;
  const rotation = (e.rotation ?? 0) * DEG;
  const startP = e.startParam ?? 0;
  const rawEnd = e.endParam ?? (Math.PI * 2);
  const sweep = rawEnd > startP ? rawEnd - startP : rawEnd - startP + Math.PI * 2;
  const STEPS = 72;
  const result: Entity[] = [];
  let segStart: number | null = null;
  let prevT = startP;
  for (let i = 0; i <= STEPS; i++) {
    const t = startP + sweep * (i / STEPS);
    const pt: Point2D = {
      x: center.x + majorAxis * Math.cos(t) * Math.cos(rotation) - minorAxis * Math.sin(t) * Math.sin(rotation),
      y: center.y + majorAxis * Math.cos(t) * Math.sin(rotation) + minorAxis * Math.sin(t) * Math.cos(rotation),
    };
    const inside = pointInPolygon(pt, poly);
    if (inside && segStart === null) { segStart = t; }
    else if (!inside && segStart !== null) {
      result.push({ ...e, startParam: segStart, endParam: prevT } as Entity);
      segStart = null;
    }
    prevT = t;
  }
  if (segStart !== null) result.push({ ...e, startParam: segStart, endParam: prevT } as Entity);
  return result;
}

function clipEntityByPoly(entity: Entity, poly: Array<[number, number]>): Entity[] {
  switch (entity.type) {
    case 'line': return clipLineByPoly(entity as LineEntity, poly);
    case 'circle': return clipCircleByPoly(entity as CircleEntity, poly);
    case 'arc': return clipArcByPoly(entity as ArcEntity, poly);
    case 'polyline': return clipPolylineByPoly(entity as PolylineEntity, poly);
    case 'lwpolyline': return clipPolylineByPoly(entity as LWPolylineEntity, poly);
    case 'ellipse': return clipEllipseByPoly(entity as EllipseEntity, poly);
    case 'rectangle': return clipRectByPoly(entity as RectangleEntity, poly);
    case 'rect': return clipRectByPoly(entity as RectEntity, poly);
    case 'text': return clipTextByPoly(entity as TextEntity, poly);
    case 'mtext': return pointInPolygon((entity as MTextEntity).position, poly) ? [entity] : [];
    case 'point': return pointInPolygon((entity as PointEntity).position, poly) ? [entity] : [];
    case 'spline': {
      const s = entity as SplineEntity;
      if (!s.controlPoints || s.controlPoints.length === 0) return [entity];
      return s.controlPoints.some(p => pointInPolygon(p, poly)) ? [entity] : [];
    }
    case 'angle-measurement': {
      const m = entity as AngleMeasurementEntity;
      return pointInPolygon(m.vertex, poly) ? [entity] : [];
    }
    default: return [entity];
  }
}

// ── Service class ─────────────────────────────────────────────────────────────

export class ClipToPolygonService {
  clipByPolygon<T extends { entities: Entity[] }>(scene: T, polygon: Array<[number, number]>): T {
    const clipped: Entity[] = [];
    for (const entity of scene.entities) {
      clipped.push(...clipEntityByPoly(entity, polygon));
    }
    return { ...scene, entities: clipped };
  }

  /**
   * Clip an overlay polygon (world-space Array<[x,y]>) to the lasso polygon.
   * Returns null if fully outside. Returns same array if fully inside.
   * Otherwise returns S-H clipped polygon (approximate for concave lasso).
   */
  clipOverlayPolygonByLasso(
    polygon: Array<[number, number]>,
    lasso: Array<[number, number]>,
  ): Array<[number, number]> | null {
    if (polygon.length === 0 || lasso.length < 3) return null;

    const subject: Point2D[] = polygon.map(([x, y]) => ({ x, y }));
    const allInside = subject.every(p => pointInPolygon(p, lasso));
    if (allInside) return polygon;

    const clipped = sutherlandHodgmanGeneral(subject, lasso);
    if (clipped.length < 3) return null;
    return clipped.map(p => [p.x, p.y] as [number, number]);
  }
}
