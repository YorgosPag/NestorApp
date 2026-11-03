'use client';

/**
 * @fileoverview **Η πράξη της εξαγωγής xChange** στην οθόνη (ADR-923 §5.14): ζητά, κατεβάζει το αρχείο, κρατά την αναφορά.
 * @module components/catalog/interop/use-xchange-export
 *
 * 🔑 **Μόνο η τελευταία αίτηση μετρά**: αλλαγή κοινού ή κλείσιμο ενώ τρέχει μια εξαγωγή ⇒ η παλιά απάντηση δεν κατεβαίνει ούτε
 *    γράφει αναφορά (μετρητής αιτήσεων, όχι σημαία που μένει κολλημένη).
 * 🔑 Άρνηση με ευρήματα (λίστα που δεν προσφέρεται, χωρίς επωνυμία) ⇒ στο παράθυρο, δίπλα στην επιλογή. Κάθε άλλη αποτυχία ⇒
 *    η μία ειδοποίηση του καταλόγου.
 */

import { useCallback, useRef, useState } from 'react';

import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { fetchXChangeExport } from '@/services/catalog/catalog-interop-api.client';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { XChangeExportSummary } from '@/subapps/catalog/types/xchange-export';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';

export type XChangeExportState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'exporting' }
  | { readonly kind: 'done'; readonly summary: XChangeExportSummary }
  | { readonly kind: 'refused'; readonly issues: readonly CatalogIssue[] };

const IDLE: XChangeExportState = { kind: 'idle' };
const EXPORTING: XChangeExportState = { kind: 'exporting' };

/** Το αρχείο όπως το ζητά ο παραλήπτης: JSON σε UTF-8, με εσοχή για να διαβάζεται και από άνθρωπο. */
function download(document: unknown, fileName: string): void {
  triggerExportDownload({ blob: new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }), filename: fileName });
}

export function useXChangeExport() {
  const notifyFailure = useCatalogFailureNotice();
  const [state, setState] = useState<XChangeExportState>(IDLE);
  const latest = useRef(0);
  const reset = useCallback(() => {
    latest.current += 1;
    setState(IDLE);
  }, []);
  const run = useCallback(async (priceListId: string | null, language: string) => {
    const request = ++latest.current;
    setState(EXPORTING);
    try {
      const wire = await fetchXChangeExport(priceListId, language);
      if (request !== latest.current) return;
      download(wire.document, wire.summary.fileName);
      setState({ kind: 'done', summary: wire.summary });
    } catch (cause) {
      if (request !== latest.current) return;
      const failure = catalogFailureOf(cause);
      setState(failure.issues.length > 0 ? { kind: 'refused', issues: failure.issues } : IDLE);
      if (failure.issues.length === 0) notifyFailure(failure);
    }
  }, [notifyFailure]);
  return { state, run, reset };
}
