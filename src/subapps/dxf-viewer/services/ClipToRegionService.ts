/**
 * ClipToRegionService — clips a DXF scene to a rectangular region.
 *
 * Algorithms used per entity type:
 *  Lines         → Liang-Barsky parametric clipping (exact)
 *  Closed polylines → Sutherland-Hodgman polygon clipping (exact)
 *  Open polylines   → per-segment Liang-Barsky, chain rebuild (exact)
 *  Circles/Arcs  → 72-step sampling along boundary + inside check
 *  Ellipses      → 72-step parametric sampling with rotation support
 *  Rectangles    → axis-aligned intersection of two boxes
 *  Text          → character-level clip (keeps only fully-inside chars; mid-char = discard)
 *  MText         → position-in-rect (keep or discard whole label)
 *  Points        → position-in-rect
 *  Splines       → control-point bounding box (conservative)
 *  AngleMeasurement → all three key points must be inside rect
 *  hatch/block/dimension/leader/xline/ray → kept unchanged (conservative)
 */

import type {
  Entity, LineEntity, CircleEntity, ArcEntity,
  PolylineEntity, LWPolylineEntity, RectangleEntity, RectEntity,
  TextEntity, MTextEntity, AngleMeasurementEntity,
  EllipseEntity, PointEntity, SplineEntity,
} from '../types/entities';
import type { Point2D } from '../rendering/types/Types';

export interface ClipRect {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

const DEG = Math.PI / 180;

function normAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function inRect(p: Point2D, r: ClipRect): boolean {
  return p.x >= r.xMin && p.x <= r.xMax && p.y >= r.yMin && p.y <= r.yMax;
}

function ptEq(a: Point2D, b: Point2D): boolean {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

// Liang-Barsky line clipping — returns [x1,y1,x2,y2] or null if fully outside
function liangBarsky(
  x1: number, y1: number, x2: number, y2: number,
  xMin: number, yMin: number, xMax: number, yMax: number,
): [number, number, number, number] | null {
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - xMin, xMax - x1, y1 - yMin, yMax - y1];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t0) t0 = t; }
      else { if (t < t1) t1 = t; }
    }
    if (t0 > t1) return null;
  }
  return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}

// Sutherland-Hodgman — clips a closed polygon against a rectangle
function sutherland(verts: Point2D[], rect: ClipRect): Point2D[] {
  const { xMin, yMin, xMax, yMax } = rect;
  type Plane = [(p: Point2D) => boolean, (a: Point2D, b: Point2D) => Point2D];
  const planes: Plane[] = [
    [(p) => p.x >= xMin, (a, b) => { const t = (xMin - a.x) / (b.x - a.x); return { x: xMin, y: a.y + t * (b.y - a.y) }; }],
    [(p) => p.x <= xMax, (a, b) => { const t = (xMax - a.x) / (b.x - a.x); return { x: xMax, y: a.y + t * (b.y - a.y) }; }],
    [(p) => p.y >= yMin, (a, b) => { const t = (yMin - a.y) / (b.y - a.y); return { x: a.x + t * (b.x - a.x), y: yMin }; }],
    [(p) => p.y <= yMax, (a, b) => { const t = (yMax - a.y) / (b.y - a.y); return { x: a.x + t * (b.x - a.x), y: yMax }; }],
  ];
  let output = [...verts];
  for (const [inside, intersect] of planes) {
    if (output.length === 0) return [];
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const curr = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(curr)) {
        if (!inside(prev)) output.push(intersect(prev, curr));
        output.push(curr);
      } else if (inside(prev)) {
        output.push(intersect(prev, curr));
      }
    }
  }
  return output;
}

