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
 * WCAG 1.4.3 — picks black (`PILL_TEXT_COLOR`) or white based on the relative
 * luminance of `bgColor`. Guarantees readable text regardless of user-chosen
 * pill background. Parses `rgba(...)` / `rgb(...)` / `#rrggbb` / `#rgb`.
 * Falls back to `PILL_TEXT_COLOR` (dark) when the colour cannot be parsed.
 */
export function contrastTextColor(bgColor: string): string {
  const rgb = parseColorRgb(bgColor);
  if (!rgb) return PILL_TEXT_COLOR;
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  // Threshold 0.179: equal-contrast switching point between black and white text.
  return L > 0.179 ? PILL_TEXT_COLOR : '#ffffff';
}

function parseColorRgb(color: string): { r: number; g: number; b: number } | null {
  const rgba = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgba) return { r: +rgba[1]!, g: +rgba[2]!, b: +rgba[3]! };
  const h6 = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (h6) return { r: parseInt(h6[1]!, 16), g: parseInt(h6[2]!, 16), b: parseInt(h6[3]!, 16) };
  const h3 = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (h3) return { r: parseInt(h3[1]! + h3[1]!, 16), g: parseInt(h3[2]! + h3[2]!, 16), b: parseInt(h3[3]! + h3[3]!, 16) };
  return null;
}

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
