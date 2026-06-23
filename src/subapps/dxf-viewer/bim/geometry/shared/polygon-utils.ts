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

/**
 * True αν το πολύγωνο είναι **κυρτό** (convex) — όλες οι στροφές ίδιου προσήμου
 * (συγγραμμικές κορυφές αγνοούνται). Τρίγωνο πάντα κυρτό. Winding-agnostic. SSoT
 * για το routing κυρτό vs κοίλο (ADR-417 Φ2: κοίλο → straight skeleton).
 */
export function isConvexPolygon(
  vertices: readonly { readonly x: number; readonly y: number }[],
): boolean {
  const n = vertices.length;
  if (n < 4) return true;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const c = vertices[(i + 2) % n];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cr) < 1e-9) continue;
    const s = cr > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
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
 * Κλειστός δακτύλιος (closed ring / band footprint) από δύο παράλληλες ακμές: η εξωτερική
 * ακμή ευθεία + η εσωτερική **αντεστραμμένη** → ενιαίο κλειστό πολύγωνο. SSoT για το idiom
 * `[...outer, ...[...inner].reverse()]` που ήταν διάσπαρτο (WallRenderer, building-footprint,
 * hit-test, slab-boq, bim-to-dxf, envelope, mep-fitting, framing snap-targets). Generic επί
 * `T` (Point2D ή Point3D)· non-mutating (αντιγράφει πριν το `reverse`).
 */
export function closedRingFromEdges<T>(outer: readonly T[], inner: readonly T[]): T[] {
  return [...outer, ...[...inner].reverse()];
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
// Moved to sibling module `polygon-offset-utils.ts` (N.7.1 500-line cap).
// Re-exported here so all existing importers keep working unchanged.

export {
  segmentNormalX,
  segmentNormalY,
  vertexNormalX,
  vertexNormalY,
  stripClosingDuplicate,
  offsetPolyline,
  insetClosedPolygon,
  insetPolygonMiter,
} from './polygon-offset-utils';

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

/**
 * **Area** centroid (κέντρο βάρους εμβαδού) ενός πολυγώνου μέσω του shoelace SSoT
 * (XY plane, z αγνοείται). Σε αντίθεση με το {@link polygonCentroid} (μέσος όρος
 * κορυφών), αυτό δίνει το πραγματικό κέντρο βάρους — **κρίσιμο για κοίλα/μη-συμμετρικά**
 * αποτυπώματα (L/T/U), όπου ο μέσος όρος κορυφών ≠ κέντρο μάζας (π.χ. τοποθέτηση
 * θεμελίου κάτω από το load resultant για ομοιόμορφη πίεση). Για συμμετρικά
 * (ορθογώνιο) ταυτίζεται με τον μέσο όρο κορυφών.
 *
 * Degenerate (< 3 κορυφές ή μηδενικό εμβαδόν) → fallback στον vertex-mean
 * {@link polygonCentroid} (well-defined αντί διαίρεση με το μηδέν).
 */
export function polygonAreaCentroid(vertices: readonly Point3D[]): { x: number; y: number } {
  const n = vertices.length;
  if (n < 3) return polygonCentroid(vertices);
  const signedArea = shoelaceArea(vertices);
  if (signedArea === 0) return polygonCentroid(vertices);
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  const factor = 1 / (6 * signedArea);
  return { x: cx * factor, y: cy * factor };
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
  lineIntersectionPoint,
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