// Open polyline clip — splits into chains via per-segment Liang-Barsky
function clipOpenPolyline(verts: Point2D[], r: ClipRect): Point2D[][] {
  const chains: Point2D[][] = [];
  let current: Point2D[] = [];
  for (let i = 0; i < verts.length - 1; i++) {
    const a = verts[i], b = verts[i + 1];
    const seg = liangBarsky(a.x, a.y, b.x, b.y, r.xMin, r.yMin, r.xMax, r.yMax);
    if (!seg) {
      if (current.length > 0) { chains.push(current); current = []; }
      continue;
    }
    const pA: Point2D = { x: seg[0], y: seg[1] };
    const pB: Point2D = { x: seg[2], y: seg[3] };
    if (current.length === 0) {
      current.push(pA);
    } else if (!ptEq(current[current.length - 1], pA)) {
      chains.push(current);
      current = [pA];
    }
    current.push(pB);
  }
  if (current.length > 1) chains.push(current);
  return chains;
}

// Arc sweep in degrees from start toward end in the arc's direction
function arcSweepDeg(s: number, e: number, ccw: boolean): number {
  if (ccw) return e >= s ? e - s : 360 - s + e;
  return s >= e ? s - e : 360 - e + s;
}

// Sample arc into inside segments and return sub-arc entities
function sampleArcSegments<T extends { startAngle: number; endAngle: number; counterclockwise?: boolean; center: Point2D; radius: number }>(
  e: T, r: ClipRect,
): T[] {
  const s = normAngle(e.startAngle);
  // arcFrom3Points() stores counterclockwise with INVERTED sense vs world convention:
  //   entity=false → visual CCW (renderer does !false=true=canvas-CCW)
  //   entity=true  → visual CW  (renderer does !true=false=canvas-CW)
  //   entity=undefined → DXF import, always visually CCW
  // Sampling must follow the VISUAL direction, so invert boolean flags:
  //   undefined !== true = true  → sample CCW ✓ (DXF)
  //   false     !== true = true  → sample CCW ✓ (drawn CCW)
  //   true      !== true = false → sample CW  ✓ (drawn CW)
  const ccw = e.counterclockwise !== true;
  const sweep = arcSweepDeg(s, normAngle(e.endAngle), ccw);
  const STEPS = 72;
  const result: T[] = [];
  let segStart: number | null = null;
  let lastDeg = s;
  for (let i = 0; i <= STEPS; i++) {
    const deg = normAngle(ccw ? s + sweep * (i / STEPS) : s - sweep * (i / STEPS));
    const inside = inRect({ x: e.center.x + e.radius * Math.cos(deg * DEG), y: e.center.y + e.radius * Math.sin(deg * DEG) }, r);
    if (inside && segStart === null) { segStart = deg; }
    else if (!inside && segStart !== null) {
      result.push({ ...e, startAngle: segStart, endAngle: lastDeg } as T);
      segStart = null;
    }
    lastDeg = deg;
  }
  if (segStart !== null) result.push({ ...e, startAngle: segStart, endAngle: lastDeg } as T);
  return result;
}

// Clip functions per entity type

function clipLine(e: LineEntity, r: ClipRect): Entity[] {
  const seg = liangBarsky(e.start.x, e.start.y, e.end.x, e.end.y, r.xMin, r.yMin, r.xMax, r.yMax);
  if (!seg) return [];
  return [{ ...e, start: { x: seg[0], y: seg[1] }, end: { x: seg[2], y: seg[3] } } as Entity];
}

function clipCircle(e: CircleEntity, r: ClipRect): Entity[] {
  const { center, radius } = e;
  if (center.x + radius < r.xMin || center.x - radius > r.xMax ||
      center.y + radius < r.yMin || center.y - radius > r.yMax) return [];
  if (center.x - radius >= r.xMin && center.x + radius <= r.xMax &&
      center.y - radius >= r.yMin && center.y + radius <= r.yMax) return [e];
  // Convert partially-inside circle to arc segments
  const STEPS = 72;
  const arcs: Entity[] = [];
  let segStart: number | null = null;
  let lastDeg = 0;
  for (let i = 0; i <= STEPS; i++) {
    const deg = (i / STEPS) * 360;
    const inside = inRect({ x: center.x + radius * Math.cos(deg * DEG), y: center.y + radius * Math.sin(deg * DEG) }, r);
    if (inside && segStart === null) { segStart = deg; }
    else if (!inside && segStart !== null) {
      arcs.push({ id: e.id, type: 'arc', layer: e.layer, color: e.color, visible: e.visible, center, radius, startAngle: segStart, endAngle: lastDeg, counterclockwise: true } as ArcEntity);
      segStart = null;
    }
    lastDeg = deg;
  }
  if (segStart !== null) arcs.push({ id: e.id, type: 'arc', layer: e.layer, color: e.color, visible: e.visible, center, radius, startAngle: segStart, endAngle: lastDeg, counterclockwise: true } as ArcEntity);
  return arcs;
}

