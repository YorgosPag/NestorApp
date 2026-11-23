/**
 * @fileoverview **Οι σελίδες ενός PDF ΣΤΗ ΣΥΣΚΕΥΗ, με τα κομμάτια κειμένου τους σε θέσεις οθόνης** — η ΜΙΑ συνταγή του browser.
 * @related ./pdf-canvas-config (`loadPdfJs`, ο ΕΝΑΣ φορτωτής) · lib/pdf/pdf-page-text (`positionedPageOf`, η ΜΙΑ μετατροπή —
 *   την τρέχει και ο server, `services/pdf/pdf-positioned-text.service`) · objective-value/read-pdf-on-device (ADR-949 Α-2) ·
 *   hooks/listings/usePlotDrawingImport (ADR-920 §14.11 Ζ4 — ο πίνακας συντεταγμένων του τοπογραφικού)
 * @module components/file-manager/pdf-device-pages
 *
 * 🔑 **Εξήχθη από το `read-pdf-on-device` (Ζ4)**: δύο αναγνώστες στη συσκευή χρειάζονται τις ίδιες σελίδες· μια δεύτερη
 *    συνταγή θα σήμαινε ότι το τοπογραφικό και τα έγγραφα της αντικειμενικής θα έβλεπαν το ίδιο PDF διαφορετικά.
 * 🔑 Το αρχείο **δεν φεύγει από τη συσκευή** — κανένα αίτημα, καμία αποθήκευση.
 * ⚠️ Το pdf.js **μεταφέρει** το buffer στον worker (το αφήνει άδειο)· γι' αυτό του δίνεται **αντίγραφο**, και ο καλών κρατά
 *    τα δικά του bytes ανέγγιχτα (π.χ. για να τα στείλει αργότερα στην πόρτα).
 */

import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

import { loadPdfJs, type PdfDocProxy, type PdfPageProxy } from '@/components/file-manager/pdf-canvas-config';
import { pageTextOf, positionedPageOf, type PdfPositionedPage } from '@/lib/pdf/pdf-page-text';

/** Μια σελίδα: με θέσεις (για όποιον διαβάζει πίνακες) και ως απλό κείμενο (για το «έχει κείμενο;»). */
export interface DevicePdfPage {
  readonly positioned: PdfPositionedPage;
  readonly text: string;
}

function isTextItem(item: TextContent['items'][number]): item is TextItem {
  return 'str' in item;
}

async function readPage(page: PdfPageProxy, pageNumber: number): Promise<DevicePdfPage> {
  const viewport = page.getViewport({ scale: 1 });
  const { items } = await page.getTextContent();
  const textItems = items.filter(isTextItem);
  // Η ΜΙΑ μετατροπή σε συντεταγμένες οθόνης — η ίδια που τρέχει ο server (ADR-920 §14.11 Ζ3).
  return { positioned: positionedPageOf(pageNumber, viewport, textItems), text: pageTextOf(textItems) };
}

async function readPages(doc: PdfDocProxy, maxPages: number): Promise<readonly DevicePdfPage[]> {
  const pages: DevicePdfPage[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(doc.numPages, maxPages); pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    try {
      pages.push(await readPage(page, pageNumber));
    } finally {
      page.cleanup();
    }
  }
  return pages;
}

/**
 * **Οι σελίδες του PDF** (έως `maxPages`) — ή `null` όταν το pdf.js δεν το ανοίγει (χαλασμένο · κρυπτογραφημένο · όχι PDF).
 * Πετά **μόνο** όταν δεν φορτώνει το ίδιο το pdf.js (βλάβη της εφαρμογής, όχι του αρχείου).
 */
export async function readPdfPagesOnDevice(bytes: Uint8Array, maxPages: number): Promise<readonly DevicePdfPage[] | null> {
  const pdfjs = await loadPdfJs();
  let doc: PdfDocProxy;
  try {
    doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  } catch {
    return null;
  }
  try {
    return await readPages(doc, maxPages);
  } catch {
    return null;
  } finally {
    await doc.destroy();
  }
}
