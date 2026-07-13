/**
 * ADR-457 Slice 5 — Column Reinforcement Detail Sheet · jsPDF backend (export/print).
 *
 * Renders the SAME {@link DetailSheetModel} (sheet-mm) the Canvas preview uses
 * into a jsPDF document, so **preview === PDF**. The sheet is A3 in millimetres
 * and jsPDF's page unit is millimetres too → sheet-mm map 1:1 to PDF mm (origin
 * top-left, +y down — identical convention, no axis flip / no pxPerMm scale).
 *
 * Ο ζωγράφος των primitives ζει στο `detail-pdf-primitives.ts` (ADR-622 SSoT) — τον
 * μοιράζεται με το print engine, που τυπώνει την κορνίζα/πινακίδα ISO 5457 στη ΔΙΚΗ του
 * σελίδα (ADR-651 Φάση ΣΤ). Εδώ μένει μόνο ό,τι αφορά το **φύλλο λεπτομερειών**: σελίδα +
 * regions (τίτλος/λεζάντα/πλαίσιο).
 *
 * Mirrors the print engine jsPDF pattern (ADR-453 `pdf-assembler`): new jsPDF →
 * registerGreekFont → draw → caller does `output('blob')`.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/detail-pdf-renderer
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import jsPDF from 'jspdf';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type { DetailSheetModel, SheetRegion } from '../detail-sheet-types';
import { applyTextStyle, renderDetailPrimitives, strokeRect } from './detail-pdf-primitives';

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

  renderDetailPrimitives(pdf, region.primitives);
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
