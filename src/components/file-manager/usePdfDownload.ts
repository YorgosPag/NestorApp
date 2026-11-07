'use client';

/**
 * ADR-923 §5.15.2 (Θ.2α-2) — **Λήψη του εγγράφου που ήδη φαίνεται**: `doc.getData()` → Blob → `triggerExportDownload`.
 *
 * 🔑 Τα bytes έρχονται από το **ίδιο** φορτωμένο έγγραφο: σε έντυπο με άδεια, το pdf.js ζητά τα κομμάτια που λείπουν
 *    μέσα από το **ίδιο** range transport (`pdf-range-transport`), με την **ίδια** αυτο-ανανεούμενη άδεια. Καμία δεύτερη
 *    πόρτα, κανένας `Content-Disposition: attachment` (ADR-923 Η4), κανένας σύνδεσμος του GCS στο DOM.
 * 🔑 Single-flight: δεύτερο πάτημα όσο κατεβαίνει δεν ξεκινά δεύτερη λήψη.
 * 🔑 Η αποτυχία μένει **στη μπάρα του θεατή** (`status`), όχι σε toast: ο πάροχος ειδοποιήσεων ζει μόνο στα `(app)`/`(me)`
 *    layouts, ενώ το έντυπο θα ανοίγει και στη δημόσια βιτρίνα.
 * ⛔ Δεν μετρά λήψη (ADR-923 §5.15.1 Θ.1β-5 — η προβολή δεν είναι «χρήση» της έκδοσης για τη διατήρηση).
 *
 * @module components/file-manager/usePdfDownload
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { createModuleLogger } from '@/lib/telemetry';

import type { PdfDocProxy } from './pdf-canvas-config';

const logger = createModuleLogger('usePdfDownload');

export type PdfDownloadStatus = 'idle' | 'busy' | 'failed';

export interface PdfDownload {
  readonly status: PdfDownloadStatus;
  readonly download: () => void;
}

/** `fileName = null` ⇒ η λήψη δεν προσφέρεται (ο καλών δεν τη ζήτησε). `documentKey` αλλάζει ⇒ ξεχνιέται η παλιά αποτυχία. */
export function usePdfDownload(docRef: RefObject<PdfDocProxy | null>, fileName: string | null, documentKey: string): PdfDownload {
  const [status, setStatus] = useState<PdfDownloadStatus>('idle');
  const inFlightRef = useRef(false);

  useEffect(() => { setStatus('idle'); }, [documentKey]);

  const download = useCallback(() => {
    const doc = docRef.current;
    if (!doc || fileName === null || inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('busy');
    doc.getData().then((data) => {
      triggerExportDownload({ blob: new Blob([data], { type: 'application/pdf' }), filename: fileName });
      setStatus('idle');
    }, (error: unknown) => {
      logger.warn('PDF download failed', { error: error instanceof Error ? error.message : String(error) });
      setStatus('failed');
    }).finally(() => { inFlightRef.current = false; });
  }, [docRef, fileName]);

  return { status, download };
}
