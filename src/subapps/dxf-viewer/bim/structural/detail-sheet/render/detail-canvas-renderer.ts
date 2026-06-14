/**
 * ADR-457 — Column Reinforcement Detail Sheet · Canvas2D backend (live preview).
 *
 * Renders a {@link DetailSheetModel} (sheet-mm) into a `CanvasRenderingContext2D`
 * for the WYSIWYG preview inside `ColumnDetailDialog`. The SAME model feeds the
 * jsPDF backend (`detail-pdf-renderer`) → preview === PDF.
 *
 * Coordinate mapping: sheet-mm → device pixels via a single `pxPerMm` scale
 * (origin top-left, +y down — identical to canvas space, so no axis flip). The
 * caller fits the whole sheet into the available canvas and supplies `pxPerMm`.
 *
 * Per region: paint the frame + heading + scale caption, then clip to the
 * region rect and draw its primitives (lines / polylines / circles / linear
 * dimensions / text / raster).
 *
 * ADR-040: offscreen / dialog-local canvas — never touches the live
 * `DxfRenderer` pipeline (CHECK 6B/6C/6D safe).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/detail-canvas-renderer
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type {
  DetailPrimitive,
  DetailSheetModel,
  RectMm,
  SheetRegion,
  SheetStroke,
} from '../detail-sheet-types';
import { resolveDimGeometry } from '../detail-sheet-dim';
import { containFitRectMm } from './detail-raster-fit';

const SHEET_BG_HEX = '#ffffff';
const PAGE_BORDER_HEX = '#222222';
const REGION_BORDER_HEX = '#888888';
const REGION_TITLE_HEX = '#333333';
const CAPTION_HEX = '#555555';
const REGION_TITLE_HEIGHT_MM = 3.4;
const REGION_TITLE_PAD_MM = 3;
const CAPTION_HEIGHT_MM = 2.8;
const CAPTION_PAD_MM = 2.5;
const PAGE_BORDER_WIDTH_MM = 0.5;
const REGION_BORDER_WIDTH_MM = 0.3;

export interface DetailCanvasRenderOptions {
  /** Device pixels per sheet-millimetre. */
  readonly pxPerMm: number;
  /**
   * Pre-decoded raster images keyed by their `dataUrl`. The dialog decodes all
   * raster primitives up-front (async) and passes them here so the paint stays
   * synchronous; a missing/undecoded entry is skipped (region heading only).
   */
  readonly rasterImages?: ReadonlyMap<string, CanvasImageSource>;
}

/** Paints the whole detail sheet (background → page border → regions). */
export function renderDetailSheet(
  ctx: CanvasRenderingContext2D,
  model: DetailSheetModel,
  options: DetailCanvasRenderOptions,
): void {
  const { pxPerMm } = options;
  const rasterImages = options.rasterImages;
  ctx.fillStyle = SHEET_BG_HEX;
  ctx.fillRect(0, 0, model.sheetWidthMm * pxPerMm, model.sheetHeightMm * pxPerMm);
  ctx.strokeStyle = PAGE_BORDER_HEX;
  ctx.lineWidth = PAGE_BORDER_WIDTH_MM * pxPerMm;
  ctx.setLineDash([]);
  ctx.strokeRect(0, 0, model.sheetWidthMm * pxPerMm, model.sheetHeightMm * pxPerMm);

  for (const region of model.regions) renderRegion(ctx, region, pxPerMm, rasterImages);
}

