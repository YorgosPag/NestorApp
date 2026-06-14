/**
 * ADR-453 — Print/Export engine · title-block renderer.
 *
 * Draws an opaque bordered title block in the bottom-right corner of the
 * printable area (standard CAD sheet stamp). Overlay placement keeps the drawing
 * image untouched, so `drawing-scale` (1:N) accuracy is preserved.
 *
 * Assumes the Greek font ('Roboto') is already registered on `pdf`.
 *
 * @module subapps/dxf-viewer/print/assemble/title-block-renderer
 */

import type jsPDF from 'jspdf';
import type { PrintableAreaMm } from '../config/paper-types';
import type { TitleBlockContent } from './title-block-types';

const BOX_WIDTH_MM = 85;
const HEADING_H_MM = 9;
const ROW_H_MM = 6;
const PAD_MM = 3;

const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [90, 100, 115];
const WHITE: [number, number, number] = [255, 255, 255];

function drawFrame(pdf: jsPDF, x: number, y: number, w: number, h: number): void {
  pdf.setFillColor(...WHITE);
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.4);
  pdf.rect(x, y, w, h, 'FD');
  pdf.line(x, y + HEADING_H_MM, x + w, y + HEADING_H_MM);
}

function drawHeading(pdf: jsPDF, heading: string, x: number, y: number, w: number): void {
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text(heading, x + PAD_MM, y + 6, { maxWidth: w - PAD_MM * 2 });
}

function drawFields(
  pdf: jsPDF,
  content: TitleBlockContent,
  x: number,
  topY: number,
  w: number,
): void {
  pdf.setFontSize(8);
  content.fields.forEach((field, i) => {
    const rowY = topY + i * ROW_H_MM + 4;
    pdf.setFont('Roboto', 'normal');
    pdf.setTextColor(...MUTED);
    pdf.text(field.label, x + PAD_MM, rowY);
    pdf.setFont('Roboto', 'bold');
    pdf.setTextColor(...INK);
    pdf.text(field.value, x + w - PAD_MM, rowY, { align: 'right' });
  });
}

/** Render the title block stamp into the bottom-right of `area`. */
export function drawTitleBlock(
  pdf: jsPDF,
  content: TitleBlockContent,
  area: PrintableAreaMm,
): void {
  const h = HEADING_H_MM + content.fields.length * ROW_H_MM;
  const w = Math.min(BOX_WIDTH_MM, area.widthMm);
  const x = area.xMm + area.widthMm - w;
  const y = area.yMm + area.heightMm - h;
  drawFrame(pdf, x, y, w, h);
  drawHeading(pdf, content.heading, x, y, w);
  drawFields(pdf, content, x, y + HEADING_H_MM, w);
}
