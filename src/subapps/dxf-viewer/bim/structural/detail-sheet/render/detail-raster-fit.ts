/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · raster contain-fit SSoT.
 *
 * Computes the aspect-preserving, centred placement of a raster image inside a
 * sheet rectangle (sheet-mm). Shared by BOTH detail backends — the Canvas2D
 * preview and the jsPDF export — so a captured 3D image is positioned identically
 * in preview and PDF (preview === PDF). Pure + deterministic → unit-testable
 * without a canvas.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/detail-raster-fit
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { RectMm } from '../detail-sheet-types';

/**
 * Returns the largest rectangle with the image's aspect ratio that fits inside
 * `rect`, centred. Degenerate inputs (non-positive image/rect dimension) collapse
 * to a zero-size rect at the region centre.
 */
export function containFitRectMm(rect: RectMm, imgWidthPx: number, imgHeightPx: number): RectMm {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (imgWidthPx <= 0 || imgHeightPx <= 0 || rect.w <= 0 || rect.h <= 0) {
    return { x: cx, y: cy, w: 0, h: 0 };
  }
  const scale = Math.min(rect.w / imgWidthPx, rect.h / imgHeightPx);
  const w = imgWidthPx * scale;
  const h = imgHeightPx * scale;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
