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

import type { Point2D } from '../../rendering/types/Types';

/** Stroke width (CSS px) for ALL overlay guide lines. */
export const OVERLAY_LINE_WIDTH_PX = 0.5;

/** Dash pattern (CSS px, [dash, gap]) for ALL overlay guide lines. */
export const OVERLAY_LINE_DASH: readonly number[] = [8, 5];

/**
 * SSoT colours per overlay MECHANISM (Giorgio 2026-06-21 — «κάθε μηχανισμός διαφορετικό χρώμα»):
 *   - `alignment`     LIGHT GREY — alignment traces (ίχνη ευθυγράμμισης) + their tooltip; kept
 *                     neutral so they don't clash with the GREEN snap-point labels («ΓΩΝΙΑ ΤΟΙΧΟΥ»)
 *   - `drawingGuide`  ORANGE     — wall-tool drawing guide (polar / face-relative slope line)
 *   - `listeningDim`  CYAN       — wall-ghost listening dimensions (lines + numbers)
 * One place owns the palette so the families never collide or drift.
 */
export const OVERLAY_LINE_COLORS = {
  alignment: '#CCCCCC',
  drawingGuide: '#FF9800',
  listeningDim: '#29B6F6',
} as const;

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

/**
 * Stroke ΜΙΑ ευθεία γραμμή σε **screen-space** (η overlay line style προϋποτίθεται ήδη set μέσω
 * `applyOverlayLineStyle`). SSoT για όλους τους overlay painters (listening dims, polar disk) —
 * μηδέν διπλό `beginPath/moveTo/lineTo/stroke` ανά painter.
 */
export function strokeOverlaySegment(ctx: CanvasRenderingContext2D, a: Point2D, b: Point2D): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
