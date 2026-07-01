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
 * ⚠️ DEVICE-SIZE CAP (why the crosshair used to VANISH on HiDPI / page-zoom): Windows/Chrome
 * SILENTLY REJECT a hardware cursor whose PHYSICAL (device-pixel) size exceeds ~32px. When that
 * happens the WHOLE `cursor` declaration is dropped and the element's class cursor wins — and the
 * container's class is `cursor-none`/`cursor-crosshair`, so the crosshair disappears. A 32px CSS
 * image at devicePixelRatio 1.5 is 48 device px → rejected. So we keep the DEVICE size ≤ cap on
 * EVERY dpr by shrinking the CSS size (the crosshair gets a little smaller on very HiDPI, which is
 * the accepted trade-off for never vanishing), and we rasterise at the physical size via `image-set`
 * so it stays crisp. Callers must re-invoke on dpr change (see `subscribeDevicePixelRatio`).
 *
 * Trade-off (web platform limit): a CSS cursor is a BOUNDED image, so the arms cannot reach the
 * viewport edges (no full-screen crosshair) and the centre cannot «snap-glue» (a hardware cursor is
 * always at the true pointer). The snap MARKER overlay still highlights snaps.
 *
 * @module systems/cursor/crosshair-cursor-image
 */

import { getDevicePixelRatio, toDevicePixels } from './utils';

/**
 * Max cursor side in DEVICE pixels. Windows/Chrome silently reject a hardware cursor larger than
 * this → the whole `cursor` declaration drops and the element's class cursor takes over ⇒ the
 * crosshair vanishes. Browser-verified (ADR-549 Phase 8). Keeping the device size ≤ this on every
 * dpr guarantees the cursor is NEVER rejected on HiDPI monitors or with browser page-zoom.
 */
const MAX_CURSOR_DEVICE_PX = 32;

/** Smallest CSS side we ever render (keeps the crosshair usable at extreme dpr). */
const MIN_CURSOR_CSS_PX = 8;

export interface CrosshairCursorOptions {
  /** Stroke colour (any CSS colour). */
  readonly color: string;
  /** Arm line width (CSS px). */
  readonly lineWidth?: number;
  /** Requested image side (CSS px); shrunk automatically so the DEVICE size stays ≤ cap. */
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
 *
 * DPR-aware: the CSS size is shrunk so the physical (device-pixel) image never exceeds the
 * hardware-cursor cap (so the browser never rejects it → the crosshair never vanishes), and the
 * PNG is rasterised at the physical size and declared via `image-set(... Nx)` so it stays crisp.
 * Returns the bare `crosshair` keyword when no canvas is available (SSR / test env).
 */
export function buildCrosshairCursorValue(opts: CrosshairCursorOptions): string {
  if (typeof document === 'undefined') return 'crosshair';
  const dpr = getDevicePixelRatio();
  // Shrink the CSS size so `cssSize * dpr` (the device size) never exceeds the cap.
  const maxCssForDevice = MAX_CURSOR_DEVICE_PX / dpr;
  const cssSize = Math.max(MIN_CURSOR_CSS_PX, Math.min(opts.size ?? 32, maxCssForDevice));
  const devicePx = Math.min(toDevicePixels(cssSize, dpr), MAX_CURSOR_DEVICE_PX);
  const hot = Math.round(cssSize / 2);

  const canvas = document.createElement('canvas');
  canvas.width = devicePx;
  canvas.height = devicePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'crosshair';
  // Draw in CSS-px coordinates onto the physical-px backing store → crisp on HiDPI.
  const scale = devicePx / cssSize;
  ctx.scale(scale, scale);
  drawCrosshair(ctx, {
    color: opts.color,
    lineWidth: opts.lineWidth ?? 1,
    size: cssSize,
    gap: Math.max(0, opts.gap ?? 6),
    pickbox: Math.max(0, opts.pickbox ?? 0),
    opacity: opts.opacity ?? 1,
  });

  const dataUrl = canvas.toDataURL('image/png');
  // dpr > 1 → declare the physical raster as `Nx` so the browser shows it at `cssSize` CSS px
  // (crisp). dpr == 1 → a plain `url()` (maximum compatibility). Both keep the `crosshair` keyword
  // fallback so a native crosshair shows if the url token is ever ignored.
  return dpr > 1
    ? `image-set(url("${dataUrl}") ${dpr}x) ${hot} ${hot}, crosshair`
    : `url("${dataUrl}") ${hot} ${hot}, crosshair`;
}
