/**
 * DXF BITMAP CACHE — ANCHORED RASTER GEOMETRY (ADR-726 Φ3 / ADR-040 Phase XXII.B part 2)
 *
 * Pure geometry + policy for serving the cached entity raster at a transform that
 * DIFFERS from the one it was rasterised at ("anchor"). No DOM, no stores, no time.
 *
 * WHY THIS EXISTS (measured 2026-07-29, ADR-726 §6 Φ3):
 * `transform.scale/offsetX/offsetY` used to live INSIDE the bitmap cache key, so every
 * pan/zoom frame was a guaranteed MISS → a full 2.996-entity offscreen rebuild. Measured
 * cost: `frame:dxf-canvas` **min 32,7ms** — a FLOOR on every single frame, 98,3% of the
 * frame budget, ~12 FPS.
 *
 * THE FIX: the transform leaves the key. Both transforms are pure scale+translation
 * (no rotation — see `dxf-viewport-culling` coordinate convention), so the difference
 * between anchor and current is expressible as ONE `drawImage(src, dx,dy,dw,dh)`:
 *
 *   screen  = world * scale + offset            (renderer convention, both axes)
 *   raster  = world * sA    + (oA + overscan)   (offscreen render, anchor transform)
 *   ⇒ screen = k * raster + (oC − k·(oA + overscan)),  k = sC / sA
 *
 * Prior art: Google Maps / Figma / every software renderer — *project the raster during
 * the gesture, re-rasterise at rest*. Zero GPU (the target machine has none).
 *
 * ⚠️ ADR-040 cardinal rule #3 still holds: this REMOVES inputs from the cache key, it
 * never adds any. Hover/selection/grip state must stay out.
 *
 * @module canvas-v2/dxf-canvas/dxf-bitmap-cache-anchor
 * @see canvas-v2/dxf-canvas/dxf-bitmap-cache — the sole consumer
 * @see ADR-040 §Phase XXII.B — «CSS-transform live-zoom + idle re-raster (Figma pattern)»
 * @see ADR-726 §6 Φ3 — the measurement that identified the cache as the sole cost
 */

import { DXF_TIMING } from '../../config/dxf-timing';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

/** The scale/offset triple a raster was rasterised at (rotation is never used here). */
export type AnchorTransform = Pick<ViewTransform, 'scale' | 'offsetX' | 'offsetY'>;

/** `drawImage` destination rect, in DEVICE (backing-store) pixels. */
export interface AnchoredBlitRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Quiet period after the last transform change before the raster is rebuilt at the
 * live transform. Re-rasterising at rest restores exact pixels AND re-centres the
 * overscan margin, which is what gives the NEXT gesture its free budget again.
 */
export const IDLE_RERASTER_MS = DXF_TIMING.gesture.RASTER_IDLE;

/**
 * Overscan margin (CSS px per side). Bigger = fewer forced rebuilds while panning but
 * a more expensive rebuild (more entities survive culling) and more memory.
 * Amortised cost ∝ (W+2M)(H+2M)/M, so the extremes are both bad; this band is the
 * practical middle for viewports between a sidebar-squeezed panel and a 4K canvas.
 */
const OVERSCAN_FRACTION = 0.2;
const OVERSCAN_MIN_PX = 96;
const OVERSCAN_MAX_PX = 256;

/** Sub-device-pixel slack: rounding must never be read as "the raster fell short". */
const COVERAGE_EPSILON_PX = 0.5;

/** Magnification floor on a dpr=1 display — some blur is tolerable for ~120ms. */
const MIN_MAGNIFICATION_BUDGET = 1.25;

/** Overscan margin in CSS px for one side of the viewport. */
export function computeOverscanPx(viewport: Viewport): number {
  const shortSide = Math.min(viewport.width, viewport.height);
  if (!Number.isFinite(shortSide) || shortSide <= 0) return OVERSCAN_MIN_PX;
  const raw = Math.round(shortSide * OVERSCAN_FRACTION);
  return Math.min(OVERSCAN_MAX_PX, Math.max(OVERSCAN_MIN_PX, raw));
}