function clipArc(e: ArcEntity, r: ClipRect): Entity[] {
  const { center, radius } = e;
  if (center.x + radius < r.xMin || center.x - radius > r.xMax ||
      center.y + radius < r.yMin || center.y - radius > r.yMax) return [];
  return sampleArcSegments(e, r);
}

function clipPolyline(e: PolylineEntity | LWPolylineEntity, r: ClipRect): Entity[] {
  if (e.closed) {
    const clipped = sutherland(e.vertices, r);
    return clipped.length >= 2 ? [{ ...e, vertices: clipped } as Entity] : [];
  }
  return clipOpenPolyline(e.vertices, r).map((verts) => ({ ...e, vertices: verts, closed: false } as Entity));
}

function clipRectangleBox(e: RectangleEntity | RectEntity, r: ClipRect): Entity[] {
  // Drawn rectangles only set corner1/corner2; imported DXF rects use x/y/width/height.
  const c1 = (e as RectangleEntity).corner1 ?? { x: e.x, y: e.y };
  const c2 = (e as RectangleEntity).corner2 ?? { x: e.x + e.width, y: e.y + e.height };
  const x1 = Math.min(c1.x, c2.x), y1 = Math.min(c1.y, c2.y);
  const x2 = Math.max(c1.x, c2.x), y2 = Math.max(c1.y, c2.y);
  const ix1 = Math.max(x1, r.xMin), iy1 = Math.max(y1, r.yMin);
  const ix2 = Math.min(x2, r.xMax), iy2 = Math.min(y2, r.yMax);
  if (ix1 >= ix2 || iy1 >= iy2) return [];
  // Update corner1/corner2 so RectangleRenderer (which uses them instead of x/y/w/h)
  // draws the clipped bounds rather than the original unclipped rectangle.
  return [{ ...e, x: ix1, y: iy1, width: ix2 - ix1, height: iy2 - iy1,
    corner1: { x: ix1, y: iy1 }, corner2: { x: ix2, y: iy2 } } as Entity];
}

// Duck-type shapes for DxfTextSceneEntity (has textNode instead of text string).
// Avoids importing text-engine types into the clip service.
type _RunLike = { text?: string };
type _ParaLike = { runs: _RunLike[] };
type _TextNodeLike = { paragraphs: _ParaLike[] };

