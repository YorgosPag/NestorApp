/**
 * Geometry utilities for DXF entity processing
 * Handles arc tessellation, segment chaining, and geometric calculations
 */

import type { Point2D } from '../../rendering/types/Types';
// 🏢 ADR-067: Centralized angle conversion + TAU constant
import { degToRad, TAU } from '../../rendering/entities/shared/geometry-utils';
import { type Entity } from '../../types/entities';
// 🏢 ADR-074: Centralized Point On Circle
// 🏢 ADR-065: Centralized Distance Calculation
import { pointOnCircle, calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-114: Centralized Bounding Box Calculation
import { calculateBoundingBox } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-079: Centralized Geometric Precision Constants
// 🏢 ADR-166: Centralized GAP_TOLERANCE & ARC_TESSELLATION
import { GEOMETRY_PRECISION, ENTITY_LIMITS, ARC_TESSELLATION } from '../../config/tolerance-config';
// 🏢 ADR-652 M4: ουδέτερος SSoT «Entity → πολυγραμμές (σημεία)» — μηδέν δικά μας curve math
import { entityToPolylines, type EntityPolyline } from '../../rendering/entities/shared/entity-polylines';

export const GEOMETRY_CONSTANTS = {
  // 🏢 ADR-079: Using centralized precision constants
  EPS: GEOMETRY_PRECISION.ENTITY_GAP, // Relaxed tolerance for better entity matching (1e-3)
  // 🏢 ADR-166: Using centralized entity gap tolerance
  GAP_TOLERANCE: ENTITY_LIMITS.GAP_TOLERANCE, // Allow moderate gaps between entities (0.5 CAD units)
  // 🏢 ADR-166: Using centralized arc tessellation segments
  DEFAULT_ARC_SEGMENTS: ARC_TESSELLATION.DEFAULT_SEGMENTS, // 24 segments = 15° per segment
} as const;

// Point2D imported from shared types

export interface Segment {
  start: Point2D;
  end: Point2D;
}

export interface Arc {
  center: Point2D;
  radius: number;
  startAngle?: number;
  endAngle?: number;
}

/**
 * Check if two numbers are approximately equal
 */
export function approximatelyEqual(a: number, b: number, tolerance = GEOMETRY_CONSTANTS.EPS): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Check if two points are the same within tolerance
 */
export function samePoint(p: Point2D, q: Point2D): boolean {
  return approximatelyEqual(p.x, q.x) && approximatelyEqual(p.y, q.y);
}

/**
 * Check if two points are near each other within gap tolerance
 * 🏢 ADR-065: Uses centralized calculateDistance
 */
export function nearPoint(p: Point2D, q: Point2D): boolean {
  return calculateDistance(p, q) <= GEOMETRY_CONSTANTS.GAP_TOLERANCE;
}

/**
 * Calculate distance between two points
 * ✅ CENTRALIZED: Re-export από centralized location
 */
export { calculateDistance as distance } from '../../rendering/entities/shared/geometry-rendering-utils';

/**
 * Convert arc to polyline vertices
 */
export function arcToPolyline(arc: Arc, segments: number = GEOMETRY_CONSTANTS.DEFAULT_ARC_SEGMENTS): Point2D[] {
  if (!arc.center || typeof arc.radius !== 'number') return [];

  const { center, radius } = arc;

  // DXF angles are in DEGREES (counter-clockwise). Convert to RADIANS.
  // 🏢 ADR-067: Using centralized degToRad from geometry-utils
  let start = degToRad(arc.startAngle ?? 0);
  let end = degToRad(arc.endAngle ?? 0);

  // Normalize to ensure end > start within [0, 2π)
  // 🏢 TAU imported from centralized geometry-utils
  start = ((start % TAU) + TAU) % TAU;
  end = ((end % TAU) + TAU) % TAU;
  if (end <= start) end += TAU;

  const span = end - start;
  const steps = Math.max(2, segments);
  const step = span / steps;

  const verts: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + i * step;
    // 🏢 ADR-074: Use centralized pointOnCircle
    const point = pointOnCircle(center, radius, a);

    // 🏢 ADR-079: Drop consecutive duplicates using centralized vertex duplicate threshold
    if (verts.length === 0 || Math.hypot(point.x - verts[verts.length - 1].x, point.y - verts[verts.length - 1].y) > GEOMETRY_PRECISION.VERTEX_DUPLICATE) {
      verts.push(point);
    }
  }

  if (verts.length > 0) {

  }
  
  return verts;
}

/**
 * Base entity interface for geometry processing
 */
interface GeometryEntity {
  type: string;
  start?: Point2D;
  end?: Point2D;
  vertices?: Point2D[];
  closed?: boolean;
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
}

/**
 * Πολυγραμμές (SSoT σχήματος) → ευθύγραμμα τμήματα. Κλειστή πολυγραμμή ⇒ +τμήμα
 * κλεισίματος (τελευταία→πρώτη κορυφή). Καθαρή μετατροπή, καμία γεωμετρία τύπου.
 */
function polylinesToSegments(polylines: readonly EntityPolyline[]): Segment[] {
  const segments: Segment[] = [];
  for (const pl of polylines) {
    const pts = pl.points;
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push({ start: pts[i], end: pts[i + 1] });
    }
    if (pl.closed && pts.length > 2) {
      segments.push({ start: pts[pts.length - 1], end: pts[0] });
    }
  }
  return segments;
}