/**
 * How far the raster may be magnified before it must be rebuilt.
 *
 * The raster holds `dpr` device pixels per CSS pixel, so at magnification `k` its
 * effective resolution is `dpr/k` device px per CSS px. Allowing `k ≤ dpr` keeps the
 * projected raster at or above native CSS resolution — genuinely lossless on a HiDPI
 * screen. On a dpr=1 display any zoom-in degrades, so a small pragmatic budget applies
 * instead (the idle re-raster restores full sharpness ~120ms later).
 */
export function maxMagnification(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return MIN_MAGNIFICATION_BUDGET;
  return Math.max(MIN_MAGNIFICATION_BUDGET, dpr);
}

/** Current scale relative to the anchor. `NaN`/`Infinity` ⇒ the anchor is unusable. */
export function magnification(anchor: AnchorTransform, current: AnchorTransform): number {
  return current.scale / anchor.scale;
}

/**
 * Destination rect that places the anchored raster so its content lands exactly where
 * the CURRENT transform says it belongs.
 *
 * `rasterDeviceW/H` are the offscreen canvas backing-store dimensions (already
 * including the overscan on both sides).
 */
export function computeAnchoredBlitRect(
  anchor: AnchorTransform,
  current: AnchorTransform,
  overscanPx: number,
  rasterDeviceW: number,
  rasterDeviceH: number,
  dpr: number,
): AnchoredBlitRect {
  const k = magnification(anchor, current);
  const dx = dpr * (current.offsetX - k * (anchor.offsetX + overscanPx));
  const dy = dpr * (current.offsetY - k * (anchor.offsetY + overscanPx));
  const dw = k * rasterDeviceW;
  const dh = k * rasterDeviceH;
  // Pure pan (k === 1): snap the translation to whole device pixels. A fractional
  // destination forces the browser to resample a 1:1 bitmap and the drawing goes soft
  // for the whole gesture; the ≤0.5 device-px shift is invisible and the idle
  // re-raster lands it exactly. At k ≠ 1 resampling is unavoidable by construction.
  if (k === 1) return { dx: Math.round(dx), dy: Math.round(dy), dw, dh };
  return { dx, dy, dw, dh };
}

/** True when the projected raster fills the whole visible backing store (no holes). */
export function coversViewport(rect: AnchoredBlitRect, physW: number, physH: number): boolean {
  return (
    rect.dx <= COVERAGE_EPSILON_PX &&
    rect.dy <= COVERAGE_EPSILON_PX &&
    rect.dx + rect.dw >= physW - COVERAGE_EPSILON_PX &&
    rect.dy + rect.dh >= physH - COVERAGE_EPSILON_PX
  );
}

/**
 * Can the existing raster still serve `current` — i.e. is it both sharp enough and
 * hole-free? `false` ⇒ the caller must rebuild THIS frame (worst case: today's cost,
 * never worse).
 *
 * Note the self-stabilising loop: cheaper frames ⇒ less drift per frame ⇒ fewer
 * rebuilds ⇒ cheaper frames.
 */
export function canServeAnchoredBlit(params: {
  anchor: AnchorTransform;
  current: AnchorTransform;
  overscanPx: number;
  rasterDeviceW: number;
  rasterDeviceH: number;
  dpr: number;
  physW: number;
  physH: number;
}): boolean {
  const { anchor, current, overscanPx, rasterDeviceW, rasterDeviceH, dpr, physW, physH } = params;
  const k = magnification(anchor, current);
  if (!Number.isFinite(k) || k <= 0) return false;
  if (k > maxMagnification(dpr)) return false;
  const rect = computeAnchoredBlitRect(anchor, current, overscanPx, rasterDeviceW, rasterDeviceH, dpr);
  return coversViewport(rect, physW, physH);
}

/** True when `a` and `b` are the same view (drift check for the idle re-raster). */
export function isSameTransform(a: AnchorTransform, b: AnchorTransform): boolean {
  return a.scale === b.scale && a.offsetX === b.offsetX && a.offsetY === b.offsetY;
}
