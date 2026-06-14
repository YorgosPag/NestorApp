/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · perspective region.
 *
 * Lays out the centre `perspective` region: the offscreen 3D capture as a single
 * raster (column + cage only), plus the column's W/D/H dimensions and bar marks
 * drawn as ordinary 2D `dim` / `text` primitives at the camera-projected anchor
 * points. Those primitives go through the SAME `resolveDimGeometry` / text SSoT
 * as the plan and elevation views, so the 3D annotations have identical
 * arrowheads / lines / text (FULL SSOT) — no bespoke 3D dimension code.
 *
 * The projected anchors are in normalised raster space; they are mapped into the
 * raster's contain-fitted rect (the SAME `containFitRectMm` the canvas/PDF
 * backend uses to place the image) so the overlay aligns with the column.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/column-detail-perspective
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { DetailPrimitive, RectMm, SheetStroke } from './detail-sheet-types';
import type { ColumnDetail3dCapture, NormPoint } from './render/column-detail-3d-capture';
import { containFitRectMm } from './render/detail-raster-fit';

/** Inset (mm) below the region heading before the raster starts. */
const TOP_INSET_MM = 9;
/** Inset (mm) on the remaining three sides. */
const SIDE_INSET_MM = 3;
/** Dimension stroke — identical to the plan/elevation dimensions. */
const DIM_STROKE: SheetStroke = { colorHex: '#333333', widthMm: 0.13 };
/** Dimension text cap height (mm) — matches the plan/elevation dimension text. */
const DIM_TEXT_MM = 2.6;
/** Perpendicular offset (mm) of each dimension line from the projected edge. */
const OVERLAY_DIM_OFFSET_MM = 6;
/** Bar-mark colour + size — matches the plan bar marks. */
const MARK_HEX = '#14387f';
const MARK_TEXT_MM = 2.2;

/** Reserves the raster rectangle inside a region, inset for the heading. */
function insetRasterRect(region: RectMm): RectMm {
  return {
    x: region.x + SIDE_INSET_MM,
    y: region.y + TOP_INSET_MM,
    w: Math.max(0, region.w - 2 * SIDE_INSET_MM),
    h: Math.max(0, region.h - TOP_INSET_MM - SIDE_INSET_MM),
  };
}

/** Signed perpendicular offset so the dimension line sits AWAY from the centre. */
function outwardOffsetMm(p1: Point2D, p2: Point2D, centre: Point2D): number {
  const ax = p2.x - p1.x;
  const ay = p2.y - p1.y;
  const len = Math.hypot(ax, ay) || 1;
  // Left-hand normal (matches resolveDimGeometry's normal convention).
  const nx = -ay / len;
  const ny = ax / len;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const towardsCentre = nx * (centre.x - mx) + ny * (centre.y - my);
  return towardsCentre > 0 ? -OVERLAY_DIM_OFFSET_MM : OVERLAY_DIM_OFFSET_MM;
}

/**
 * Builds the perspective region contents from the 3D capture (or just an empty
 * raster slot while the capture is pending / unavailable). Dimensions and bar
 * marks are emitted as standard 2D primitives at the projected anchors.
 */
export function buildColumnPerspectiveRegion(
  region: RectMm,
  capture: ColumnDetail3dCapture | null,
): { readonly primitives: readonly DetailPrimitive[] } {
  const rasterRect = insetRasterRect(region);
  if (!capture) {
    return { primitives: [{ kind: 'raster', rect: rasterRect, dataUrl: null }] };
  }

  const fitted = containFitRectMm(rasterRect, capture.widthPx, capture.heightPx);
  const toSheet = (n: NormPoint): Point2D => ({ x: fitted.x + n.x * fitted.w, y: fitted.y + n.y * fitted.h });
  const centre = toSheet(capture.centroid);

  const primitives: DetailPrimitive[] = [{
    kind: 'raster', rect: rasterRect, dataUrl: capture.dataUrl,
    widthPx: capture.widthPx, heightPx: capture.heightPx,
  }];

  for (const dim of capture.dims) {
    const p1 = toSheet(dim.a);
    const p2 = toSheet(dim.b);
    primitives.push({
      kind: 'dim',
      p1,
      p2,
      offsetMm: outwardOffsetMm(p1, p2, centre),
      text: dim.text,
      stroke: DIM_STROKE,
      textHeightMm: DIM_TEXT_MM,
    });
  }

  for (const mark of capture.marks) {
    primitives.push({
      kind: 'text',
      position: toSheet(mark.pos),
      text: mark.text,
      heightMm: MARK_TEXT_MM,
      colorHex: MARK_HEX,
      align: 'center',
      bold: true,
    });
  }

  return { primitives };
}
