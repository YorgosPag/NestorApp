/**
 * @fileoverview **Το τοπογραφικό σχέδιο, διαβασμένο ΣΤΗ ΣΥΣΚΕΥΗ** — bytes → είδος → σάρωση DXF ή σελίδες PDF (ADR-920 §14.11 Ζ4).
 * @related lib/terrain/plot-outline/plot-drawing-read (ο ΚΟΙΝΟΣ πυρήνας με την πόρτα: είδος, μονάδα, κατάταξη) ·
 *   components/file-manager/pdf-device-pages (η ΜΙΑ συνταγή σελίδων PDF του browser) · hooks/listings/usePlotDrawingImport
 * @module components/terrain/plot-outline/read-plot-drawing-on-device
 *
 * 🔑 Μόνο I/O: ό,τι κρίνει (είδος, μονάδα, υποψήφια, κατάταξη) είναι ο **ίδιος** καθαρός πυρήνας που τρέχει ο server στο `PUT`.
 * 🔑 Το αρχείο **δεν φεύγει** από τη συσκευή μέχρι το «Επιβεβαίωση».
 */

import { readPdfPagesOnDevice } from '@/components/file-manager/pdf-device-pages';
import type { PdfPositionedPage } from '@/lib/pdf/pdf-page-text';
import { scanDxfPlotDrawing, type DxfPlotDrawing } from '@/lib/terrain/plot-outline/dxf-plot-outline-candidates';
import { readPdfPlotOutline, type PdfPlotOutlineReading } from '@/lib/terrain/plot-outline/pdf-coordinate-table';
import { plotDrawingKindOf, type PlotDrawingRefusal } from '@/lib/terrain/plot-outline/plot-drawing-read';
import { PLOT_DRAWING_MAX_PDF_PAGES } from '@/lib/terrain/plot-outline/plot-outline-config';
import { decodeSurveyText } from '@/lib/terrain/survey-import/survey-file-read';

/** Άρνηση στη συσκευή: του κοινού κριτή είδους, ή «ο browser δεν το διαβάζει» (χαλασμένο · κρυπτογραφημένο PDF). */
export type DevicePlotDrawingRefusal = PlotDrawingRefusal | 'unreadable';

export type DevicePlotDrawing =
  | { readonly kind: 'refused'; readonly refusal: DevicePlotDrawingRefusal }
  | { readonly kind: 'dxf'; readonly drawing: DxfPlotDrawing }
  | {
      readonly kind: 'pdf';
      readonly pages: readonly PdfPositionedPage[];
      readonly reading: PdfPlotOutlineReading;
    };

/** **Διάβασε το σχέδιο στη συσκευή.** Ποτέ δεν πετά για λόγο του αρχείου — επιστρέφει ονομασμένη άρνηση. */
export async function readPlotDrawingOnDevice(file: Pick<File, 'name' | 'arrayBuffer'>): Promise<DevicePlotDrawing> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { kind: 'refused', refusal: 'unreadable' };
  }
  const verdict = plotDrawingKindOf(file.name, bytes);
  if (!verdict.ok) return { kind: 'refused', refusal: verdict.refusal };
  if (verdict.kind === 'dxf') return { kind: 'dxf', drawing: scanDxfPlotDrawing(decodeSurveyText(bytes)) };

  const pages = await readPdfPagesOnDevice(bytes, PLOT_DRAWING_MAX_PDF_PAGES);
  if (pages === null) return { kind: 'refused', refusal: 'unreadable' };
  const positioned = pages.map((page) => page.positioned);
  return { kind: 'pdf', pages: positioned, reading: readPdfPlotOutline(positioned) };
}
