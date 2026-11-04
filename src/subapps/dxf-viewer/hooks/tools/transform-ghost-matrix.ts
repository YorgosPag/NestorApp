/**
 * transform-ghost-matrix.ts — PURE affine math for the O(1)/frame matrix ghost (ADR-646 Φάση 6).
 *
 * Split out from {@link module:hooks/tools/transform-ghost-matrix-cache} so the coordinate math is
 * unit-testable in a plain Node env: the cache class drags in the whole real-render stack
 * (`BimPreviewRenderer` → `EntityRendererComposite` → firebase), which a pure-math jest suite must not
 * load. Everything here is dependency-free apart from the SSoT viewport margins.
 *
 * WHY a single matrix suffices: `CoordinateTransforms.worldToScreen` is purely affine, and
 * scale/move/rotate/mirror-about-a-fixed-base are each a single 2×3 world affine. The full mapping
 * `offscreen-pixel → world → transformed-world → current-screen` therefore composes into ONE affine,
 * recomputed per frame from the LIVE current transform (so wheel zoom/pan mid-drag stay world-locked;
 * non-uniform scale sx≠sy yields circle→ellipse for free).
 *
 * @see hooks/tools/transform-ghost-matrix-cache — the DOM cache class + React-facing runner
 * @see docs/centralized-systems/reference/adrs/ADR-646-scale-tool-gap-analysis.md — Φάση 6
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
// SSoT margins used by `worldToScreen` (left=top=30) — do NOT hardcode the constant.
import { getDrawingAreaRect } from '../../rendering/core/drawing-area';
// ADR-794 — ΕΝΑ όνομα ανά ΧΩΡΟ. Το σχόλιο ομολογούσε «mirror of getEntityBBox shape — structural, no import coupling»: το διπλότυπο ήταν ΣΚΟΠΙΜΟ, για να αποφευχθεί ένα import.
import type { Bbox } from '../../types/coordinate-space';
// ADR-929 Φ0 — ο αφινικός πυρήνας μετακόμισε στο `lib/geometry/affine-2x3` και ο world→screen πίνακας στο
// `rendering/core/world-to-screen-affine`: ήταν εδώ, σε αρχείο ΕΝΟΣ εργαλείου, ενώ τους χρειάζονται πλέον το
// υπόβαθρο κάτοψης, η αναγνώριση κάτοψης και ο διακομιστής (calibration remap).
import type { Affine2x3 } from '@/lib/geometry/affine-2x3';

/** The offscreen capture footprint: world top-left anchor + CSS-px extent + pixel margin. */
export interface CaptureRect {
  readonly wxMin: number;
  readonly wyMax: number;
  readonly wCss: number;
  readonly hCss: number;
  readonly margin: number;
}

/** Pixel padding around the raster so lineweight/hatch at the edge is not clipped. */
export const MATRIX_GHOST_MARGIN_PX = 12;

/**
 * Max offscreen CSS dimension. Above it the raster (× DPR backing store) costs too much memory, so the
 * caller falls back to the Φ.5 LOD path. Hit only by selections whose UNSCALED bbox dwarfs the viewport
 * (common when scaling DOWN a selection that extends far off-screen) — the everyday on-screen case fits.
 */
export const MATRIX_GHOST_MAX_CSS = 4096;

/** World→world scale about a fixed base by (sx, sy). Move/mirror are the same family (sign/factor). */
export function scaleAboutBaseWorldAffine(base: Point2D, sx: number, sy: number): Affine2x3 {
  return { a: sx, b: 0, c: 0, d: sy, e: base.x * (1 - sx), f: base.y * (1 - sy) };
}

/** Offscreen-pixel→world affine (inverse of the capture render) for a rect captured at `scale0`. */
export function offscreenToWorldAffine(rect: CaptureRect, scale0: number): Affine2x3 {
  return {
    a: 1 / scale0, b: 0, c: 0, d: -1 / scale0,
    e: rect.wxMin - rect.margin / scale0,
    f: rect.wyMax + rect.margin / scale0,
  };
}

/**
 * Capture rect for a selection bbox at zoom `scale0` — CSS extent = world extent × scale0 + 2·margin.
 * Returns `null` (→ caller falls back to LOD) when either side exceeds {@link MATRIX_GHOST_MAX_CSS} or
 * the bbox is non-finite / the zoom non-positive.
 */
export function captureRectFromBBox(
  bbox: Bbox, scale0: number, margin: number, maxCss: number,
): CaptureRect | null {
  if (!(scale0 > 0)) return null;
  const wCss = (bbox.maxX - bbox.minX) * scale0 + 2 * margin;
  const hCss = (bbox.maxY - bbox.minY) * scale0 + 2 * margin;
  if (!Number.isFinite(wCss) || !Number.isFinite(hCss)) return null;
  if (wCss > maxCss || hCss > maxCss) return null;
  return { wxMin: bbox.minX, wyMax: bbox.maxY, wCss, hCss, margin };
}

/** The `worldToScreen` transform+viewport that renders world → offscreen CSS px for this rect. */
export function buildCaptureTransform(
  rect: CaptureRect, scale0: number,
): { transform: ViewTransform; viewport: Viewport } {
  // Το offscreen viewport περνά κι αυτό από το ίδιο `worldToScreen`, άρα η άγκυρα του
  // offscreen είναι η κάτω-αριστερή γωνία της ΔΙΚΗΣ ΤΟΥ περιοχής σχεδίασης.
  const viewport: Viewport = { width: rect.wCss, height: rect.hCss };
  const area = getDrawingAreaRect(viewport);
  return {
    transform: {
      scale: scale0,
      offsetX: rect.margin - area.x - rect.wxMin * scale0,
      offsetY: area.bottom - rect.wyMax * scale0 - rect.margin,
    },
    viewport,
  };
}
