/**
 * ADR-453 — Print/Export engine · scale caption renderer.
 *
 * Draws a small "1:N" caption at the bottom-left of the printable area when a
 * drawing-scale print has no title block. Assumes 'Roboto' is registered.
 *
 * @module subapps/dxf-viewer/print/assemble/scale-caption-renderer
 */

import type jsPDF from 'jspdf';
import type { PrintableAreaMm } from '../config/paper-types';

export function drawScaleCaption(pdf: jsPDF, text: string, area: PrintableAreaMm): void {
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);
  pdf.text(text, area.xMm + 2, area.yMm + area.heightMm - 2);
}
