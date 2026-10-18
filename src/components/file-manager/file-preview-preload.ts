/**
 * ADR-912 §12.16 — **Προφόρτωση του γειτονικού αρχείου του θεατή** (Google Drive: το επόμενο είναι έτοιμο πριν πατηθεί).
 *
 * 🔑 **Μόνο PDF**: είναι ο τύπος που κοστίζει (λήψη ολόκληρου του αρχείου + ανάλυση) και το σχεδόν όλο περιεχόμενο της
 *   καρτέλας «Έγγραφα». Η εικόνα **δεν** προφορτώνεται εδώ: ο θεατής της διαλέγει βαθμίδα παραγώγου από το μετρημένο
 *   κουτί και το zoom (ADR-899 §4.1) — μια προφόρτωση χωρίς αυτά θα κατέβαζε **άλλο** αρχείο από αυτό που θα δειχτεί.
 * 🔑 **Το ΙΔΙΟ αίτημα με τον θεατή**: `fileDisplayUrlOf` + `fileId` ⇒ `pdfFetchTarget`, ακριβώς όπως τα δίνει το
 *   `FilePreviewPanel` στο `PdfCanvasViewer` — αλλιώς η μνήμη θα είχε άλλο κλειδί και η προφόρτωση θα ήταν σπατάλη.
 * ⚠️ **Σεβασμός στα δεδομένα του ανθρώπου**: «Εξοικονόμηση δεδομένων» ⇒ τίποτα· πάνω από {@link PRELOAD_MAX_BYTES} ⇒
 *   τίποτα (ένα σχέδιο 80MB δεν κατεβαίνει «για καλό και για κακό» σε κινητό δίκτυο).
 */

import { fileDisplayUrlOf } from '@/lib/files/file-display-url';
import { getPreviewType } from '@/lib/file-types/preview-registry';
import type { FileRecord } from '@/types/file-record';

import { preloadPdfBytes } from './pdf-bytes-cache';
import { pdfFetchTarget } from './pdf-fetch-target';

/** Ανώτατο μέγεθος αρχείου που προφορτώνεται χωρίς να το ζητήσει ο άνθρωπος. */
export const PRELOAD_MAX_BYTES = 20 * 1024 * 1024;

interface NetworkInformationLike {
  readonly saveData?: boolean;
}

function savesData(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator as Navigator & { readonly connection?: NetworkInformationLike }).connection?.saveData === true;
}

/** Αξίζει να προφορτωθεί; Καθαρή κρίση πάνω στην εγγραφή — το δίκτυο το ρωτά ο {@link preloadFilePreview}. */
export function isPreloadableFile(file: FileRecord): boolean {
  if (getPreviewType(file.contentType, file.originalFilename) !== 'pdf') return false;
  // Άγνωστο μέγεθος ⇒ όχι: η προφόρτωση είναι δώρο, όχι ρίσκο.
  return typeof file.sizeBytes === 'number' && file.sizeBytes <= PRELOAD_MAX_BYTES;
}

/** Ξεκινά, χωρίς αναμονή, τη λήψη που θα κάνει ο θεατής όταν ανοίξει αυτό το αρχείο. */
export function preloadFilePreview(file: FileRecord): void {
  if (savesData() || !isPreloadableFile(file)) return;
  const display = fileDisplayUrlOf(file);
  if (display.kind !== 'url') return;
  preloadPdfBytes(pdfFetchTarget({ url: display.url, fileId: file.id }));
}