/**
 * Convert entity to segments based on type.
 *
 * 🏢 ADR-652 M4 — thin adapter: η γεωμετρία «entity → σχήμα» ζει ΜΙΑ φορά στον
 * ουδέτερο SSoT `entityToPolylines` (line / polyline+bulges / arc / circle / ellipse /
 * spline / rectangle / block — μηδέν δικά μας curve math). Εδώ μένει ΜΟΝΟ η μετατροπή
 * «πολυγραμμή → Segment[]» — κανένας δεύτερος per-type flattener. (Πριν: μερικός switch
 * line/polyline/arc που αγνοούσε bulge/circle/ellipse/spline/block.)
 */
export const entityToSegments = (entity: GeometryEntity): Segment[] =>
  polylinesToSegments(entityToPolylines(entity as unknown as Entity));

/**
 * Check if two connected line segments are collinear (same direction / straight line)
 * Uses cross-product test: if |AB × AC| < tolerance, points are collinear
 *
 * @param a Start of first segment
 * @param b Shared endpoint (end of first / start of second)
 * @param c End of second segment
 * @param tolerance Cross-product tolerance (default: GAP_TOLERANCE for CAD-level precision)
 */
export function arePointsCollinear(a: Point2D, b: Point2D, c: Point2D, tolerance = GEOMETRY_CONSTANTS.GAP_TOLERANCE): boolean {
  // Cross product: (b-a) × (c-a)
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(cross) < tolerance;
}

/**
 * 🎯 CENTRALIZED POINT-IN-POLYGON TEST
 * Κεντρικοποιημένη μέθοδος για έλεγχο αν σημείο είναι μέσα σε πολύγωνο
 * Χρησιμοποιείται από selection systems, hit testing, και layer rendering
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/**
 * 🎯 CENTRALIZED SEGMENT-SEGMENT INTERSECTION TEST
 * Cross-product method. Handles collinear endpoint overlap.
 * SSoT for all selection systems (lasso, marquee, crossing).
 */
export function segmentsIntersect(
  a1: Point2D, a2: Point2D,
  b1: Point2D, b2: Point2D,
): boolean {
  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const onSeg = (p: Point2D, s: Point2D, e: Point2D) =>
    Math.min(s.x, e.x) <= p.x && p.x <= Math.max(s.x, e.x) &&
    Math.min(s.y, e.y) <= p.y && p.y <= Math.max(s.y, e.y);
  if (d1 === 0 && onSeg(a1, b1, b2)) return true;
  if (d2 === 0 && onSeg(a2, b1, b2)) return true;
  if (d3 === 0 && onSeg(b1, a1, a2)) return true;
  if (d4 === 0 && onSeg(b2, a1, a2)) return true;
  return false;
}

/** Σημείο τομής δύο ΤΜΗΜΑΤΩΝ + οι παράμετροι t (στο a) και u (στο b), ∈ [0,1]. */
export interface SegmentIntersection {
  readonly point: Point2D;
  readonly t: number;
  readonly u: number;
}

/**
 * 🎯 CENTRALIZED SEGMENT-SEGMENT INTERSECTION POINT (SSoT, point-returning).
 *
 * Επιστρέφει το σημείο τομής δύο **τμημάτων** `a1→a2` και `b1→b2` (clamped: τέμνονται
 * όντως μέσα στα όρια ΚΑΙ των δύο), μαζί με τις παραμέτρους `t`/`u`. `null` αν είναι
 * παράλληλα/συγγραμμικά ή τέμνονται μόνο στις προεκτάσεις τους.
 *
 * Σε αντίθεση με το `segmentsIntersect` (boolean — selection systems) και τα
 * infinite-line helpers (`wall-from-entity`/`angle-entity-math`, miter/γωνία), αυτό
 * δίνει το ΣΗΜΕΙΟ τομής τμημάτων — π.χ. για planarization/noding ενός δικτύου
 * γραμμών (auto-area face detection σε κατόψεις «σκάρα»).
 */
export function segmentIntersection(
  a1: Point2D, a2: Point2D,
  b1: Point2D, b2: Point2D,
  eps = 1e-9,
): SegmentIntersection | null {
  const rx = a2.x - a1.x, ry = a2.y - a1.y;
  const sx = b2.x - b1.x, sy = b2.y - b1.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < eps) return null; // παράλληλα ή συγγραμμικά
  const qpx = b1.x - a1.x, qpy = b1.y - a1.y;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
  return { point: { x: a1.x + t * rx, y: a1.y + t * ry }, t, u };
}

/**
 * 🏢 ADR-114: CENTRALIZED BOUNDS CALCULATION
 * Re-export από geometry-utils.ts (Single Source of Truth)
 *
 * @deprecated Use calculateBoundingBox from geometry-utils.ts directly
 * This alias is kept for backward compatibility
 */
export { calculateBoundingBox as calculateVerticesBounds };

/**
 * Debug helper to log segment endpoints
 */
export function debugSegments(segs: Segment[], label: string): void {

  segs.forEach((seg, i) => {

  });
}