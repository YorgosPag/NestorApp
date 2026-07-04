/**
 * GEOMETRY ARC UTILITIES
 * ADR-065: Extracted from geometry-utils.ts — Arc construction and measurement
 */

import type { Point2D } from '../../types/Types';
// 🏢 ADR-065: Centralized Distance Calculation & Angle Calculation
import { calculateDistance, calculateAngle } from './geometry-rendering-utils';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../../primitives/canvasPaths';
// 🏢 ADR-065: Extracted circle construction
import { circleFrom3Points } from './geometry-circle-utils';
// 🏢 ADR-065: Extracted angle utilities
import { degToRad, radToDeg, normalizeAngleDiff, normalizeAngleRad } from './geometry-angle-utils';

// ===== ARC GEOMETRY =====

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate arc from 3 points - ADR-059
 * Uses circumcircle calculation + angle determination
 *
 * The arc will pass through all 3 points: start → mid → end
 *
 * @param start - Start point of the arc
 * @param mid - Point on the arc (between start and end)
 * @param end - End point of the arc
 * @returns Arc definition with center, radius, angles in DEGREES, and counterclockwise flag
 */
export function arcFrom3Points(
  start: Point2D,
  mid: Point2D,
  end: Point2D
): { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise: boolean } | null {
  // Use circumcircle calculation
  const circle = circleFrom3Points(start, mid, end);
  if (!circle) return null;

  const { center, radius } = circle;

  // Calculate angles for all 3 points (in radians)
  // 🏢 ADR-065: Use centralized calculateAngle
  const startAngleRad = calculateAngle(center, start);
  const midAngleRad = calculateAngle(center, mid);
  const endAngleRad = calculateAngle(center, end);

  // 🏢 ENTERPRISE: Determine arc direction using angular sweep
  // In Canvas 2D, anticlockwise=false draws CLOCKWISE from startAngle to endAngle
  // We need to check if going clockwise from start includes mid before reaching end

  // Helper: Calculate clockwise angular distance from angle 'from' to angle 'to'
  const clockwiseDistance = (from: number, to: number): number => {
    let diff = to - from;
    // Normalize to [0, 2π) for clockwise distance
    while (diff < 0) diff += TAU;
    while (diff >= TAU) diff -= TAU;
    return diff;
  };

  // Distance from start to mid going clockwise
  const startToMidCW = clockwiseDistance(startAngleRad, midAngleRad);
  // Distance from start to end going clockwise
  const startToEndCW = clockwiseDistance(startAngleRad, endAngleRad);

  // If startToMidCW < startToEndCW, then mid is on the CLOCKWISE arc from start to end
  // This means we should use anticlockwise=false (draw clockwise)
  const isMidOnCWArc = startToMidCW < startToEndCW;

  // Convert to degrees
  const startAngleDeg = radToDeg(startAngleRad);
  const endAngleDeg = radToDeg(endAngleRad);

  return {
    center,
    radius,
    startAngle: startAngleDeg,
    endAngle: endAngleDeg,
    // counterclockwise=false means draw clockwise; true means draw counterclockwise
    counterclockwise: !isMidOnCWArc
  };
}

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate arc from center, start, end points - ADR-059
 *
 * The arc direction (clockwise/counterclockwise) is determined by the
 * angular direction from start to end - AutoCAD pattern!
 * This allows the user to control the arc side by moving the mouse
 * clockwise or counterclockwise around the center.
 *
 * @param center - Center point of the arc
 * @param start - Start point on the arc circumference
 * @param end - End point (or cursor position) - direction determines arc side
 * @returns Arc definition with center, radius, angles in DEGREES, and counterclockwise flag
 */
