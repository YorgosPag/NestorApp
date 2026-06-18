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

import type { MultiPolygon, Pair } from 'polygon-clipping';
import type { BoundingBox3D, Point3D, Polygon3D } from '../../types/bim-base';
import { segmentsIntersect } from '../../../utils/geometry/GeometryUtils';
import { angleBetweenVectors } from '../../../rendering/entities/shared/geometry-vector-utils';
import { radToDeg } from '../../../rendering/entities/shared/geometry-angle-utils';

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

/**
 * Συνολικό εμβαδόν μιας `polygon-clipping` `MultiPolygon` (outer − holes), στις
 * ίδιες μονάδες με τα input coords (canvas units²). Κάθε polygon: ring[0] = outer,
 * τα υπόλοιπα rings = holes (αφαιρούνται). SSoT — πριν ήταν private duplicate σε
 * `footprint-region-classifier.ts` + στο safe-polygon-boolean test (N.0.2 dedup).
 */
export function multiPolygonArea(mp: MultiPolygon): number {
  let total = 0;
  for (const polygon of mp) {
    for (let i = 0; i < polygon.length; i++) {
      const verts: Point3D[] = polygon[i].map((pr: Pair) => ({ x: pr[0], y: pr[1], z: 0 }));
      const a = polygonArea(verts);
      total += i === 0 ? a : -a; // ring[0] = outer, υπόλοιπα = holes
    }
  }
  return Math.max(0, total);
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

/**
 * Ελάχιστη (μη-προσημασμένη) γωνία κορυφής πολυγώνου σε μοίρες [0,180], winding/convexity-agnostic
 * (reflex 270°→90°). REUSE `angleBetweenVectors` (ADR-072)+`radToDeg` (ADR-067)· ADR-449 sliver guard· <3→180.
 */
export function minPolygonInteriorAngleDeg(
  vertices: readonly { readonly x: number; readonly y: number }[],
): number {
  const n = vertices.length;
  if (n < 3) return 180;
  let min = 180;
  for (let i = 0; i < n; i++) {
    const b = vertices[i];
    const ba = { x: vertices[(i - 1 + n) % n].x - b.x, y: vertices[(i - 1 + n) % n].y - b.y };
    const bc = { x: vertices[(i + 1) % n].x - b.x, y: vertices[(i + 1) % n].y - b.y };
    if (Math.hypot(ba.x, ba.y) < 1e-9 || Math.hypot(bc.x, bc.y) < 1e-9) continue;
    const ang = Math.abs(radToDeg(angleBetweenVectors(ba, bc)));
    if (ang < min) min = ang;
  }
  return min;
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

/** Convenience: re-export polygon vertices as a closed Polygon3D. */
export function makePolygon3D(vertices: readonly Point3D[]): Polygon3D {
  return { vertices };
}

// ─── Polygon clipping (Sutherland-Hodgman) ───────────────────────────────────
//
// Moved to sibling module `polygon-clip-utils.ts` (N.7.1 500-line cap).
// Re-exported here so all existing importers keep working unchanged.

export {
  clipPolygonBySH,
  polygonIntersectionAreaMm2,
} from './polygon-clip-utils';

// ─── Offset-with-mitre helpers (SSoT) ─────────────────────────────────────────
//
// Canonical polyline-offset math, extracted from `wall-geometry.ts` and
// `beam-geometry.ts` (verbatim duplicate before this SSoT). Consumed by walls
// (axis → outer/inner edge), beams (axis → outline rect) and ADR-396 envelope
// perimeter (exterior face → insulation outer loop). N.0.2 / N.12 dedup.

/** Below this segment length (mm/canvas) a segment is treated as degenerate. */
const DEGENERATE_LENGTH_EPS = 0.001;

/**
 * CCW 90° unit segment normal X component (rotate tangent (dx,dy) → (-dy,dx)).
 * Returns `null` for degenerate (near-zero-length) segments.
 */
export function segmentNormalX(a: Point3D, b: Point3D): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_LENGTH_EPS) return null;
  return -dy / len;
}

