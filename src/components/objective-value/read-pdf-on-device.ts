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

import { readPdfPagesOnDevice, type DevicePdfPage } from '@/components/file-manager/pdf-device-pages';
import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';
import { deviceReaderOf, type ObjectiveValueDocumentRow } from '@/lib/objective-value/objective-value-device-readers';
import { DOCUMENT_TEXT_MAX_BYTES, hasReadableText } from '@/lib/pdf/pdf-page-text';

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

/** Οι σελίδες του PDF — η ΜΙΑ συνταγή της συσκευής (`pdf-device-pages`, κοινή με το τοπογραφικό, ADR-920 §14.11 Ζ4). */
async function pagesOf(file: File, maxPages: number): Promise<readonly DevicePdfPage[] | null> {
  return readPdfPagesOnDevice(new Uint8Array(await file.arrayBuffer()), maxPages);
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
