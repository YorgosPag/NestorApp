/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · perspective region.
 *
 * Pure builder placing the offscreen 3D capture (PNG data URL) as a single
 * {@link RasterPrimitive} inside the centre `perspective` region, inset below the
 * region heading. The raster is rendered by `column-detail-3d-capture` and shared
 * byte-for-byte between the canvas preview and the jsPDF export → preview === PDF.
 *
 * No geometry/units here — the capture owns the 3D framing; this module only
 * reserves the on-sheet rectangle (sheet-mm). `dataUrl` is `null` while the
 * capture is still pending (or unavailable for a non-rectangular column), in
 * which case the region shows its heading only.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/column-detail-perspective
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { DetailPrimitive, RectMm } from './detail-sheet-types';

/** Inset (mm) below the region heading before the raster starts. */
const TOP_INSET_MM = 9;
/** Inset (mm) on the remaining three sides. */
const SIDE_INSET_MM = 3;

/** Reserves the raster rectangle inside a region, inset for the heading. */
function insetRasterRect(region: RectMm): RectMm {
  return {
    x: region.x + SIDE_INSET_MM,
    y: region.y + TOP_INSET_MM,
    w: Math.max(0, region.w - 2 * SIDE_INSET_MM),
    h: Math.max(0, region.h - TOP_INSET_MM - SIDE_INSET_MM),
  };
}

/**
 * Builds the perspective region's drawable contents: one raster slot holding the
 * 3D capture. When `dataUrl` is `null` the slot is still emitted (so the layout
 * is identical between pending and ready states); the renderer simply skips an
 * empty image.
 */
export function buildColumnPerspectiveRegion(
  region: RectMm,
  dataUrl: string | null,
): { readonly primitives: readonly DetailPrimitive[] } {
  const primitives: readonly DetailPrimitive[] = [
    { kind: 'raster', rect: insetRasterRect(region), dataUrl },
  ];
  return { primitives };
}
