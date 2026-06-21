/**
 * overlay-line-style — SINGLE SOURCE OF TRUTH for every drawing-overlay GUIDE LINE drawn on
 * the PreviewCanvas: alignment traces (ίχνη ευθυγράμμισης), the polar tracking line, and the
 * wall-ghost listening dimensions. Giorgio (2026-06-21): «όλες ίδιο πάχος, ίδιος τύπος γραμμής,
 * ίδιες αποστάσεις διακεκομμένης, παντού διακεκομμένες, όλες ίδιος κώδικας».
 *
 * One width + one dash pattern (screen-px, since every overlay strokes in screen space). Colour
 * stays per-caller (semantic: alignment vs polar vs dimension). Adopt `applyOverlayLineStyle`
 * in ANY new overlay line so the look never diverges again.
 */

/** Stroke width (CSS px) for ALL overlay guide lines. */
export const OVERLAY_LINE_WIDTH_PX = 0.5;

/** Dash pattern (CSS px, [dash, gap]) for ALL overlay guide lines. */
export const OVERLAY_LINE_DASH: readonly number[] = [8, 5];

/**
 * Apply the canonical overlay-guide-line stroke (width + dash + butt cap) for `color` to `ctx`.
 * Call immediately before `ctx.stroke()`. Does NOT save/restore — the caller owns ctx state.
 */
export function applyOverlayLineStyle(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = OVERLAY_LINE_WIDTH_PX;
  ctx.setLineDash([...OVERLAY_LINE_DASH]);
  ctx.lineCap = 'butt';
}
