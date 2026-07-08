/**
 * clip-geometry — SSoT low-level geometry primitives για το crop pipeline.
 *
 * Πριν ήταν ΔΙΠΛΑ ορισμένα (byte-identical) σε `ClipToRegionService` ΚΑΙ
 * `ClipToPolygonService` (`sutherland`, `pointInPolygon`, `normAngle`, `arcSweepDeg`,
 * `inRect`, …). Εδώ ζουν μία φορά· τα καταναλώνουν οι region strategies (`clip-region.ts`).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SpatialBounds } from '../../types/entity-bounds';

export interface ClipRect {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export const DEG = Math.PI / 180;

export function normAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Arc sweep in degrees from start toward end in the arc's direction. */
export function arcSweepDeg(s: number, e: number, ccw: boolean): number {
  if (ccw) return e >= s ? e - s : 360 - s + e;
  return s >= e ? s - e : 360 - e + s;
}

export function inRect(p: Point2D, r: ClipRect): boolean {
  return p.x >= r.xMin && p.x <= r.xMax && p.y >= r.yMin && p.y <= r.yMax;
}

export function ptEq(a: Point2D, b: Point2D): boolean {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

/** Axis-aligned bounds of a point list (empty → zero-area at origin). */
export function boundsOfPoints(pts: Array<Point2D | [number, number]>): SpatialBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    const x = Array.isArray(p) ? p[0] : p.x;
    const y = Array.isArray(p) ? p[1] : p.y;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/** Liang-Barsky line clipping — returns [x1,y1,x2,y2] or null if fully outside. */
export function liangBarsky(
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

/** Sutherland-Hodgman — clips a closed polygon against an axis-aligned rect. */
export function sutherlandRect(verts: Point2D[], rect: ClipRect): Point2D[] {
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

/** Ray-casting point-in-polygon. Works for convex AND concave polygons. */
export function pointInPolygon(p: Point2D, poly: Array<[number, number]>): boolean {
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
 * Generalised Sutherland-Hodgman polygon clip. Subject = polygon to clip;
 * clip = clip boundary polygon. Exact for convex clip polygon; approximate for concave.
 */
export function sutherlandGeneral(subject: Point2D[], clip: Array<[number, number]>): Point2D[] {
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
 * Parametric segment-polygon clip. Finds all t where segment AB crosses polygon
 * edges, keeps sub-segments whose midpoint is inside. Correct for ANY polygon shape.
 */
export function clipSegmentByPolygon(
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

/** Axis-aligned bbox overlaps an axis-aligned rect. */
export function rectBboxOverlap(b: SpatialBounds, r: ClipRect): boolean {
  return !(b.maxX < r.xMin || b.minX > r.xMax || b.maxY < r.yMin || b.minY > r.yMax);
}

/** Axis-aligned bbox overlaps a (convex OR concave) polygon. */
export function bboxOverlapsPolygon(b: SpatialBounds, poly: Array<[number, number]>): boolean {
  const pb = boundsOfPoints(poly);
  if (b.maxX < pb.minX || b.minX > pb.maxX || b.maxY < pb.minY || b.minY > pb.maxY) return false;
  const corners: Point2D[] = [
    { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY },
  ];
  if (corners.some((c) => pointInPolygon(c, poly))) return true;
  if (poly.some(([x, y]) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY)) return true;
  for (let i = 0; i < 4; i++) {
    const a = corners[i], c = corners[(i + 1) % 4];
    if (clipSegmentByPolygon(a.x, a.y, c.x, c.y, poly).length > 0) return true;
  }
  return false;
}
