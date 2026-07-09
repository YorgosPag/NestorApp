/**
 * ADR-453 — Print/Export engine · PDF assembler (the single shared output path).
 *
 * Both the 2D and 3D capture adapters funnel their `CaptureResult` through this
 * one function — the SSoT convergence point. Mirrors the established jsPDF
 * pattern (`bim/schedule/exporters/pdf-exporter.ts`): new jsPDF → registerGreekFont
 * → draw → `output('blob')`.
 *
 * Title block + scale caption are layered in by Slice 4 (kept out of Slice 1).
 *
 * @module subapps/dxf-viewer/print/assemble/pdf-assembler
 */

import jsPDF from 'jspdf';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type { PaperSpec } from '../config/paper-types';
import { resolvePrintableAreaMm } from '../config/paper-math';
import { computeImagePlacementMm } from './pdf-image-layout';
import { drawTitleBlock } from './title-block-renderer';
import { drawScaleCaption } from './scale-caption-renderer';
import type { TitleBlockContent } from './title-block-types';
import type { CaptureResult } from '../capture/capture-types';

export interface PrintAssemblyInput {
  capture: CaptureResult;
  paper: PaperSpec;
  marginMm: number;
  includeTitleBlock: boolean;
  /** Render-ready title block (drawn when `includeTitleBlock`). */
  titleBlock?: TitleBlockContent;
  /** "1:N" caption drawn bottom-left when there is no title block. */
  scaleText?: string | null;
}

/**
 * Assemble the captured snapshot into a PDF Blob sized to the requested sheet.
 * jsPDF accepts the lowercase ISO size string ('a4'…'a0') as `format`.
 */
export async function assemblePrintPdf(input: PrintAssemblyInput): Promise<Blob> {
  const { capture, paper, marginMm } = input;
  const pdf = new jsPDF({
    orientation: paper.orientation,
    unit: 'mm',
    format: paper.size.toLowerCase(),
  });
  // Greek font registered up-front so any future title-block text is Unicode-safe.
  await registerGreekFont(pdf);

  const area = resolvePrintableAreaMm(paper, marginMm);
  // ADR-608 — vector capture emits native jsPDF primitives into the area; raster
  // capture places its PNG. Both land the drawing in the same printable rectangle.
  if (capture.kind === 'vector') {
    capture.draw(pdf, area);
  } else {
    const rect = computeImagePlacementMm(capture.widthPx, capture.heightPx, area);
    pdf.addImage(capture.dataUrl, 'PNG', rect.x, rect.y, rect.w, rect.h, undefined, 'FAST');
  }

  // Title block overlays the bottom-right corner (drawing untouched → 1:N safe).
  if (input.includeTitleBlock && input.titleBlock) {
    drawTitleBlock(pdf, input.titleBlock, area);
  } else if (input.scaleText) {
    drawScaleCaption(pdf, input.scaleText, area);
  }

  return pdf.output('blob');
}
