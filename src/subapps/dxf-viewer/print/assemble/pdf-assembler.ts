/**
 * ADR-453 — Print/Export engine · PDF assembler (the single shared output path).
 *
 * Both the 2D and 3D capture adapters funnel their `CaptureResult` through this
 * one function — the SSoT convergence point. Mirrors the established jsPDF
 * pattern (`bim/schedule/exporters/pdf-exporter.ts`): new jsPDF → registerGreekFont
 * → draw → `output('blob')`.
 *
 * **ADR-651 Φάση ΣΤ** — η πινακίδα/κορνίζα δεν έχει πια δικό της ζωγράφο εδώ. Ο καλών
 * (`print-service`) δίνει έτοιμα `DetailPrimitive[]` σε **page-mm** από το ΙΔΙΟ layout model
 * που βλέπει ο χρήστης στην οθόνη (ADR-622/651), και τα ζωγραφίζει ο κοινός
 * `renderDetailPrimitives`. Άρα: **οθόνη === PDF === in-scene**, μία μηχανή πινακίδας.
 *
 * Η `area` έρχεται κι αυτή απ' έξω: με πινακίδα είναι η **ωφέλιμη** περιοχή της κορνίζας
 * (το σχέδιο δεν τυπώνεται ποτέ κάτω από την πινακίδα)· χωρίς πινακίδα, η κλασική περιοχή
 * με συμμετρικό περιθώριο.
 *
 * **ADR-651 Φάση Ζ** — το ΙΔΙΟ path παράγει και **πολυσέλιδο** PDF (σετ φύλλων): `new jsPDF`
 * μία φορά, ένας ζωγράφος σελίδας (`drawPrintPage`) ανά φύλλο, `addPage()` ανάμεσα. Το
 * single-page `assemblePrintPdf` έγινε thin wrapper του `assemblePrintPdfPages([page])` —
 * μηδέν διπλός κώδικας εξόδου (N.18).
 *
 * @module subapps/dxf-viewer/print/assemble/pdf-assembler
 */

import jsPDF from 'jspdf';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import { renderDetailPrimitives } from '../../bim/structural/detail-sheet/render/detail-pdf-primitives';
import type { DetailPrimitive } from '../../bim/structural/detail-sheet/detail-sheet-types';
import type { PaperSpec, PrintableAreaMm } from '../config/paper-types';
import { computeImagePlacementMm } from './pdf-image-layout';
import { drawScaleCaption } from './scale-caption-renderer';
import type { CaptureResult } from '../capture/capture-types';

/**
 * Μία σελίδα εξόδου: το capture του σχεδίου + πού προσγειώνεται + (προαιρετικά) η
 * κορνίζα/πινακίδα ή η λεζάντα κλίμακας. Κοινή για single-page και σετ φύλλων.
 */
export interface PrintPage {
  capture: CaptureResult;
  /** Πού προσγειώνεται το σχέδιο μέσα στη σελίδα (page-mm). */
  area: PrintableAreaMm;
  /**
   * Κορνίζα ISO 5457 + πινακίδα σε page-mm (ADR-651 Φάση ΣΤ). `undefined` ⇒ φύλλο χωρίς
   * πινακίδα (τότε μπαίνει η λεζάντα κλίμακας, αν υπάρχει).
   */
  sheetPrimitives?: readonly DetailPrimitive[];
  /** "1:N" caption drawn bottom-left when there is no title block. */
  scaleText?: string | null;
}

export interface PrintAssemblyInput extends PrintPage {
  paper: PaperSpec;
}

/**
 * Ζωγραφίζει ΜΙΑ σελίδα (σχέδιο + κορνίζα/πινακίδα ή λεζάντα) πάνω σε **υπάρχον** jsPDF.
 * Ο καλών έχει ήδη δημιουργήσει/προσθέσει τη σελίδα. Σύγχρονο, καμία I/O.
 */
function drawPrintPage(pdf: jsPDF, page: PrintPage): void {
  const { capture, area } = page;
  // ADR-608 — vector capture emits native jsPDF primitives into the area; raster
  // capture places its PNG. Both land the drawing in the same printable rectangle.
  if (capture.kind === 'vector') {
    capture.draw(pdf, area);
  } else {
    const rect = computeImagePlacementMm(capture.widthPx, capture.heightPx, area);
    pdf.addImage(capture.dataUrl, 'PNG', rect.x, rect.y, rect.w, rect.h, undefined, 'FAST');
  }

  // Το φύλλο (κορνίζα + πινακίδα) μπαίνει ΠΑΝΩ από το σχέδιο: sheet-mm === page-mm, καμία
  // μετατροπή. Χωρίς πινακίδα, μένει η λεζάντα κλίμακας κάτω-αριστερά (η παλιά συμπεριφορά).
  if (page.sheetPrimitives?.length) {
    renderDetailPrimitives(pdf, page.sheetPrimitives);
  } else if (page.scaleText) {
    drawScaleCaption(pdf, page.scaleText, area);
  }
}

/**
 * ADR-651 Φάση Ζ — assemble ΕΝΑ ή ΠΟΛΛΑ φύλλα σε ένα PDF Blob στο ζητούμενο χαρτί (όλα τα
 * φύλλα του σετ μοιράζονται το ΙΔΙΟ χαρτί ⇒ συνεπής πινακίδα). `new jsPDF` + font μία φορά,
 * `addPage()` ανάμεσα στα φύλλα. jsPDF accepts the lowercase ISO size string ('a4'…'a0').
 */
export async function assemblePrintPdfPages(
  pages: readonly PrintPage[],
  paper: PaperSpec,
): Promise<Blob> {
  const format = paper.size.toLowerCase();
  const pdf = new jsPDF({ orientation: paper.orientation, unit: 'mm', format });
  // Greek font registered up-front so the title-block text is Unicode-safe.
  await registerGreekFont(pdf);

  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage(format, paper.orientation);
    drawPrintPage(pdf, page);
  });

  return pdf.output('blob');
}

/**
 * Assemble the captured snapshot into a single-page PDF Blob (thin wrapper — ένα φύλλο).
 */
export async function assemblePrintPdf(input: PrintAssemblyInput): Promise<Blob> {
  const { paper, ...page } = input;
  return assemblePrintPdfPages([page], paper);
}