/** Frame + heading + caption + clipped primitives for one region. */
function renderRegion(
  ctx: CanvasRenderingContext2D,
  region: SheetRegion,
  pxPerMm: number,
  rasterImages?: ReadonlyMap<string, CanvasImageSource>,
): void {
  const { x, y, w, h } = region.rectMm;
  ctx.strokeStyle = REGION_BORDER_HEX;
  ctx.lineWidth = REGION_BORDER_WIDTH_MM * pxPerMm;
  ctx.setLineDash([]);
  ctx.strokeRect(x * pxPerMm, y * pxPerMm, w * pxPerMm, h * pxPerMm);

  ctx.fillStyle = REGION_TITLE_HEX;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${REGION_TITLE_HEIGHT_MM * pxPerMm}px sans-serif`;
  ctx.fillText(
    region.title,
    (x + REGION_TITLE_PAD_MM) * pxPerMm,
    (y + REGION_TITLE_PAD_MM + REGION_TITLE_HEIGHT_MM) * pxPerMm,
  );

  if (region.caption) {
    ctx.fillStyle = CAPTION_HEX;
    ctx.textAlign = 'right';
    ctx.font = `${CAPTION_HEIGHT_MM * pxPerMm}px sans-serif`;
    ctx.fillText(region.caption, (x + w - CAPTION_PAD_MM) * pxPerMm, (y + h - CAPTION_PAD_MM) * pxPerMm);
  }

  if (region.primitives.length === 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x * pxPerMm, y * pxPerMm, w * pxPerMm, h * pxPerMm);
  ctx.clip();
  for (const prim of region.primitives) renderPrimitive(ctx, prim, pxPerMm, rasterImages);
  ctx.restore();
}

function applyStroke(ctx: CanvasRenderingContext2D, stroke: SheetStroke, pxPerMm: number): void {
  ctx.strokeStyle = stroke.colorHex;
  ctx.lineWidth = Math.max(0.4, stroke.widthMm * pxPerMm);
  ctx.setLineDash((stroke.dashMm ?? []).map((d) => d * pxPerMm));
}

function renderPrimitive(
  ctx: CanvasRenderingContext2D,
  prim: DetailPrimitive,
  pxPerMm: number,
  rasterImages?: ReadonlyMap<string, CanvasImageSource>,
): void {
  switch (prim.kind) {
    case 'line':
      applyStroke(ctx, prim.stroke, pxPerMm);
      ctx.beginPath();
      ctx.moveTo(prim.a.x * pxPerMm, prim.a.y * pxPerMm);
      ctx.lineTo(prim.b.x * pxPerMm, prim.b.y * pxPerMm);
      ctx.stroke();
      return;
    case 'polyline':
      renderPolyline(ctx, prim.points, prim.closed, prim.stroke, prim.fillHex, pxPerMm);
      return;
    case 'circle':
      ctx.beginPath();
      ctx.arc(prim.center.x * pxPerMm, prim.center.y * pxPerMm, prim.radiusMm * pxPerMm, 0, Math.PI * 2);
      if (prim.fillHex) { ctx.fillStyle = prim.fillHex; ctx.fill(); }
      if (prim.stroke) { applyStroke(ctx, prim.stroke, pxPerMm); ctx.stroke(); }
      return;
    case 'text':
      ctx.fillStyle = prim.colorHex;
      ctx.textAlign = prim.align;
      ctx.textBaseline = 'alphabetic';
      ctx.font = `${prim.bold ? '600 ' : ''}${prim.heightMm * pxPerMm}px sans-serif`;
      ctx.fillText(prim.text, prim.position.x * pxPerMm, prim.position.y * pxPerMm);
      return;
    case 'dim':
      renderDim(ctx, prim, pxPerMm);
      return;
    case 'raster':
      renderRaster(ctx, prim, pxPerMm, rasterImages);
      return;
  }
}

/**
 * Draws a pre-decoded raster image contain-fitted (aspect-preserved, centred)
 * inside its sheet rect. Skips silently when the image is still pending / absent
 * (the region keeps its heading only).
 */
function renderRaster(
  ctx: CanvasRenderingContext2D,
  prim: Extract<DetailPrimitive, { kind: 'raster' }>,
  pxPerMm: number,
  rasterImages?: ReadonlyMap<string, CanvasImageSource>,
): void {
  if (!prim.dataUrl || !rasterImages) return;
  const img = rasterImages.get(prim.dataUrl);
  if (!img) return;
  const { width, height } = rasterSourceSize(img);
  const fit: RectMm = containFitRectMm(prim.rect, width, height);
  if (fit.w <= 0 || fit.h <= 0) return;
  ctx.drawImage(img, fit.x * pxPerMm, fit.y * pxPerMm, fit.w * pxPerMm, fit.h * pxPerMm);
}

/** Intrinsic pixel size of a decoded raster source (HTMLImageElement / bitmap). */
function rasterSourceSize(img: CanvasImageSource): { width: number; height: number } {
  if (img instanceof HTMLImageElement) return { width: img.naturalWidth, height: img.naturalHeight };
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    return { width: img.width, height: img.height };
  }
  const sized = img as { width?: number; height?: number };
  return { width: sized.width ?? 0, height: sized.height ?? 0 };
}

function renderPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  closed: boolean,
  stroke: SheetStroke,
  fillHex: string | undefined,
  pxPerMm: number,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * pxPerMm, points[0].y * pxPerMm);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x * pxPerMm, points[i].y * pxPerMm);
  if (closed) ctx.closePath();
  if (fillHex) { ctx.fillStyle = fillHex; ctx.fill(); }
  applyStroke(ctx, stroke, pxPerMm);
  ctx.stroke();
}

function renderDim(
  ctx: CanvasRenderingContext2D,
  dim: Extract<DetailPrimitive, { kind: 'dim' }>,
  pxPerMm: number,
): void {
  const geo = resolveDimGeometry(dim);
  applyStroke(ctx, dim.stroke, pxPerMm);
  for (const [a, b] of geo.extensionLines) {
    ctx.beginPath();
    ctx.moveTo(a.x * pxPerMm, a.y * pxPerMm);
    ctx.lineTo(b.x * pxPerMm, b.y * pxPerMm);
    ctx.stroke();
  }
  const [d1, d2] = geo.dimensionLine;
  ctx.beginPath();
  ctx.moveTo(d1.x * pxPerMm, d1.y * pxPerMm);
  ctx.lineTo(d2.x * pxPerMm, d2.y * pxPerMm);
  ctx.stroke();

  ctx.fillStyle = dim.stroke.colorHex;
  for (const tri of geo.arrowheads) {
    ctx.beginPath();
    ctx.moveTo(tri[0].x * pxPerMm, tri[0].y * pxPerMm);
    for (let i = 1; i < tri.length; i++) ctx.lineTo(tri[i].x * pxPerMm, tri[i].y * pxPerMm);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.translate(geo.textPosition.x * pxPerMm, geo.textPosition.y * pxPerMm);
  ctx.rotate(geo.textAngleRad);
  ctx.fillStyle = dim.stroke.colorHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${geo.textHeightMm * pxPerMm}px sans-serif`;
  ctx.fillText(geo.text, 0, 0);
  ctx.restore();
}
