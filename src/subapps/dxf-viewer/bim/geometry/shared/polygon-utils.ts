/**
 * Polygon utility helpers (ADR-363 Phase 3, shared).
 *
 * Re-usable pure functions για slab + future column footprint + beam
 * cross-section. Operates σε `Polygon3D` (XY plane — z ignored).
 *
 * All inputs σε mm world coords; outputs:
 *   - shoelaceArea  → mm² (signed)
 *   - polygonPerimeter → mm (sum-of-edges)
 *   - polygonBbox → BoundingBox3D (z=0 plane)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { BoundingBox3D, Point3D, Polygon3D } from '../../types/bim-base';

/**
 * Compute signed polygon area via the shoelace (Gauss) formula.
 * Positive → CCW, negative → CW. Caller που θέλει unsigned area κάνει
 * `Math.abs(shoelaceArea(...))`.
 *
 * Returns 0 για < 3 vertices (degenerate polygon).
 */
export function shoelaceArea(vertices: readonly Point3D[]): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Unsigned area — always ≥ 0. */
export function polygonArea(vertices: readonly Point3D[]): number {
  return Math.abs(shoelaceArea(vertices));
}

/** True αν το πολύγωνο είναι CCW (positive signed area). */
export function isPolygonCCW(vertices: readonly Point3D[]): boolean {
  return shoelaceArea(vertices) > 0;
}

/** Sum-of-edges perimeter (mm). Closes με implicit edge από last → first. */
export function polygonPerimeter(vertices: readonly Point3D[]): number {
  const n = vertices.length;
  if (n < 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Axis-aligned bounding box (XY plane, z=0). */
export function polygonBbox(vertices: readonly Point3D[]): BoundingBox3D {
  if (vertices.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return {
    min: { x: minX, y: minY, z: 0 },
    max: { x: maxX, y: maxY, z: 0 },
  };
}

/**
 * Point-in-polygon test (ray casting, XY plane). True όταν το point
 * βρίσκεται μέσα ή στην ακμή του πολυγώνου.
 */
export function pointInPolygon(
  point: { readonly x: number; readonly y: number },
  vertices: readonly Point3D[],
): boolean {
  const n = vertices.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Naive self-intersection check για polygon edges (O(n²)). Επιστρέφει `true`
 * όταν δύο μη-γειτονικές ακμές τέμνονται. Phase 3 sufficient (μικρά polygons).
 * Phase 3.5 αναβάθμιση σε sweep-line αν χρειαστεί.
 */
export function isPolygonSelfIntersecting(vertices: readonly Point3D[]): boolean {
  const n = vertices.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      // Skip adjacent edge + edge που μοιράζεται κορυφή με την πρώτη.
      if (i === 0 && j === n - 1) continue;
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function segmentsIntersect(p1: Point3D, p2: Point3D, p3: Point3D, p4: Point3D): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  return false;
}

function direction(a: Point3D, b: Point3D, c: Point3D): number {
  return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
}

/** Convenience: re-export polygon vertices as a closed Polygon3D. */
export function makePolygon3D(vertices: readonly Point3D[]): Polygon3D {
  return { vertices };
}

// ─── Polygon clipping (Sutherland-Hodgman) ───────────────────────────────────

/**
 * Sutherland-Hodgman polygon clip. Clips `subject` against a **convex** `clip`
 * polygon. Returns the clipped output polygon (possibly empty).
 *
 * Contract:
 *   - `clip` MUST be convex (CCW winding). Beam outlines from `buildOutlineRect`
 *     are always convex rectangles → this contract is satisfied for Phase 5.5i+.
 *   - `subject` may be concave (slab outline).
 *   - Returns [] when the polygons have no intersection.
 *
 * Algorithm reference: Sutherland-Hodgman (1974). For each clip edge the
 * output list is clipped against the half-plane defined by that edge.
 * "Inside" = left of the directed edge (CCW convention).
 */
export function clipPolygonBySH(
  subject: readonly Point3D[],
  clip: readonly Point3D[],
): Point3D[] {
  if (subject.length < 3 || clip.length < 3) return [];
  let output: Point3D[] = subject.slice() as Point3D[];
  const n = clip.length;

  for (let i = 0; i < n; i++) {
    if (output.length === 0) return [];
    const input = output;
    output = [];
    const edgeA = clip[i];
    const edgeB = clip[(i + 1) % n];

    for (let j = 0; j < input.length; j++) {
      const curr = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const currInside = shIsInside(curr, edgeA, edgeB);
      const prevInside = shIsInside(prev, edgeA, edgeB);

      if (currInside) {
        if (!prevInside) output.push(shIntersect(prev, curr, edgeA, edgeB));
        output.push(curr);
      } else if (prevInside) {
        output.push(shIntersect(prev, curr, edgeA, edgeB));
      }
    }
  }

  return output;
}

/**
 * Compute the intersection area (mm²) between two polygons using S-H clipping.
 *
 * `beamVertices` MUST be convex (i.e. beam rectangle outline). Fast AABB
 * rejection applied first — returns 0 when bbox do not overlap.
 */
export function polygonIntersectionAreaMm2(
  slabVertices: readonly Point3D[],
  beamVertices: readonly Point3D[],
): number {
  if (slabVertices.length < 3 || beamVertices.length < 3) return 0;

  // Fast AABB reject.
  const sb = polygonBbox(slabVertices);
  const bb = polygonBbox(beamVertices);
  if (sb.max.x <= bb.min.x || bb.max.x <= sb.min.x) return 0;
  if (sb.max.y <= bb.min.y || bb.max.y <= sb.min.y) return 0;

  // S-H: slab = subject (may be concave), beam = clip (convex rectangle → exact).
  const clipped = clipPolygonBySH(slabVertices, beamVertices);
  return polygonArea(clipped);
}

// ─── S-H internal helpers ─────────────────────────────────────────────────────

/** True when `pt` is on the left side of directed edge A→B (CCW = inside). */
function shIsInside(pt: Point3D, a: Point3D, b: Point3D): boolean {
  return (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x) >= 0;
}

/** Intersection of segment p1→p2 with infinite line through a→b. */
function shIntersect(p1: Point3D, p2: Point3D, a: Point3D, b: Point3D): Point3D {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = b.x - a.x;
  const dy2 = b.y - a.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return { x: p1.x, y: p1.y, z: 0 };
  const t = ((a.x - p1.x) * dy2 - (a.y - p1.y) * dx2) / denom;
  return { x: p1.x + t * dx1, y: p1.y + t * dy1, z: 0 };
}
