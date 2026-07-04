/**
 * ADR-457 Slice 5 — Column Reinforcement Detail Sheet · jsPDF backend (export/print).
 *
 * Renders the SAME {@link DetailSheetModel} (sheet-mm) the Canvas preview uses
 * into a jsPDF document, so **preview === PDF**. The sheet is A3 in millimetres
 * and jsPDF's page unit is millimetres too → sheet-mm map 1:1 to PDF mm (origin
 * top-left, +y down — identical convention, no axis flip / no pxPerMm scale).
 *
 * Dimensions reuse the SAME `resolveDimGeometry` SSoT and rasters the SAME
 * `containFitRectMm` as the canvas backend. Greek text is Unicode-safe via the
 * shared `registerGreekFont` (Roboto / Identity-H).
 *
 * Mirrors the print engine jsPDF pattern (ADR-453 `pdf-assembler`): new jsPDF →
 * registerGreekFont → draw → caller does `output('blob')`.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/detail-pdf-renderer
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import jsPDF from 'jspdf';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type { DetailPrimitive, DetailSheetModel, SheetRegion, SheetStroke } from '../detail-sheet-types';
import { resolveDimGeometry } from '../detail-sheet-dim';
import { containFitRectMm } from './detail-raster-fit';
// 🏢 Color-Conversion SSoT (ADR-573): hex→rgb via canonical `config/color-math`.
import { parseHex } from '../../../../config/color-math';

/** 1 mm expressed in PDF points — the unit jsPDF font size expects. */
const MM_TO_PT = 2.834645669;
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
const MIN_LINE_WIDTH_MM = 0.05;

type RGB = readonly [number, number, number];

/** Parses a `#rgb` / `#rrggbb` hex string to an [r,g,b] triple (0..255). Invalid → black. */
function hexToRgb(hex: string): RGB {
  const c = parseHex(hex);
  return c ? [c.r, c.g, c.b] : [0, 0, 0];
}

function applyStroke(pdf: jsPDF, stroke: SheetStroke): void {
  const [r, g, b] = hexToRgb(stroke.colorHex);
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(Math.max(MIN_LINE_WIDTH_MM, stroke.widthMm));
  pdf.setLineDashPattern(stroke.dashMm ? [...stroke.dashMm] : [], 0);
}

/** Sets the active text style (colour + Roboto weight + size from mm cap height). */
function applyTextStyle(pdf: jsPDF, colorHex: string, heightMm: number, bold: boolean): void {
  const [r, g, b] = hexToRgb(colorHex);
  pdf.setTextColor(r, g, b);
  pdf.setFont('Roboto', bold ? 'bold' : 'normal');
  pdf.setFontSize(heightMm * MM_TO_PT);
}

/** Stroke-only rectangle (region / page frame). */
function strokeRect(pdf: jsPDF, x: number, y: number, w: number, h: number, hex: string, widthMm: number): void {
  const [r, g, b] = hexToRgb(hex);
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(widthMm);
  pdf.setLineDashPattern([], 0);
  pdf.rect(x, y, w, h, 'S');
}

function drawPolyline(
  pdf: jsPDF,
  points: readonly { x: number; y: number }[],
  closed: boolean,
  stroke: SheetStroke,
  fillHex: string | undefined,
): void {
  if (points.length < 2) return;
  applyStroke(pdf, stroke);
  const deltas: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    deltas.push([points[i].x - points[i - 1].x, points[i].y - points[i - 1].y]);
  }
  if (fillHex) { const [r, g, b] = hexToRgb(fillHex); pdf.setFillColor(r, g, b); }
  pdf.lines(deltas, points[0].x, points[0].y, [1, 1], fillHex ? 'DF' : 'S', closed);
}

