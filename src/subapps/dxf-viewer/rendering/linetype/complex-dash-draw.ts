/**
 * Complex-stroke drawing primitives — ADR-642 §6.4 (canvas ops for the Φ1 stroker).
 *
 * Ζωγραφίζει ΕΝΑ dash (σταθερού ή μεταβλητού πλάτους #8) ή ΜΙΑ τελεία, με το σωστό
 * cap (#5), πάνω σε ήδη υπολογισμένη υπο-διαδρομή screen-space. Καθαρά ctx ops —
 * ο caller κάνει το save/restore/strokeStyle (ADR-040 leaf-safe helpers).
 */

import type { DashCap } from '../../config/complex-linetype-types';
import {
  buildSegments,
  cumulativeLengths,
  pointAt,
  totalLength,
  type Point,
} from './complex-stroke-geometry';

/** DXF/model cap → canvas `lineCap`. */
function toCanvasCap(cap: DashCap | undefined): CanvasLineCap {
  return cap === 'round' ? 'round' : cap === 'square' ? 'square' : 'butt';
}

/** Στοιχειώδες ορατό μήκος (px) για dot/degenerate dash — καθρέφτης του `MIN_DOT_PX`. */
export const MIN_MARK_PX = 0.5;

/**
 * Χαράζει μια polyline ως canvas path (`beginPath`+`moveTo`+`lineTo` loop) ΧΩΡΙΣ
 * stroke/fill — SSoT ώστε ο stroker και το dash-draw να μην κλωνοποιούν τον βρόχο.
 * Ο caller κάνει το `stroke()`/`fill()` με το δικό του style.
 */
export function tracePolylinePath(ctx: CanvasRenderingContext2D, pts: readonly Point[]): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
}

/** Στρώνει μια υπο-διαδρομή ως dash σταθερού πλάτους με το δοσμένο cap. */
export function strokeDashSubpath(
  ctx: CanvasRenderingContext2D,
  pts: readonly Point[],
  widthPx: number,
  cap: DashCap | undefined,
): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = Math.max(widthPx, MIN_MARK_PX);
  ctx.lineCap = toCanvasCap(cap);
  tracePolylinePath(ctx, pts);
  ctx.stroke();
  ctx.restore();
}

/**
 * Στρώνει μια τελεία: ένα μηδενικού μήκους στίγμα στο `p`, προσανατολισμένο κατά την
 * εφαπτομένη ώστε τα round/square caps να δίνουν κουκκίδα/τετραγωνάκι.
 */
export function drawDot(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; ux: number; uy: number },
  widthPx: number,
  cap: DashCap | undefined,
): void {
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = Math.max(widthPx, MIN_MARK_PX);
  ctx.lineCap = toCanvasCap(cap ?? 'round');
  const eps = MIN_MARK_PX * 0.5;
  ctx.beginPath();
  ctx.moveTo(p.x - p.ux * eps, p.y - p.uy * eps);
  ctx.lineTo(p.x + p.ux * eps, p.y + p.uy * eps);
  ctx.stroke();
  ctx.restore();
}

/**
 * Στρώνει ένα dash ΜΕΤΑΒΛΗΤΟΥ πλάτους (#8): γεμίζει μια λωρίδα της οποίας το μισό
 * πλάτος ανά σταθμό = `baseWidthPx/2 × profile[k]`. Δειγματοληπτεί την υπο-διαδρομή
 * σε `profile.length` σταθμούς κατά μήκος τόξου και υπολογίζει normal ανά σταθμό.
 */
export function fillTaperedDash(
  ctx: CanvasRenderingContext2D,
  pts: readonly Point[],
  baseWidthPx: number,
  profile: readonly number[],
): void {
  const segs = buildSegments(pts);
  const stations = profile.length;
  if (segs.length === 0 || stations < 2) {
    strokeDashSubpath(ctx, pts, baseWidthPx, 'butt');
    return;
  }
  const cum = cumulativeLengths(segs);
  const total = totalLength(segs);
  const left: Point[] = [];
  const right: Point[] = [];
  for (let k = 0; k < stations; k++) {
    const s = pointAt(segs, cum, (k / (stations - 1)) * total);
    const half = (baseWidthPx / 2) * Math.max(profile[k], 0);
    const nx = -s.uy;
    const ny = s.ux;
    left.push({ x: s.x + nx * half, y: s.y + ny * half });
    right.push({ x: s.x - nx * half, y: s.y - ny * half });
  }
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let k = 1; k < left.length; k++) ctx.lineTo(left[k].x, left[k].y);
  for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k].x, right[k].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