export function arcFromCenterStartEnd(
  center: Point2D,
  start: Point2D,
  end: Point2D
): { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise: boolean } {
  const radius = calculateDistance(center, start);

  // Calculate angles
  // 🏢 ADR-065: Use centralized calculateAngle
  const startAngleRad = calculateAngle(center, start);
  const endAngleRad = calculateAngle(center, end);

  // 🏢 ENTERPRISE: Calculate angular direction (AutoCAD pattern)
  // Determine if user moved counterclockwise or clockwise from start to end
  // 🏢 ADR-134: Use centralized angle difference normalization
  const angleDiff = normalizeAngleDiff(endAngleRad - startAngleRad);

  // If angleDiff > 0, user moved counterclockwise (CCW) → draw CCW arc
  // If angleDiff < 0, user moved clockwise (CW) → draw CW arc
  const counterclockwise = angleDiff > 0;

  return {
    center,
    radius,
    startAngle: radToDeg(startAngleRad),
    endAngle: radToDeg(endAngleRad),
    counterclockwise
  };
}

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate arc from start, center, end points - ADR-059
 * Same as centerStartEnd but with different input order
 *
 * @param start - Start point on the arc circumference
 * @param center - Center point of the arc
 * @param end - End point on the arc circumference
 * @returns Arc definition with center, radius, angles in DEGREES, and counterclockwise flag
 */
export function arcFromStartCenterEnd(
  start: Point2D,
  center: Point2D,
  end: Point2D
): { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise: boolean } {
  return arcFromCenterStartEnd(center, start, end);
}

/**
 * ADR-398 §3.12 — η **ΦΑΝΕΡΗ** πλευρά ενός τόξου ως CCW εύρος `[start→end]` (μοίρες). **ΕΝΑ SSoT**
 * για τη φορά του τόξου, μοιραζόμενο από hit-test (`hitTestArcEntity`) ΚΑΙ tessellation των snap
 * targets (`arcTargets`) — ώστε η κολώνα να κουμπώνει στην ΙΔΙΑ (ορατή) πλευρά που χτυπιέται/σχεδιάζεται.
 *
 * **Γιατί swap:** ο `ArcRenderer`→`addArcPath` ζωγραφίζει με Y-flip (`screenCCW = !counterclockwise`),
 * οπότε στον world χώρο `counterclockwise===true` ⇒ το τόξο σχεδιάζεται **CW** ⇒ το ορατό CCW εύρος
 * είναι `[endAngle→startAngle]` (ανεστραμμένο). Αλλιώς (false/undefined, default) ⇒ `[startAngle→endAngle]`.
 * Επιστρέφει **ακανόνιστες** μοίρες (ο caller κανονικοποιεί όπως χρειάζεται).
 */
export function arcVisibleCcwRange(
  startAngle: number,
  endAngle: number,
  counterclockwise?: boolean,
): { start: number; end: number } {
  return counterclockwise === true
    ? { start: endAngle, end: startAngle }
    : { start: startAngle, end: endAngle };
}

/**
 * 🏢 ENTERPRISE SSoT — bulge-preserving single-endpoint arc reshape (ADR-349 / ADR-537).
 *
 * Drag ONE arc endpoint by `(dx, dy)` while the OTHER endpoint stays put; the included
 * (signed) sweep angle is preserved and the centre / radius / angles are recomputed so the
 * new arc still passes through both endpoints on the SAME geometric side as before. This is
 * the SSoT for BOTH the 2D/3D commit (`stretchArcSingleEndpoint`) and the 3D live ghost
 * (`buildDxfGhostSegments`) — preview ≡ commit.
 *
 * Angles are in DEGREES in and out (matching `ArcEntity` / the DXF scene); the trig runs in
 * radians internally. Returns null for degenerate input (zero/full sweep, collapsed chord).
 *
 * @param arc    centre / radius / start+end angles (DEGREES)
 * @param moved  which endpoint the cursor drags
 * @param dx,dy  endpoint displacement (plan units)
 */
