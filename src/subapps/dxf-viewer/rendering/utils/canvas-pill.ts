/**
 * Shared canvas pill-label drawing utilities.
 *
 * Extracted from `useGripDimAnnotation` (ADR-363 Phase 4.5c.5) so that
 * both the grip-drag annotation hook and the column permanent-label renderer
 * (Phase 8F) share identical visual constants.
 *
 * Pure canvas helpers — no React, no stores (ADR-040 compliant).
 *
 * @see ../../config/color-math — colour parse + WCAG luminance SSoT (ADR-694 Φ10)
 */

import { parseColor, srgbRelativeLuminance } from '../../config/color-math';

export const PILL_FONT = '9px sans-serif';
/**
 * Larger, Revit-grade font for BIM **dimension** pills (hover/select centred
 * label + live grip-drag annotation). SSoT consumed by `bim/labels/bim-dim-labels`
 * (`drawDimPill`) and `hooks/tools/useGripDimAnnotation`. Kept separate from
 * `PILL_FONT` so opening Mark tags (their own configurable font) stay unaffected.
 */
export const PILL_DIM_FONT = '12px sans-serif';
/** Line height matched to `PILL_DIM_FONT` for multi-line centred dim pills. */
export const PILL_DIM_LINE_HEIGHT = 15;
export const PILL_TEXT_COLOR = 'rgba(0,0,0,0.75)';
export const PILL_BG_COLOR = 'rgba(255,255,255,0.88)';
export const PILL_PADDING = 3;
export const PILL_RADIUS = 3;

/**
 * WCAG 1.4.3 — picks black (`PILL_TEXT_COLOR`) or white based on the relative
 * luminance of `bgColor`. Guarantees readable text regardless of user-chosen
 * pill background. Parses `rgba(...)` / `rgb(...)` / `#rrggbb` / `#rgb`.
 * Falls back to `PILL_TEXT_COLOR` (dark) when the colour cannot be parsed.
 *
 * ADR-694 Φ10 — both the parse and the luminance now come from the `color-math`
 * SSoT. This file previously carried a private `parseColorRgb` (a strict subset
 * of `parseColor`) plus its own inline sRGB linearisation; both are gone.
 *
 * Alpha is deliberately ignored: the pill is painted over arbitrary canvas
 * content, so there is no known backdrop to composite against. The decision is
 * made on the pill's own base colour — unchanged from the original behaviour.
 */
export function contrastTextColor(bgColor: string): string {
  const rgb = parseColor(bgColor);
  if (!rgb) return PILL_TEXT_COLOR;
  // Threshold 0.179: equal-contrast switching point between black and white text.
  return srgbRelativeLuminance(rgb) > 0.179 ? PILL_TEXT_COLOR : '#ffffff';
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