/** CCW 90° unit segment normal Y component. Returns `null` for degenerate. */
export function segmentNormalY(a: Point3D, b: Point3D): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_LENGTH_EPS) return null;
  return dx / len;
}

/**
 * Vertex normal X — averages the adjacent segment normals (CCW 90°).
 *
 * `closed = false` (open polyline): endpoint vertices use their single adjacent
 * segment (walls/beams — the free ends are square-cut, not mitred).
 *
 * `closed = true` (ring): EVERY vertex — including index 0 and n-1 — averages
 * BOTH adjacent segments with wrap-around. Without this, the seam vertex of a
 * closed loop is offset perpendicular to only one edge, splitting the corner into
 * a `distance`-long diagonal jog (ADR-396 insulation-loop + Z4 reveal-frame bug).
 *
 * Degenerate segments are skipped. The averaging is the mitre approximation at
 * internal corners (shared by all callers — consistent across every corner).
 */
export function vertexNormalX(vertices: readonly Point3D[], i: number, closed = false): number {
  const n = vertices.length;
  let acc = 0;
  let count = 0;
  if (i > 0 || closed) {
    const prev = i > 0 ? i - 1 : n - 1;
    const seg = segmentNormalX(vertices[prev], vertices[i]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  if (i < n - 1 || closed) {
    const next = i < n - 1 ? i + 1 : 0;
    const seg = segmentNormalX(vertices[i], vertices[next]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  return count > 0 ? acc / count : 0;
}

/** Vertex normal Y — averages adjacent segment normals (mitre at corners). See `vertexNormalX` for `closed`. */
export function vertexNormalY(vertices: readonly Point3D[], i: number, closed = false): number {
  const n = vertices.length;
  let acc = 0;
  let count = 0;
  if (i > 0 || closed) {
    const prev = i > 0 ? i - 1 : n - 1;
    const seg = segmentNormalY(vertices[prev], vertices[i]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  if (i < n - 1 || closed) {
    const next = i < n - 1 ? i + 1 : 0;
    const seg = segmentNormalY(vertices[i], vertices[next]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  return count > 0 ? acc / count : 0;
}

/**
 * Drop a trailing vertex that coincides with the first (within `eps`). A closed
 * ring is sometimes represented with its first point repeated at the end (e.g. the
 * assembled envelope face loop); that duplicate creates a zero-length wrap-around
 * segment that breaks the closed-mitre at the seam. Returns the input unchanged
 * when there is no such duplicate.
 */
export function stripClosingDuplicate(vertices: readonly Point3D[], eps = 1e-6): readonly Point3D[] {
  const n = vertices.length;
  if (n < 2) return vertices;
  const a = vertices[0];
  const b = vertices[n - 1];
  if (Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps) {
    return vertices.slice(0, n - 1);
  }
  return vertices;
}

/**
 * Offset a polyline by `distance` along the per-vertex normals, scaled by
 * `sign` (+1 = CCW outward, -1 = inward). Returns a new array of the same
 * length; corners are mitred via the averaged vertex normal. `distance` is in
 * the same unit as the vertex coordinates (caller scales mm→canvas).
 *
 * `closed = true` treats the input as a ring (vertex 0 and n-1 are corners that
 * wrap around), so a closed loop offsets without a seam jog. Callers offsetting a
 * ring MUST first drop any trailing closing-duplicate (`stripClosingDuplicate`),
 * otherwise the zero-length seam segment defeats the wrap-around.
 */
export function offsetPolyline(
  vertices: readonly Point3D[],
  distance: number,
  sign: number,
  closed = false,
): Point3D[] {
  const out: Point3D[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const nx = vertexNormalX(vertices, i, closed);
    const ny = vertexNormalY(vertices, i, closed);
    const v = vertices[i];
    out.push({
      x: v.x + sign * distance * nx,
      y: v.y + sign * distance * ny,
      z: v.z ?? 0,
    });
  }
  return out;
}

/**
 * Inset ενός κλειστού polygon κατά `distance` προς τα ΜΕΣΑ, winding-agnostic:
 * δοκιμάζει και τα δύο πρόσημα του `offsetPolyline` και κρατά αυτό με το ΜΙΚΡΟΤΕΡΟ
 * εμβαδόν (= προς τα μέσα). Επιστρέφει `null` αν το polygon είναι μη-έγκυρο
 * (< 3 κορυφές, `distance ≤ 0`) ή το inset καταρρέει (degenerate). Χρήση: ETICS
 * περβάζια (ADR-396 Z4 — frame γύρω από την τρύπα ανοίγματος, 2D + 3D).
 */
export function insetClosedPolygon(
  vertices: readonly Point3D[],
  distance: number,
): Point3D[] | null {
  if (vertices.length < 3 || distance <= 0) return null;
  // Ring offset: strip any closing-duplicate + closed-mitre so the seam vertex
  // does not produce a diagonal jog (same fix as the envelope insulation loop).
  const ring = stripClosingDuplicate(vertices);
  if (ring.length < 3) return null;
  const plus = offsetPolyline(ring, distance, 1, true);
  const minus = offsetPolyline(ring, distance, -1, true);
  const inner = polygonArea(plus) <= polygonArea(minus) ? plus : minus;
  if (inner.length < 3 || polygonArea(inner) <= 0) return null;
  return inner;
}

/**
 * **Miter inward inset** ενός κλειστού πολυγώνου κατά `d` (winding-aware, concave-safe).
 * Κάθε ακμή μετατοπίζεται κάθετα προς τα ΜΕΣΑ κατά ΑΚΡΙΒΩΣ `d` και οι κορυφές κλείνουν
 * στην τομή των μετατοπισμένων ευθειών (γνήσιο miter `m = d·(n1+n2)/(1+n1·n2)`, με
 * miter-limit clamp). Σε αντίθεση με το {@link insetClosedPolygon} (averaged-normal, που
 * υπο-εισάγει τις γωνίες ~cos45°), αυτό διατηρεί την κάθετη απόσταση `d` σε κάθε παρειά —
 * απαραίτητο για centerline στεφανιού/ράβδων (ADR-460). Reflex (εσωτερικές) γωνίες Γ/Τ/Π
 * χειρίζονται σωστά γιατί τα inward normals προκύπτουν από το CCW winding (left normal),
 * όχι από centroid. Επιστρέφει `null` αν `< 3` κορυφές ή το inset καταρρέει (≤0 εμβαδόν).
 * Έξοδος πάντα σε CCW σειρά. `d ≤ 0` → αντίγραφο (CCW).
 */
export function insetPolygonMiter(
  vertices: readonly { readonly x: number; readonly y: number }[],
  distance: number,
): { x: number; y: number }[] | null {
  const n = vertices.length;
  if (n < 3) return null;
  // CCW orientation (signed area > 0)· αν CW → reverse ώστε left-normal = inward.
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    area2 += a.x * b.y - b.x * a.y;
  }
  const ring = area2 >= 0 ? vertices.map((p) => ({ x: p.x, y: p.y })) : vertices.map((p) => ({ x: p.x, y: p.y })).reverse();
  if (distance <= 0) return ring;

  const EPS = 1e-9;
  const MITER_LIMIT = 4;
  // Inward unit normal κάθε ακμής i (CCW left normal = rotate dir +90°: (-dy,dx)).
  const nrm = ring.map((a, i) => {
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
  const out: { x: number; y: number }[] = [];
  for (let k = 0; k < n; k++) {
    const v = ring[k];
    const n1 = nrm[(k - 1 + n) % n];
    const n2 = nrm[k];
    const denom = 1 + (n1.x * n2.x + n1.y * n2.y);
    let mx: number;
    let my: number;
    if (denom < EPS) {
      mx = distance * n2.x;
      my = distance * n2.y;
    } else {
      mx = (distance * (n1.x + n2.x)) / denom;
      my = (distance * (n1.y + n2.y)) / denom;
      const mag = Math.hypot(mx, my);
      if (mag > MITER_LIMIT * distance) {
        const s = (MITER_LIMIT * distance) / mag;
        mx *= s;
        my *= s;
      }
    }
    out.push({ x: v.x + mx, y: v.y + my });
  }
  return polygonArea(out.map((p) => ({ ...p, z: 0 }))) > 0 ? out : null;
}

/**
 * Μήκος μιας polyline σε ΜΕΤΡΑ. `points` σε canvas units· `sceneScale` =
 * `mmToSceneUnits(units)` (canvas ανά mm). `closed` → προσθέτει την ακμή
 * last→first. SSoT για το ETICS perimeter (ADR-396) — καταναλώνεται και από
 * `envelope-perimeter.ts` και από `envelope-shell.ts` (μηδέν duplication, N.12).
 */
export function polylinePerimeterMeters(
  points: readonly Point3D[],
  closed: boolean,
  sceneScale: number,
): number {
  const n = points.length;
  if (n < 2 || sceneScale === 0) return 0;
  let canvas = 0;
  for (let i = 1; i < n; i++) {
    canvas += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (closed) canvas += Math.hypot(points[0].x - points[n - 1].x, points[0].y - points[n - 1].y);
  return canvas / sceneScale / 1000;
}

/**
 * Arithmetic-mean centroid of a polygon's vertices (XY plane, z ignored).
 * Sufficient for near-convex building outlines (ADR-396 D2 exterior-face
 * selection). Returns `{x:0, y:0}` for an empty vertex list.
 */
export function polygonCentroid(vertices: readonly Point3D[]): { x: number; y: number } {
  const n = vertices.length;
  if (n === 0) return { x: 0, y: 0 };
  let sumX = 0;
  let sumY = 0;
  for (const v of vertices) {
    sumX += v.x;
    sumY += v.y;
  }
  return { x: sumX / n, y: sumY / n };
}

// ─── Polygon ↔ axis projection (SSoT) ─────────────────────────────────────────
//
// Moved to sibling module `polygon-axis-projection.ts` (N.7.1 500-line cap).
// Re-exported here so all existing importers keep working unchanged.

export type {
  AxisProjection,
  PolygonAxisProjection,
} from './polygon-axis-projection';
export {
  projectPointOnAxis,
  projectPolygonOnAxis,
} from './polygon-axis-projection';

/**
 * CCW order of points around their centroid. Gives perimeter order for a convex footprint
 * regardless of the input order (grip-emission order, diagonal-anchor order, polygon
 * winding). For ≤2 points returns them unchanged.
 */
export function sortPointsAroundCentroid<T extends { x: number; y: number }>(points: readonly T[]): T[] {
  if (points.length < 3) return [...points];
  let cx = 0;
  let cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  cx /= points.length;
  cy /= points.length;
  return [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

/**
 * Per-edge midpoints of a footprint from its corner points — a midpoint for EVERY side.
 * Corners are ordered around the centroid first (via {@link sortPointsAroundCentroid}), so
 * any corner source (grips, diagonal anchors, polygon vertices) yields the same perimeter
 * midpoints. SSoT for "midpoints on all sides" of a convex BIM footprint (ADR-370). Exact
 * for convex footprints (≈ all BIM); z ignored.
 */
export function footprintEdgeMidpoints(
  corners: readonly { x: number; y: number }[],
): { x: number; y: number }[] {
  if (corners.length < 2) return [];
  if (corners.length === 2) {
    const [a, b] = corners;
    return [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }];
  }
  const ordered = sortPointsAroundCentroid(corners);
  return ordered.map((c, i) => {
    const next = ordered[(i + 1) % ordered.length]!;
    return { x: (c.x + next.x) / 2, y: (c.y + next.y) / 2 };
  });
}

// ─── Axis-aligned hatch (SSoT) ────────────────────────────────────────────────
//
// Moved to sibling module `polygon-hatch-utils.ts` (N.7.1 500-line cap).
// Re-exported here so all existing importers keep working unchanged.

export type {
  HatchPoint2D,
  HatchDirection,
  HatchLineSegment,
} from './polygon-hatch-utils';
export {
  buildAxisAlignedHatch,
  clipLineToBbox,
} from './polygon-hatch-utils';
