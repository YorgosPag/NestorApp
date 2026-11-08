'use client';

/**
 * @fileoverview **Μία παρτίδα σε έλεγχο** (ADR-923 §5.5.1): φόρτωση, ανάγνωση σελίδων με πρόοδο, αποφάσεις, έγκριση.
 * @module components/catalog/imports/use-import-batch
 *
 * 🔑 **Οι σελίδες διαβάζονται μία-μία από εδώ**: ένα αίτημα ανά σελίδα, ζωντανή πρόοδος, συνέχιση μετά από διακοπή (η
 *    διαβασμένη σελίδα δεν ξαναπληρώνεται). Ο διακομιστής κρίνει· το hook απλώς προχωρά στην επόμενη.
 * 🔑 **Κάθε απάντηση αντικαθιστά την πρόταση**: ο διακομιστής ξανακρίνει σε κάθε απόφαση, άρα η οθόνη δεν μαντεύει ποτέ τα ευρήματα.
 *    Η απόφαση φαίνεται αμέσως και στέλνεται σειριακά (`proposal-change-queue`, §5.5.2 Α5)· η επαναφόρτωση τη σέβεται.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { discardImportBatch, fetchImportBatch, readImportPage } from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import type { ImportBatchPages } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_PAGE_ESTIMATED_COST_USD } from '@/subapps/catalog/vocabulary/catalog-import';
import { createQueueState, overlayView, queuedDecisionsOf, useProposalChangeQueue } from './proposal-change-queue';
import { useLineDecisions } from './use-line-decisions';
import { usePageUpgrade } from './use-page-upgrade';

/** Οι σελίδες που μένουν: όσες δεν έχουν κριθεί, και όσες απέτυχαν όταν ζητηθεί ρητά επανάληψη. */
export function pagesToRead(pages: ImportBatchPages, retryFailed: boolean): number[] {
  const judged = new Set([...pages.done, ...(retryFailed ? [] : pages.failed)]);
  return Array.from({ length: pages.to - pages.from + 1 }, (_, index) => pages.from + index).filter((page) => !judged.has(page));
}

/** Το κόστος ανά σελίδα: η μέτρηση αυτής της παρτίδας, αλλιώς η δηλωμένη εκτίμηση. */
export function costPerPage(pages: ImportBatchPages): number {
  const judged = pages.done.length + pages.failed.length;
  const spent = pages.usage?.costUsd ?? null;
  return spent !== null && judged > 0 ? spent / judged : IMPORT_PAGE_ESTIMATED_COST_USD;
}

type SetFailure = (failure: CatalogFailure | null) => void;

function usePageReader(batchId: string, view: ImportBatchDetailView | null, setFailure: SetFailure, reload: () => Promise<void>) {
  const [reading, setReading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, [batchId]);
  const readPages = useCallback(async (retryFailed: boolean) => {
    const pages = view?.batch.pages;
    if (!pages) return;
    cancelled.current = false;
    setStopping(false);
    setReading(true);
    setFailure(null);
    try {
      for (const page of pagesToRead(pages, retryFailed)) {
        if (cancelled.current) break;
        await readImportPage(batchId, page);
        await reload();
      }
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    } finally {
      setReading(false);
      setStopping(false);
    }
  }, [batchId, reload, setFailure, view]);
  /** Η σελίδα που διαβάζεται τελειώνει, γιατί έχει ήδη πληρωθεί· καμία επόμενη δεν ξεκινά. */
  const stopReading = useCallback(() => {
    cancelled.current = true;
    setStopping(true);
  }, []);
  return { reading, stopping, readPages, stopReading };
}

export function useImportBatch(batchId: string) {
  const [view, setView] = useState<ImportBatchDetailView | null>(null);
  const [failure, setFailure] = useState<CatalogFailure | null>(null);
  const queued = useRef(createQueueState());

  const reload = useCallback(async () => {
    try {
      const fresh = await fetchImportBatch(batchId);
      setView(overlayView(fresh, queuedDecisionsOf(queued.current)));
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    }
  }, [batchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const discard = useCallback(async () => {
    if (!view) return;
    try {
      await discardImportBatch(view.batch.id, view.batch.revision);
      await reload();
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    }
  }, [reload, view]);

  const changes = useProposalChangeQueue({ setView, setFailure, reload, queued });
  const reader = usePageReader(batchId, view, setFailure, reload);
  const accept = useCallback((fresh: ImportBatchDetailView) => setView(overlayView(fresh, queuedDecisionsOf(queued.current))), []);
  const upgrade = usePageUpgrade({ view, busy: reader.reading, accept, setFailure });
  return { view, failure, reload, discard, ...reader, upgrade, ...changes, ...useLineDecisions(changes.line) };
}
