'use client';

/**
 * ADR-923 §5.15.2 (Θ.2α-2) — **Ο ΕΝΑΣ κάτοχος της τρέχουσας σελίδας** του `PdfCanvasViewer`.
 *
 * Μέγεθος (προσαρμογή ζουμ), στρώση κειμένου και στρώση συνδέσμων ρωτούν την **ίδια** σελίδα· ένα `getPage` ανά αλλαγή
 * σελίδας, όχι ένα ανά στρώση. Αντικατέστησε το `usePdfPageBase` του viewer (που κρατούσε μόνο το μέγεθος).
 *
 * Κάθε σελίδα έχει το **δικό της** μέγεθος (ένα PDF μπορεί να ανακατεύει Α4 και Α3) — ως την 2026-11-07 η προσαρμογή
 * μετρούσε μόνο τη σελίδα 1, και μία φορά, στη φόρτωση.
 *
 * @module components/file-manager/usePdfCurrentPage
 */

import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';

import type { Extent } from '@/lib/geometry/zoom-pan-math';

import type { PdfDocProxy, PdfPageProxy, PdfState } from './pdf-canvas-config';

export interface PdfCurrentPage {
  /** Η σελίδα **που φαίνεται** — `null` πριν φορτώσει ή στην αλλαγή εγγράφου. */
  readonly page: PdfPageProxy | null;
  readonly pageNumber: number;
  /** Μέγεθος σε κλίμακα 1, χωρίς στροφή. Σε αλλαγή σελίδας μένει το προηγούμενο ως να έρθει το νέο (καμία αναλαμπή). */
  readonly base: Extent | null;
}

interface Loaded {
  readonly page: PdfPageProxy;
  readonly pageNumber: number;
  readonly base: Extent;
}

export function usePdfCurrentPage(docRef: RefObject<PdfDocProxy | null>, state: PdfState): PdfCurrentPage {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const doc = docRef.current;
    if (!doc || state.loading || state.numPages === 0) {
      setLoaded(null);
      return;
    }
    let cancelled = false;
    doc.getPage(state.currentPage).then((page) => {
      if (cancelled) return;
      const { width, height } = page.getViewport({ scale: 1 });
      setLoaded((prev) => ({
        page,
        pageNumber: state.currentPage,
        base: prev && prev.base.width === width && prev.base.height === height ? prev.base : { width, height },
      }));
    }).catch(() => { /* το σφάλμα σελίδας το δείχνει ο ζωγράφος — εδώ μένει η προηγούμενη */ });
    return () => { cancelled = true; };
  }, [docRef, state.loading, state.numPages, state.currentPage]);

  // Οι στρώσεις βλέπουν σελίδα ΜΟΝΟ όταν είναι αυτή που ζητήθηκε — ποτέ τις σημειώσεις της προηγούμενης πάνω στη νέα.
  const current = loaded !== null && loaded.pageNumber === state.currentPage ? loaded.page : null;
  return { page: current, pageNumber: state.currentPage, base: loaded?.base ?? null };
}

/**
 * Η σελίδα του καλούντα (έλεγχος δίπλα-δίπλα, ADR-923 §5.5.1) νικά τη δική του πλοήγηση, και ξαναϊσχύει όταν φορτώσει το
 * έγγραφο. Απούσα ⇒ καμία επίδραση. (Μετακόμισε εδώ από το `PdfHighlights`, που καταργήθηκε στο §5.5.2 Β8: η τρέχουσα σελίδα
 * έχει **έναν** κάτοχο, αυτό το αρχείο.)
 */
export function useControlledPdfPage(page: number | undefined, numPages: number, setState: Dispatch<SetStateAction<PdfState>>): void {
  useEffect(() => {
    if (page !== undefined && numPages > 0) setState((s) => ({ ...s, currentPage: Math.min(page, s.numPages) }));
  }, [page, numPages, setState]);
}
