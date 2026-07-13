/**
 * ADR-622 — **`DetailPrimitive[]` → jsPDF** (ο ΕΝΑΣ vector backend του μοντέλου φύλλου).
 *
 * Ήταν ιδιωτικό μέσα στο `detail-pdf-renderer.ts` (φύλλα οπλισμού). Η πινακίδα σχεδίου
 * (ADR-651 Φάση ΣΤ) χρειάζεται **το ίδιο** πράγμα πάνω στη σελίδα του print engine — άρα ο
 * ζωγράφος βγαίνει εδώ και τον καλούν **δύο** καταναλωτές:
 *
 *   - `detail-pdf-renderer.ts` → δικό του jsPDF έγγραφο (φύλλο λεπτομερειών A3),
 *   - `print/assemble/pdf-assembler.ts` → η σελίδα της εκτύπωσης (κορνίζα ISO 5457 + πινακίδα).
 *
 * Καμία δεύτερη μηχανή: **preview canvas === PDF === in-scene** μένει μία αλήθεια. Το
 * σύστημα συντεταγμένων είναι κοινό εξ ορισμού — sheet-mm (αρχή πάνω-αριστερά, +y κάτω) ===
 * jsPDF page-mm, οπότε δεν υπάρχει ούτε κλίμακα ούτε αναστροφή άξονα.
 *
 * Ο καλών έχει ήδη κάνει `registerGreekFont(pdf)` (Roboto / Identity-H) — εδώ μόνο σχεδίαση.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/detail-pdf-primitives
 * @see ./detail-canvas-renderer.ts — ο canvas backend του ΙΔΙΟΥ μοντέλου
 */

import type jsPDF from 'jspdf';
// 🏢 Color-Conversion SSoT (ADR-573): hex→rgb via canonical `config/color-math`.
import { parseHex } from '../../../../config/color-math';
import type { DetailPrimitive, SheetStroke } from '../detail-sheet-types';
import { resolveDimGeometry } from '../detail-sheet-dim';
import { containFitRectMm } from './detail-raster-fit';

/** 1 mm expressed in PDF points — the unit jsPDF font size expects. */
export const MM_TO_PT = 2.834645669;

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
export function applyTextStyle(pdf: jsPDF, colorHex: string, heightMm: number, bold: boolean): void {
  const [r, g, b] = hexToRgb(colorHex);
  pdf.setTextColor(r, g, b);
  pdf.setFont('Roboto', bold ? 'bold' : 'normal');
  pdf.setFontSize(heightMm * MM_TO_PT);
}

/** Stroke-only rectangle (region / page frame). */
export function strokeRect(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  hex: string,
  widthMm: number,
): void {
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

/** Ένα primitive → jsPDF (sheet-mm === page-mm· καμία μετατροπή). */
export function renderDetailPrimitive(pdf: jsPDF, prim: DetailPrimitive): void {
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

/** Όλα τα primitives του μοντέλου, με τη σειρά τους (ο καλών ορίζει το z-order). */
export function renderDetailPrimitives(
  pdf: jsPDF,
  primitives: readonly DetailPrimitive[],
): void {
  for (const prim of primitives) renderDetailPrimitive(pdf, prim);
}
