'use client';

/**
 * ADR-923 §5.15.2 (Θ.2α-1) — **Ο ΕΝΑΣ κάτοχος του φορτωμένου εγγράφου** του `PdfCanvasViewer`: άνοιγμα, αλλαγή πηγής,
 * καταστροφή. Βγήκε από τον viewer για να μπει δεύτερος δρόμος χωρίς να ξεπεράσει εκείνος τα όρια μεγέθους (N.7.1).
 *
 * Δύο δρόμοι, που τους **δηλώνει** ο καλών (`PdfDocumentSource`):
 * - `file` — όλα τα bytes μία φορά (`pdfFetchTarget` → `loadPdfBytes`, ADR-901 §14.9 · ADR-912 §12.16). Αμετάβλητος.
 * - `licensed` — κομμάτια με ανανεώσιμη άδεια (`pdf-range-transport`): κατεβαίνει μόνο ό,τι ζητά η ορατή σελίδα
 *   (`disableAutoFetch` + `disableStream`, ο συνδυασμός που το pdf.js απαιτεί για να μη συνεχίσει να τραβά στο παρασκήνιο).
 *
 * 🔑 **Ταυτότητα, όχι αναφορά**: το έγγραφο ξαναφορτώνεται όταν αλλάξει **το αρχείο** (`url`/`fileId`/`urlDelivery` ή το
 *    `key` της άδειας) — ποτέ επειδή ο καλών έφτιαξε νέα συνάρτηση `issue` σε κάποιο render. Η συνάρτηση διαβάζεται τη
 *    στιγμή της ανανέωσης (μοτίβο getter, ADR-040).
 *
 * @module components/file-manager/usePdfDocument
 */

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';

import { createModuleLogger } from '@/lib/telemetry';

import { loadPdfJs, type PdfDocProxy, type PdfDocumentSource, type PdfjsLib, type PdfState } from './pdf-canvas-config';
import { loadPdfBytes } from './pdf-bytes-cache';
import { pdfFetchTarget } from './pdf-fetch-target';
import { openLicensedPdfTransport, PDF_INITIAL_CHUNK_BYTES, type IssuePdfLicense, type PdfRangeError } from './pdf-range-transport';

const logger = createModuleLogger('usePdfDocument');

interface OpenedPdf {
  readonly doc: PdfDocProxy;
  readonly dispose?: () => void;
}

/** Η ταυτότητα του αρχείου — η μόνη αιτία επαναφόρτωσης (και το κλειδί κάθε κατάστασης «ανά έγγραφο» του θεατή). */
export function sourceIdentityOf(source: PdfDocumentSource): string {
  return source.kind === 'licensed'
    ? `licensed\u0000${source.license.key}`
    : `file\u0000${source.urlDelivery ?? ''}\u0000${source.fileId ?? ''}\u0000${source.url}`;
}

async function openFile(lib: PdfjsLib, source: Extract<PdfDocumentSource, { kind: 'file' }>): Promise<OpenedPdf> {
  // 🔑 «Από πού, και με ποια διαπιστευτήρια;» το απαντά ο ΕΝΑΣ απαντητής (`pdfFetchTarget`, ADR-901 §14.9).
  const data = await loadPdfBytes(pdfFetchTarget(source));
  return { doc: await lib.getDocument({ data }).promise };
}

async function openLicensed(lib: PdfjsLib, issue: IssuePdfLicense, onFailure: (error: PdfRangeError) => void): Promise<OpenedPdf> {
  const opened = await openLicensedPdfTransport(lib.PDFDataRangeTransport, issue, onFailure);
  try {
    const task = lib.getDocument({
      range: opened.transport,
      rangeChunkSize: PDF_INITIAL_CHUNK_BYTES,
      disableAutoFetch: true,
      disableStream: true,
    });
    return { doc: await task.promise, dispose: opened.dispose };
  } catch (error) {
    opened.dispose();
    throw error;
  }
}

/** Το τεχνικό αίτιο πάει στο ημερολόγιο· ο άνθρωπος βλέπει μεταφρασμένο μήνυμα (N.11). ⛔ Ποτέ URL: μπορεί να είναι άδεια. */
function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface LoadContext {
  readonly isCancelled: () => boolean;
  /** Η πηγή **τώρα** — και για την ανανέωση της άδειας, που γίνεται πολύ αργότερα από τη φόρτωση. */
  readonly readSource: () => PdfDocumentSource;
  readonly fail: (error: unknown) => void;
}

async function openSource(ctx: LoadContext): Promise<OpenedPdf | null> {
  const lib = await loadPdfJs();
  if (ctx.isCancelled()) return null;
  const current = ctx.readSource();
  if (current.kind === 'file') return openFile(lib, current);
  const issue: IssuePdfLicense = (signal) => {
    const latest = ctx.readSource();
    return latest.kind === 'licensed' ? latest.license.issue(signal) : Promise.reject(new Error('PDF source changed'));
  };
  return openLicensed(lib, issue, ctx.fail);
}

function closeOpened(opened: OpenedPdf): void {
  opened.doc.destroy().catch(() => undefined);
  opened.dispose?.();
}

/**
 * Φορτώνει το έγγραφο της πηγής και γράφει `numPages`/`loading`/`error` στην κατάσταση του θεατή.
 * `onReset` τρέχει πριν από κάθε νέα φόρτωση (ο θεατής ξεχνά τι είχε ζωγραφίσει).
 */
export function usePdfDocument(
  source: PdfDocumentSource,
  setState: Dispatch<SetStateAction<PdfState>>,
  onReset: () => void,
): RefObject<PdfDocProxy | null> {
  const docRef = useRef<PdfDocProxy | null>(null);
  const sourceRef = useRef(source);
  const onResetRef = useRef(onReset);
  useEffect(() => {
    sourceRef.current = source;
    onResetRef.current = onReset;
  });

  const identity = sourceIdentityOf(source);

  useEffect(() => {
    let cancelled = false;
    let opened: OpenedPdf | null = null;
    const fail = (error: unknown) => {
      if (cancelled) return;
      logger.warn('PDF load failed', { error: describeFailure(error), source: sourceRef.current.kind });
      setState((s) => ({ ...s, loading: false, error: describeFailure(error) }));
    };

    onResetRef.current();
    setState((s) => ({ ...s, loading: true, error: null }));
    openSource({ isCancelled: () => cancelled, readSource: () => sourceRef.current, fail }).then((result) => {
      opened = result;
      if (!result) return;
      if (cancelled) { closeOpened(result); return; }
      docRef.current = result.doc;
      setState((s) => ({ ...s, numPages: result.doc.numPages, currentPage: 1, loading: false }));
    }, fail);

    return () => {
      cancelled = true;
      docRef.current = null;
      if (opened) closeOpened(opened);
    };
    // ⚠️ Μόνο η ταυτότητα του αρχείου: η πηγή διαβάζεται από το ref τη στιγμή της φόρτωσης.
  }, [identity, setState]);

  return docRef;
}
