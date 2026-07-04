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
 * READOUT-LEADER family (ADR-363) — sibling of the guide-line style above, for the discreet
 * connector lines that tie a live ghost/readout to its anchor (hot-grip rubber-band, rotate-reference
 * guides, move-distance leader). Intentionally DISTINCT from the alignment-trace guide style so leaders
 * read as "Revit-grade subtle connectors", not tracking traces: a tighter dash + a hairline-plus width.
 * Kept here so leader dash/width live in the SAME overlay-style SSoT as the guide lines — one file owns
 * every overlay-line look. Colour stays per-caller (semantic: ghost-cyan rubber-band vs neutral leader).
 */
/** Dash pattern (CSS px) for READOUT-LEADER lines — tighter than the guide-line dash. */
export const OVERLAY_LEADER_DASH: readonly number[] = [6, 4];

/** Stroke width (CSS px) for READOUT-LEADER lines — a touch heavier than the 0.5 guide hairline. */
export const OVERLAY_LEADER_WIDTH_PX = 1;

/**
 * SSoT colours per overlay MECHANISM (Giorgio 2026-06-21 — «κάθε μηχανισμός διαφορετικό χρώμα»):
 *   - `alignment`     LIGHT GREY — alignment traces (ίχνη ευθυγράμμισης) + their tooltip; kept
 *                     neutral so they don't clash with the GREEN snap-point labels («ΓΩΝΙΑ ΤΟΙΧΟΥ»)
 *   - `drawingGuide`  ORANGE     — wall-tool drawing guide (polar / face-relative slope line)
 *   - `listeningDim`  CYAN       — wall-ghost listening dimensions (lines + numbers)
 *   - `moveLeader`    SEMI-WHITE — ADR-363 discreet move-distance readout leader; semi-transparent so
 *                     it stays subtle yet visible on the pure-black AutoCAD canvas (a black leader
 *                     would be invisible). Used with the READOUT-LEADER style (`applyOverlayLeaderStyle`).
 * One place owns the palette so the families never collide or drift.
 */
export const OVERLAY_LINE_COLORS = {
  alignment: '#CCCCCC',
  drawingGuide: '#FF9800',
  listeningDim: '#29B6F6',
  moveLeader: 'rgba(255,255,255,0.5)',
} as const;

/**
 * Shared stroke core for BOTH overlay-line families (guide-line + leader): strokeStyle + width + dash +
 * butt cap. The ONE place that touches ctx stroke state, so the two public helpers below cannot drift.
 * Does NOT save/restore — the caller owns ctx state.
 */
function applyOverlayStroke(
  ctx: CanvasRenderingContext2D, color: string, widthPx: number, dash: readonly number[],
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = widthPx;
  ctx.setLineDash([...dash]);
  ctx.lineCap = 'butt';
}

/**
 * Apply the canonical overlay-guide-line stroke (width + dash + butt cap) for `color` to `ctx`.
 * Call immediately before `ctx.stroke()`. Does NOT save/restore — the caller owns ctx state.
 */
export function applyOverlayLineStyle(ctx: CanvasRenderingContext2D, color: string): void {
  applyOverlayStroke(ctx, color, OVERLAY_LINE_WIDTH_PX, OVERLAY_LINE_DASH);
}

/**
 * Apply the canonical READOUT-LEADER stroke (leader dash + leader width + butt cap) for `color` to
 * `ctx` — the SSoT for the discreet ADR-363 connector lines (hot-grip rubber-band / rotate-reference
 * guide / move-distance leader). Sibling of {@link applyOverlayLineStyle} with the leader dash/width
 * instead of the guide-line ones. Call immediately before `ctx.stroke()`. Does NOT save/restore — the
 * caller owns ctx state.
 */
export function applyOverlayLeaderStyle(ctx: CanvasRenderingContext2D, color: string): void {
  applyOverlayStroke(ctx, color, OVERLAY_LEADER_WIDTH_PX, OVERLAY_LEADER_DASH);
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
