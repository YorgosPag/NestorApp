/**
 * @fileoverview ADR-949 Α-2 — **ανάγνωση εγγράφου ΣΤΗ ΣΥΣΚΕΥΗ**: το PDF ανοίγει στον browser με το **ίδιο** pdf.js του
 *   θεατή (`loadPdfJs`, ένας φορτωτής) και δεν φεύγει ποτέ από τη συσκευή — κανένα αίτημα, καμία αποθήκευση.
 * @related `lib/pdf/pdf-page-text.ts` (το κοινό μοντέλο σελίδας) · `lib/objective-value/objective-value-device-readers.ts`
 *   (ποιος αναγνώστης, ποιες γραμμές) · `components/file-manager/pdf-canvas-config.ts` (ο φορτωτής)
 * @module components/objective-value/read-pdf-on-device
 *
 * 🔑 **Συντεταγμένες οθόνης** (`viewport.convertToViewportPoint`): το ίδιο έντυπο φτάνει με και χωρίς περιστροφή
 *    σελίδας — ο αναγνώστης βλέπει πάντα την ίδια διάταξη (βλ. `pdf-page-text.ts`).
 * 🔑 **Αποτυχία του αρχείου = έκβαση, όχι σφάλμα**: χαλασμένο/κρυπτογραφημένο ⇒ `unparsable` · σαρωμένο ή σπασμένη
 *    γραμματοσειρά ⇒ `unreadable` · άλλο έγγραφο ⇒ `not-recognized`. Ο άνθρωπος παίρνει ειλικρινή απάντηση, ποτέ μαντεψιά.
 * 🔒 Το κείμενο δεν γράφεται σε log ούτε σε κατάσταση πέρα από τις γραμμές του αναγνώστη (που δεν έχουν ΑΦΜ/ονόματα).
 */

import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

import { loadPdfJs, type PdfDocProxy, type PdfPageProxy } from '@/components/file-manager/pdf-canvas-config';
import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';
import { deviceReaderOf, type ObjectiveValueDocumentRow } from '@/lib/objective-value/objective-value-device-readers';
import {
  DOCUMENT_TEXT_MAX_BYTES,
  hasReadableText,
  pageTextOf,
  positionedPageOf,
  type PdfPositionedPage,
} from '@/lib/pdf/pdf-page-text';

/** Η έκβαση μιας ανάγνωσης — το λεξιλόγιο της οθόνης. */
export type DeviceReadingOutcome =
  | { readonly kind: 'no-reader' }
  | { readonly kind: 'not-pdf' }
  | { readonly kind: 'too-large' }
  | { readonly kind: 'unparsable' }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'not-recognized' }
  | { readonly kind: 'read'; readonly rows: readonly ObjectiveValueDocumentRow[] };

const PDF_TYPE = 'application/pdf';
const PDF_EXTENSION = /\.pdf$/i;

interface ReadPage {
  readonly positioned: PdfPositionedPage;
  readonly text: string;
}

function isTextItem(item: TextContent['items'][number]): item is TextItem {
  return 'str' in item;
}

async function readPage(page: PdfPageProxy, pageNumber: number): Promise<ReadPage> {
  const viewport = page.getViewport({ scale: 1 });
  const { items } = await page.getTextContent();
  const textItems = items.filter(isTextItem);
  // Η ΜΙΑ μετατροπή σε συντεταγμένες οθόνης — η ίδια που τρέχει ο server (ADR-920 §14.11 Ζ3).
  return { positioned: positionedPageOf(pageNumber, viewport, textItems), text: pageTextOf(textItems) };
}

async function readPages(doc: PdfDocProxy, maxPages: number): Promise<readonly ReadPage[]> {
  const pages: ReadPage[] = [];
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

/** Οι σελίδες του PDF — ή `null` όταν το pdf.js δεν το ανοίγει (χαλασμένο · κρυπτογραφημένο · όχι PDF). */
async function pagesOf(file: File, maxPages: number): Promise<readonly ReadPage[] | null> {
  const pdfjs = await loadPdfJs();
  let doc: PdfDocProxy;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
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

function isPdf(file: File): boolean {
  return file.type === PDF_TYPE || (file.type === '' && PDF_EXTENSION.test(file.name));
}

/**
 * **Διάβασε το έγγραφο στη συσκευή.** Πετά **μόνο** όταν το ίδιο το pdf.js δεν φορτώνει (βλάβη της εφαρμογής, όχι του
 * αρχείου) — η οθόνη το λέει ως «δοκιμάστε ξανά».
 */
export async function readDocumentOnDevice(document: ObjectiveValueEvidenceDocument, file: File): Promise<DeviceReadingOutcome> {
  const reader = deviceReaderOf(document);
  if (reader === null) return { kind: 'no-reader' };
  if (!isPdf(file)) return { kind: 'not-pdf' };
  if (file.size > DOCUMENT_TEXT_MAX_BYTES) return { kind: 'too-large' };
  const pages = await pagesOf(file, reader.maxPages);
  if (pages === null) return { kind: 'unparsable' };
  if (!hasReadableText(pages.map((page) => page.text))) return { kind: 'unreadable' };
  const rows = reader.read(pages.map((page) => page.positioned));
  return rows === null ? { kind: 'not-recognized' } : { kind: 'read', rows };
}