function drawDim(pdf: jsPDF, dim: Extract<DetailPrimitive, { kind: 'dim' }>): void {
  const geo = resolveDimGeometry(dim);
  applyStroke(pdf, dim.stroke);
  for (const [a, b] of geo.extensionLines) pdf.line(a.x, a.y, b.x, b.y);
  const [d1, d2] = geo.dimensionLine;
  pdf.line(d1.x, d1.y, d2.x, d2.y);
  const [cr, cg, cb] = hexToRgb(dim.stroke.colorHex);
  pdf.setFillColor(cr, cg, cb);
  for (const t of geo.arrowheads) pdf.triangle(t[0].x, t[0].y, t[1].x, t[1].y, t[2].x, t[2].y, 'F');
  applyTextStyle(pdf, dim.stroke.colorHex, geo.textHeightMm, false);
  pdf.text(geo.text, geo.textPosition.x, geo.textPosition.y, {
    align: 'center', baseline: 'middle', angle: (-geo.textAngleRad * 180) / Math.PI,
  });
}

function drawRaster(pdf: jsPDF, prim: Extract<DetailPrimitive, { kind: 'raster' }>): void {
  if (!prim.dataUrl || !prim.widthPx || !prim.heightPx) return;
  const fit = containFitRectMm(prim.rect, prim.widthPx, prim.heightPx);
  if (fit.w <= 0 || fit.h <= 0) return;
  pdf.addImage(prim.dataUrl, 'PNG', fit.x, fit.y, fit.w, fit.h, undefined, 'FAST');
}

function renderPrimitive(pdf: jsPDF, prim: DetailPrimitive): void {
  switch (prim.kind) {
    case 'line':
      applyStroke(pdf, prim.stroke);
      pdf.line(prim.a.x, prim.a.y, prim.b.x, prim.b.y);
      return;
    case 'polyline':
      drawPolyline(pdf, prim.points, prim.closed, prim.stroke, prim.fillHex);
      return;
    case 'circle': {
      if (prim.fillHex) { const [r, g, b] = hexToRgb(prim.fillHex); pdf.setFillColor(r, g, b); }
      if (prim.stroke) applyStroke(pdf, prim.stroke);
      const style = prim.fillHex && prim.stroke ? 'FD' : prim.fillHex ? 'F' : 'S';
      pdf.circle(prim.center.x, prim.center.y, prim.radiusMm, style);
      return;
    }
    case 'text':
      applyTextStyle(pdf, prim.colorHex, prim.heightMm, prim.bold ?? false);
      pdf.text(prim.text, prim.position.x, prim.position.y, { align: prim.align, baseline: 'alphabetic' });
      return;
    case 'dim':
      drawDim(pdf, prim);
      return;
    case 'raster':
      drawRaster(pdf, prim);
      return;
  }
}

/** Frame + heading + caption + primitives for one region. */
function renderRegion(pdf: jsPDF, region: SheetRegion): void {
  const { x, y, w, h } = region.rectMm;
  strokeRect(pdf, x, y, w, h, REGION_BORDER_HEX, REGION_BORDER_WIDTH_MM);

  applyTextStyle(pdf, REGION_TITLE_HEX, REGION_TITLE_HEIGHT_MM, true);
  pdf.text(region.title, x + REGION_TITLE_PAD_MM, y + REGION_TITLE_PAD_MM + REGION_TITLE_HEIGHT_MM, {
    align: 'left', baseline: 'alphabetic',
  });

  if (region.caption) {
    applyTextStyle(pdf, CAPTION_HEX, CAPTION_HEIGHT_MM, false);
    pdf.text(region.caption, x + w - CAPTION_PAD_MM, y + h - CAPTION_PAD_MM, {
      align: 'right', baseline: 'alphabetic',
    });
  }

  for (const prim of region.primitives) renderPrimitive(pdf, prim);
}

/**
 * Builds the detail-sheet PDF from the backend-agnostic model (preview === PDF).
 * Async only because the Greek font registers lazily. The caller exports it via
 * `pdf.output('blob')` (download / print).
 */
export async function buildDetailSheetPdf(model: DetailSheetModel): Promise<jsPDF> {
  const pdf = new jsPDF({
    orientation: model.paper.orientation,
    unit: 'mm',
    format: model.paper.size.toLowerCase(),
  });
  await registerGreekFont(pdf);

  strokeRect(pdf, 0, 0, model.sheetWidthMm, model.sheetHeightMm, PAGE_BORDER_HEX, PAGE_BORDER_WIDTH_MM);
  for (const region of model.regions) renderRegion(pdf, region);
  return pdf;
}