export function arcFromMovedEndpoint(
  arc: { center: Point2D; radius: number; startAngle: number; endAngle: number },
  moved: 'start' | 'end',
  dx: number,
  dy: number,
): { center: Point2D; radius: number; startAngle: number; endAngle: number } | null {
  const a0 = degToRad(arc.startAngle);
  const a1 = degToRad(arc.endAngle);
  const pStartOld = { x: arc.center.x + arc.radius * Math.cos(a0), y: arc.center.y + arc.radius * Math.sin(a0) };
  const pEndOld = { x: arc.center.x + arc.radius * Math.cos(a1), y: arc.center.y + arc.radius * Math.sin(a1) };
  const pStartNew = moved === 'start' ? { x: pStartOld.x + dx, y: pStartOld.y + dy } : pStartOld;
  const pEndNew = moved === 'end' ? { x: pEndOld.x + dx, y: pEndOld.y + dy } : pEndOld;

  const theta = a1 - a0; // signed sweep (radians)
  if (Math.abs(theta) < 1e-9) return null; // degenerate
  if (Math.abs(theta) >= TAU - 1e-9) return null; // full circle

  const vx = pEndNew.x - pStartNew.x;
  const vy = pEndNew.y - pStartNew.y;
  const L = Math.hypot(vx, vy);
  if (L < 1e-9) return null; // chord collapsed

  const sinHalf = Math.sin(Math.abs(theta) / 2);
  if (sinHalf < 1e-9) return null;
  const newRadius = L / (2 * sinHalf);

  // Keep the original geometric side of the centre relative to the chord (preserves bulge
  // convention regardless of CW/CCW).
  const oldCross = (pEndOld.x - pStartOld.x) * (arc.center.y - pStartOld.y)
    - (pEndOld.y - pStartOld.y) * (arc.center.x - pStartOld.x);
  const side = oldCross >= 0 ? 1 : -1;

  const distSq = newRadius * newRadius - (L / 2) * (L / 2);
  const dist = distSq > 0 ? Math.sqrt(distSq) : 0;
  const perpX = -vy / L;
  const perpY = vx / L;
  const mx = (pStartNew.x + pEndNew.x) / 2;
  const my = (pStartNew.y + pEndNew.y) / 2;
  const newCenter: Point2D = { x: mx + side * dist * perpX, y: my + side * dist * perpY };

  const newStart = Math.atan2(pStartNew.y - newCenter.y, pStartNew.x - newCenter.x);
  let newEnd = Math.atan2(pEndNew.y - newCenter.y, pEndNew.x - newCenter.x);
  let sweep = newEnd - newStart; // preserve signed sweep (atan2 collapses to (-π, π])
  if (theta > 0 && sweep < 0) sweep += TAU;
  else if (theta < 0 && sweep > 0) sweep -= TAU;
  newEnd = newStart + sweep;

  return { center: newCenter, radius: newRadius, startAngle: radToDeg(newStart), endAngle: radToDeg(newEnd) };
}

/**
 * Tessellate an arc into `n+1` world-space points along its VISIBLE sweep. Angles are in
 * DEGREES (matching `ArcEntity` / the DXF scene); the traversed sweep is the CCW range from
 * {@link arcVisibleCcwRange} so it matches exactly what `ArcRenderer` draws (Y-flip aware).
 *
 * SSoT for overlay ghosts that must agree with the committed render — e.g. the FILLET preview
 * (ADR-510 Φ4e). Do NOT use the trim `tessellateArc`, which reads angles as RADIANS.
 */
export function tessellateArcDegrees(
  arc: { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean },
  n: number,
): Point2D[] {
  const { start, end } = arcVisibleCcwRange(arc.startAngle, arc.endAngle, arc.counterclockwise);
  const s = degToRad(start);
  let sweep = degToRad(end) - s;
  while (sweep < 0) sweep += TAU;
  while (sweep >= TAU) sweep -= TAU;
  const pts: Point2D[] = [];
  for (let i = 0; i <= n; i++) {
    const t = s + (sweep * i) / n;
    pts.push({ x: arc.center.x + arc.radius * Math.cos(t), y: arc.center.y + arc.radius * Math.sin(t) });
  }
  return pts;
}

/**
 * Calculate arc length
 */
export function calculateArcLength(radius: number, startAngle: number, endAngle: number): number {
  let sweepAngle = endAngle - startAngle;
  if (sweepAngle < 0) sweepAngle += TAU;
  return radius * sweepAngle;
}

/**
 * Check if angle is between start and end angles (handling wrap-around)
 */
export function isAngleBetween(angle: number, startAngle: number, endAngle: number): boolean {
  // 🏢 ADR-068: Use centralized angle normalization
  const testAngle = normalizeAngleRad(angle);
  const start = normalizeAngleRad(startAngle);
  const end = normalizeAngleRad(endAngle);

  if (start <= end) {
    return testAngle >= start && testAngle <= end;
  } else {
    return testAngle >= start || testAngle <= end;
  }
}
