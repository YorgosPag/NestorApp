/**
 * crosshair-cursor-image — build a CAD crosshair as a CSS hardware cursor (ADR-549 Phase 8).
 *
 * The OS/hardware cursor (e.g. the ViewCube «hand») is drawn on a GPU cursor plane, fully
 * decoupled from page rendering → ZERO latency, perfect 1:1 with the mouse. No web canvas/DOM
 * (even `desynchronized`) can match it, because anything the page paints goes through the
 * compositor present at least once. The only way to get hand-level 1:1 tracking on the web is
 * to make the crosshair ITSELF a hardware cursor — a `cursor: url(<image>) hotX hotY, …` value.
 * This is the Figma / Google-tools pattern (they rely on the OS/CSS cursor, never a canvas one).
 *
 * RASTERISED PNG, not SVG: Chrome rejects SVG data-URL cursors (works in Firefox, NOT Chrome —
 * browser-verified 2026-06-29). A PNG data URL (drawn on an offscreen canvas) is the only form
 * supported by ALL browsers as a cursor. We draw the crosshair once per settings change and reuse
 * the PNG; the POSITION is handled by the OS → 1:1.
 *
 * Trade-off (web platform limit): a CSS cursor is a BOUNDED image (~128px max in Chrome), so the
 * arms cannot reach the viewport edges (no full-screen crosshair) and the centre cannot «snap-glue»
 * (a hardware cursor is always at the true pointer). The snap MARKER overlay still highlights snaps.
 *
 * @module systems/cursor/crosshair-cursor-image
 */

/** Max CSS cursor side (px). Chrome rejects images larger than 128×128 → falls back to `crosshair`. */
const MAX_CURSOR_PX = 128;

export interface CrosshairCursorOptions {
  /** Stroke colour (any CSS colour). */
  readonly color: string;
  /** Arm line width (CSS px). */
  readonly lineWidth?: number;
  /** Total image side (CSS px); clamped to ≤128. The arms reach the image edge. */
  readonly size?: number;
  /** Half-gap (CSS px) left empty around the centre (the AutoCAD hole). */
  readonly gap?: number;
  /** Centre pickbox/aperture side (CSS px); 0 ⇒ no box. */
  readonly pickbox?: number;
  /** Opacity 0..1 (default 1). */
  readonly opacity?: number;
}

/** Draw the crosshair onto a 2D context sized `size`×`size` (centre `c`). Pure pixels, no clear-state. */
function drawCrosshair(ctx: CanvasRenderingContext2D, o: Required<Omit<CrosshairCursorOptions, never>>): void {
  const { size, gap, lineWidth: lw, pickbox: pb, color, opacity } = o;
  const c = size / 2;
  // +0.5 on the cross axis keeps an odd-width line crisp.
  const ax = Math.round(c) + (lw % 2 ? 0.5 : 0);
  ctx.clearRect(0, 0, size, size);
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(0, ax); ctx.lineTo(c - gap, ax);
  ctx.moveTo(c + gap, ax); ctx.lineTo(size, ax);
  ctx.moveTo(ax, 0); ctx.lineTo(ax, c - gap);
  ctx.moveTo(ax, c + gap); ctx.lineTo(ax, size);
  ctx.stroke();
  if (pb > 0) {
    ctx.lineWidth = 1;
    ctx.strokeRect(c - pb / 2, c - pb / 2, pb, pb);
  }
}

/**
 * Build a `cursor` CSS value: a crosshair PNG data-URL with the hotspot at its centre, plus a
 * `crosshair` keyword fallback. Apply with `element.style.cursor = buildCrosshairCursorValue(...)`.
 * Returns the bare `crosshair` keyword when no canvas is available (SSR / test env).
 */
export function buildCrosshairCursorValue(opts: CrosshairCursorOptions): string {
  const size = Math.max(16, Math.min(opts.size ?? 96, MAX_CURSOR_PX));
  const c = size / 2;
  if (typeof document === 'undefined') return 'crosshair';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'crosshair';
  drawCrosshair(ctx, {
    color: opts.color,
    lineWidth: opts.lineWidth ?? 1,
    size,
    gap: Math.max(0, opts.gap ?? 6),
    pickbox: Math.max(0, opts.pickbox ?? 0),
    opacity: opts.opacity ?? 1,
  });
  return `url("${canvas.toDataURL('image/png')}") ${c} ${c}, crosshair`;
}