function clipText(e: TextEntity, r: ClipRect): Entity[] {
  // DxfTextSceneEntity (drawn text) stores content in textNode, not e.text.
  const withNode = e as unknown as { textNode?: _TextNodeLike };
  const textNode = withNode.textNode;

  const plainText = textNode
    ? textNode.paragraphs.flatMap(p => p.runs).map(run => run.text ?? '').join('')
    : (e.text ?? '');

  if (!plainText) return inRect(e.position, r) ? [e] : [];

  // charH: mirrors TextRenderer.extractTextHeight() priority order.
  // DxfTextSceneEntity lacks entity-level height/fontSize → default 2.5 (AutoCAD DIMTXT).
  const sized = e as unknown as { height?: number; fontSize?: number };
  const charH = (sized.height && sized.height > 0 ? sized.height : 0)
             || (sized.fontSize && sized.fontSize > 0 ? sized.fontSize : 0)
             || 2.5;
  const charW = charH * 0.6;
  const chars = [...plainText]; // Unicode-aware split
  if (chars.length === 0) return [];

  const align = e.alignment ?? 'left';
  const totalW = chars.length * charW;
  const localStart = align === 'center' ? -totalW / 2
                   : align === 'right'  ? -totalW
                   : 0;

  const rotRad = ((e.rotation ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const px = e.position.x;
  const py = e.position.y;

  // Convert local (along-baseline, perpendicular-to-baseline) coords to world.
  function toWorld(lx: number, ly: number): Point2D {
    return { x: px + lx * cosR - ly * sinR, y: py + lx * sinR + ly * cosR };
  }

  function charFullyInside(i: number): boolean {
    const x0 = localStart + i * charW;
    const x1 = x0 + charW;
    // textBaseline='top': entity position is top of text; in world Y+UP the
    // text descends, so bottom corners are at local y = -charH (not +charH).
    return [toWorld(x0, 0), toWorld(x1, 0), toWorld(x1, -charH), toWorld(x0, -charH)]
      .every(p => inRect(p, r));
  }

  const keptIndices = chars.map((_, i) => i).filter(charFullyInside);
  if (keptIndices.length === 0) return [];

  const keptText = keptIndices.map(i => chars[i]).join('');
  const firstIdx = keptIndices[0];
  const newPos = toWorld(localStart + firstIdx * charW, 0);

  // Reconstruct entity with trimmed text content.
  if (textNode) {
    const paras = textNode.paragraphs;
    if (paras.length === 1 && paras[0].runs.length === 1) {
      // Simple case (type='text'): single paragraph + single run — trim the run.
      const newTextNode: _TextNodeLike = {
        ...textNode,
        paragraphs: [{ ...paras[0], runs: [{ ...paras[0].runs[0], text: keptText }] }],
      };
      return [{ ...e, position: newPos, textNode: newTextNode } as unknown as Entity];
    }
    // Complex mtext: move insertion point only (conservative).
    return [{ ...e, position: newPos } as Entity];
  }
  // Plain TextEntity from DXF import.
  return [{ ...e, text: keptText, position: newPos, alignment: 'left' } as Entity];
}

function clipAngleMeasurement(e: AngleMeasurementEntity, r: ClipRect): Entity[] {
  // Junction (vertex) outside → discard entire measurement
  if (!inRect(e.vertex, r)) return [];
  // Vertex inside: clip each arm to the rect boundary via Liang-Barsky.
  // Since vertex is inside, each arm clipping always yields a valid segment.
  const arm1 = liangBarsky(e.vertex.x, e.vertex.y, e.point1.x, e.point1.y, r.xMin, r.yMin, r.xMax, r.yMax);
  const arm2 = liangBarsky(e.vertex.x, e.vertex.y, e.point2.x, e.point2.y, r.xMin, r.yMin, r.xMax, r.yMax);
  if (!arm1 || !arm2) return [];
  return [{ ...e, point1: { x: arm1[2], y: arm1[3] }, point2: { x: arm2[2], y: arm2[3] } } as Entity];
}

function clipEllipse(e: EllipseEntity, r: ClipRect): Entity[] {
  const { center, majorAxis, minorAxis } = e;
  const rotation = (e.rotation ?? 0) * DEG;
  const startP = e.startParam ?? 0;
  const rawEnd = e.endParam ?? (Math.PI * 2);
  const sweep = rawEnd > startP ? rawEnd - startP : rawEnd - startP + Math.PI * 2;
  const maxR = Math.max(majorAxis, minorAxis);
  if (center.x + maxR < r.xMin || center.x - maxR > r.xMax ||
      center.y + maxR < r.yMin || center.y - maxR > r.yMax) return [];
  if (center.x - maxR >= r.xMin && center.x + maxR <= r.xMax &&
      center.y - maxR >= r.yMin && center.y + maxR <= r.yMax) return [e];
  const STEPS = 72;
  const result: Entity[] = [];
  let segStart: number | null = null;
  let prevT = startP;
  for (let i = 0; i <= STEPS; i++) {
    const t = startP + sweep * (i / STEPS);
    const px = center.x + majorAxis * Math.cos(t) * Math.cos(rotation) - minorAxis * Math.sin(t) * Math.sin(rotation);
    const py = center.y + majorAxis * Math.cos(t) * Math.sin(rotation) + minorAxis * Math.sin(t) * Math.cos(rotation);
    const inside = inRect({ x: px, y: py }, r);
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

function clipPoint(e: PointEntity, r: ClipRect): Entity[] {
  return inRect(e.position, r) ? [e] : [];
}

function clipMText(e: MTextEntity, r: ClipRect): Entity[] {
  return inRect(e.position, r) ? [e] : [];
}

function clipSpline(e: SplineEntity, r: ClipRect): Entity[] {
  if (!e.controlPoints || e.controlPoints.length === 0) return [e];
  const xs = e.controlPoints.map(p => p.x);
  const ys = e.controlPoints.map(p => p.y);
  const bMinX = Math.min(...xs), bMaxX = Math.max(...xs);
  const bMinY = Math.min(...ys), bMaxY = Math.max(...ys);
  if (bMaxX < r.xMin || bMinX > r.xMax || bMaxY < r.yMin || bMinY > r.yMax) return [];
  return [e];
}

function clipEntity(entity: Entity, rect: ClipRect): Entity[] {
  switch (entity.type) {
    case 'line': return clipLine(entity as LineEntity, rect);
    case 'circle': return clipCircle(entity as CircleEntity, rect);
    case 'arc': return clipArc(entity as ArcEntity, rect);
    case 'polyline': return clipPolyline(entity as PolylineEntity, rect);
    case 'lwpolyline': return clipPolyline(entity as LWPolylineEntity, rect);
    case 'ellipse': return clipEllipse(entity as EllipseEntity, rect);
    case 'rectangle': return clipRectangleBox(entity as RectangleEntity, rect);
    case 'rect': return clipRectangleBox(entity as RectEntity, rect);
    case 'text': return clipText(entity as TextEntity, rect);
    case 'mtext': return clipMText(entity as MTextEntity, rect);
    case 'point': return clipPoint(entity as PointEntity, rect);
    case 'spline': return clipSpline(entity as SplineEntity, rect);
    case 'angle-measurement': return clipAngleMeasurement(entity as AngleMeasurementEntity, rect);
    default: return [entity]; // hatch, block, dimension, leader, xline, ray: keep unchanged
  }
}

export class ClipToRegionService {
  clip<T extends { entities: Entity[] }>(scene: T, rect: ClipRect): T {
    const clipped: Entity[] = [];
    for (const entity of scene.entities) {
      clipped.push(...clipEntity(entity, rect));
    }
    return { ...scene, entities: clipped };
  }

  /**
   * Clip a single overlay polygon (world-space Array<[x,y]>) to the rect.
   * Returns null if the polygon is fully outside (caller should delete the overlay).
   * Returns the same array reference if fully inside (no update needed).
   * Otherwise returns a new clipped polygon with Sutherland-Hodgman boundary vertices.
   */
  clipOverlayPolygon(
    polygon: Array<[number, number]>,
    rect: ClipRect,
  ): Array<[number, number]> | null {
    if (polygon.length === 0) return null;

    // Quick bbox check
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of polygon) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }

    // Fully outside
    if (maxX < rect.xMin || minX > rect.xMax || maxY < rect.yMin || minY > rect.yMax) return null;

    // Fully inside — return same reference (caller skips update)
    if (minX >= rect.xMin && maxX <= rect.xMax && minY >= rect.yMin && maxY <= rect.yMax) {
      return polygon;
    }

    // Partial intersection — Sutherland-Hodgman clip
    const pts: Point2D[] = polygon.map(([x, y]) => ({ x, y }));
    const clipped = sutherland(pts, rect);
    if (clipped.length < 3) return null;
    return clipped.map(p => [p.x, p.y] as [number, number]);
  }
}
