/**
 * Shared canvas pill-label drawing utilities.
 *
 * Extracted from `useGripDimAnnotation` (ADR-363 Phase 4.5c.5) so that
 * both the grip-drag annotation hook and the column permanent-label renderer
 * (Phase 8F) share identical visual constants.
 *
 * Pure canvas helpers — no React, no stores (ADR-040 compliant).
 */

export const PILL_FONT = '9px sans-serif';
export const PILL_TEXT_COLOR = 'rgba(0,0,0,0.75)';
export const PILL_BG_COLOR = 'rgba(255,255,255,0.88)';
export const PILL_PADDING = 3;
export const PILL_RADIUS = 3;

/**
 * Draws a rounded-rectangle (pill) path on `ctx`.
 * Caller is responsible for `fill()` / `stroke()` after calling this.
 */
export function pillPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
