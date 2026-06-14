/**
 * ADR-453 — Print/Export engine · numeric constants (SSoT).
 *
 * ISO 216 sheet dimensions, DPI defaults and raster guards. Numeric-only
 * config (no user-facing strings → N.11 not applicable here).
 *
 * @module subapps/dxf-viewer/print/config/paper-constants
 */

import type { PaperSize, PaperDimensionsMm } from './paper-types';

/** Millimetres per inch (ISO). */
export const MM_PER_INCH = 25.4;

/** Default raster resolution for exports. Configurable per call. */
export const EXPORT_DPI = 150;

/** Lower resolution used for the (deferred) live preview. */
export const PREVIEW_DPI = 72;

/** Default symmetric page margin in millimetres. */
export const DEFAULT_PAGE_MARGIN_MM = 10;

/**
 * Maximum width/height of an offscreen canvas in physical pixels.
 * Browsers cap canvas dimensions (~16384 on Chrome, smaller on Safari/iOS);
 * 8192 is a safe cross-browser ceiling. A0 @150DPI ≈ 7016px stays under it,
 * but larger sheets/higher DPI are clamped down (see computePaperRasterPx).
 */
export const MAX_CANVAS_DIMENSION_PX = 8192;

/**
 * ISO 216 A-series dimensions in PORTRAIT orientation (mm).
 * Landscape is derived by swapping width/height (resolvePaperDimensionsMm).
 */
export const PAPER_SIZES_MM_PORTRAIT: Record<PaperSize, PaperDimensionsMm> = {
  A4: { widthMm: 210, heightMm: 297 },
  A3: { widthMm: 297, heightMm: 420 },
  A2: { widthMm: 420, heightMm: 594 },
  A1: { widthMm: 594, heightMm: 841 },
  A0: { widthMm: 841, heightMm: 1189 },
};

/** Ordered list for UI pickers (smallest → largest). */
export const PAPER_SIZE_ORDER: readonly PaperSize[] = ['A4', 'A3', 'A2', 'A1', 'A0'];

/** Real-world denominators offered for `drawing-scale` mode (1:N). */
export const PRINT_SCALE_DENOMINATORS: readonly number[] = [10, 20, 50, 100, 200, 500];
