/**
 * ADR-453 — Print/Export engine · pure image placement math.
 *
 * Computes the aspect-preserving rectangle (mm) for placing a captured image
 * inside the printable area. By construction the capture canvas is sized to the
 * printable area, so the fit is normally exact; this helper still preserves
 * aspect defensively (and stays useful for future current-view captures).
 *
 * @module subapps/dxf-viewer/print/assemble/pdf-image-layout
 */

import type { PrintableAreaMm, RectMm } from '../config/paper-types';

/**
 * Fit an image of `imageWidthPx × imageHeightPx` into `area`, preserving aspect
 * ratio and centring it. Returns the placement rectangle in PDF mm space.
 */
export function computeImagePlacementMm(
  imageWidthPx: number,
  imageHeightPx: number,
  area: PrintableAreaMm,
): RectMm {
  if (imageWidthPx <= 0 || imageHeightPx <= 0) {
    return { x: area.xMm, y: area.yMm, w: area.widthMm, h: area.heightMm };
  }
  const imageAspect = imageWidthPx / imageHeightPx;
  const areaAspect = area.widthMm / area.heightMm;

  let w: number;
  let h: number;
  if (imageAspect > areaAspect) {
    // Width-bound: image is relatively wider than the area.
    w = area.widthMm;
    h = area.widthMm / imageAspect;
  } else {
    // Height-bound.
    h = area.heightMm;
    w = area.heightMm * imageAspect;
  }
  return {
    x: area.xMm + (area.widthMm - w) / 2,
    y: area.yMm + (area.heightMm - h) / 2,
    w,
    h,
  };
}
