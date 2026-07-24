/**
 * marquee-screen-geometry.ts — τα screen-space primitives που μοιράζονται ΚΑΙ ΟΙ ΔΥΟ
 * 3D marquee διαδρομές (ADR-692): το BIM AABB test (`marquee-3d-hit-test`) και το raw-DXF
 * wireframe test (`dxf-marquee-3d-hit-test`).
 *
 * Καμία νέα γεωμετρία: το crossing delegate-άρει στο 2D marquee SSoT
 * (`polygonIntersectsRectangle` / `lineIntersectsRectangle` του `universal-marquee-geometry`)
 * και στο `SpatialUtils.pointInRect` (ADR-089). Εδώ ζει μόνο η ΕΠΙΛΟΓΗ ποιο test ταιριάζει
 * σε κλειστό vs ανοιχτό σχήμα — γιατί ένα ΑΝΟΙΧΤΟ πολύγραμμο (γραμμή, τόξο) ΔΕΝ είναι
 * πολύγωνο: το `isPointInPolygon` θα το «έκλεινε» νοητά και ένα L-σχήμα θα μάζευε ψευδώς
 * ένα ορθογώνιο που κάθεται στην κοιλιά του.
 *
 * Pure — no THREE, no React. Jest-friendly.
 */

import type { Point2D } from '../../../rendering/types/Types';
import { SpatialUtils } from '../../../core/spatial/SpatialUtils';
import {
  polygonIntersectsRectangle,
  lineIntersectsRectangle,
} from '../../../systems/selection/universal-marquee-geometry';

/** Ορθογώνιο σε screen px (client coords) — η ίδια μορφή που περιμένει το 2D marquee SSoT. */
export interface ScreenRect {
  min: Point2D;
  max: Point2D;
}

/**
 * Το axis-aligned ορθογώνιο του marquee από την άγκυρα drag + τον τρέχοντα δείκτη (CLIENT px).
 * Ένας SSoT — και οι δύο 3D marquee διαδρομές (BIM AABB + raw-DXF wireframe) χτίζουν το ίδιο
 * rect έτσι, αντί για δίδυμα inline `Math.min/max` (ADR-583 anti-clone).
 */
export function screenRectFromPoints(startPt: Point2D, endPt: Point2D): ScreenRect {
  return {
    min: { x: Math.min(startPt.x, endPt.x), y: Math.min(startPt.y, endPt.y) },
    max: { x: Math.max(startPt.x, endPt.x), y: Math.max(startPt.y, endPt.y) },
  };
}

/** Το axis-aligned screen bbox μιας νέφους σημείων. Κενή είσοδος ⇒ null. */
export function screenBounds(points: readonly Point2D[]): ScreenRect | null {
  if (points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

/**
 * CROSSING test: «αγγίζει» το πολύγραμμο το ορθογώνιο;
 *
 * `closed === true` (κύκλος, κλειστή polyline, κουτί κειμένου, convex hull ενός AABB) →
 * πλήρες polygon-vs-rect (κορυφή μέσα ⋁ ακμή τέμνει ⋁ το ορθογώνιο ΟΛΟΚΛΗΡΟ μέσα στο σχήμα).
 * `closed === false` (γραμμή, τόξο, ανοιχτή polyline) → σημείο-μέσα ⋁ τμήμα-τέμνει, ΧΩΡΙΣ
 * το containment σκέλος (δεν υπάρχει «μέσα» σε ανοιχτό σχήμα).
 */
export function polylineIntersectsRect(
  points: readonly Point2D[],
  closed: boolean,
  rect: ScreenRect,
): boolean {
  if (points.length === 0) return false;
  if (points.length === 1) return SpatialUtils.pointInRect(points[0], rect);
  if (closed && points.length >= 3) return polygonIntersectsRectangle([...points], rect);

  for (const p of points) {
    if (SpatialUtils.pointInRect(p, rect)) return true;
  }
  for (let i = 0; i < points.length - 1; i++) {
    if (lineIntersectsRectangle(points[i], points[i + 1], rect)) return true;
  }
  return false;
}

/** Ανοχή (px) κάτω από την οποία δύο σημεία θεωρούνται ΤΟ ΙΔΙΟ ⇒ το πολύγραμμο είναι κλειστό. */
const CLOSURE_EPS_PX = 1e-6;

/**
 * Είναι το πολύγραμμο κλειστό; Οι samplers του 3D DXF (`circlePolyline`,
 * `dxfEntityOutlineSegments` για closed polyline / text box) επαναλαμβάνουν ΡΗΤΑ το πρώτο
 * σημείο στο τέλος — αυτό είναι το σήμα «κλειστό», όχι ένα ξεχωριστό flag που θα έπρεπε να
 * ταξιδέψει παράλληλα με τα σημεία (και να ξεσυγχρονιστεί).
 */
export function isClosedPolyline(points: readonly Point2D[]): boolean {
  if (points.length < 3) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return Math.abs(first.x - last.x) <= CLOSURE_EPS_PX && Math.abs(first.y - last.y) <= CLOSURE_EPS_PX;
}
