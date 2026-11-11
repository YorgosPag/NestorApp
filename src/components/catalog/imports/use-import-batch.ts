'use client';

/**
 * @fileoverview **Μία παρτίδα σε έλεγχο** (ADR-923 §5.5.1): φόρτωση, ανάγνωση σελίδων με πρόοδο, αποφάσεις, έγκριση.
 * @module components/catalog/imports/use-import-batch
 *
 * 🔑 **Οι σελίδες διαβάζονται μία-μία από εδώ**: ένα αίτημα ανά σελίδα, ζωντανή πρόοδος, συνέχιση μετά από διακοπή (η
 *    διαβασμένη σελίδα δεν ξαναπληρώνεται). Ο διακομιστής κρίνει· το hook απλώς προχωρά στην επόμενη.
 * 🔑 **Κάθε απάντηση αντικαθιστά την πρόταση**: ο διακομιστής ξανακρίνει σε κάθε απόφαση, άρα η οθόνη δεν μαντεύει ποτέ τα ευρήματα.
 *    Η απόφαση φαίνεται αμέσως και στέλνεται σειριακά (`proposal-change-queue`, §5.5.2 Α5)· η επαναφόρτωση τη σέβεται.
 * 📡 **Ζωντανή σε κάθε καρτέλα** (§5.5.2, ADR-905): η όψη ακούει το σήμα της παρτίδας (`use-live-import-batch-view`).
 * ↶ **Αναίρεση / επανάληψη** (§5.5.2 Β9β): το `change` που βγαίνει από εδώ γράφει και στη στοίβα (`use-review-history`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { usePendingHold, useReleaseWhenSettled } from '@/hooks/catalog/useCatalogServerView';
import { discardImportBatch, readImportPage, setImportPriceTarget } from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import type { ImportBatchPages } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_PAGE_ESTIMATED_COST_USD } from '@/subapps/catalog/vocabulary/catalog-import';
import { createQueueState, useProposalChangeQueue } from './proposal-change-queue';
import { useAxisOptions } from './use-axis-options';
import { useLineDecisions } from './use-line-decisions';
import { useLiveImportBatchView } from './use-live-import-batch-view';
import { usePageUpgrade } from './use-page-upgrade';
import { useReviewHistory } from './use-review-history';
import { useSupplierMemory } from './use-supplier-memory';

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
  const queued = useRef(createQueueState());
  const hold = usePendingHold();
  const { view, setView, failure, setFailure, reload, accept, refreshing, release } = useLiveImportBatchView(batchId, queued, hold);

  const discard = useCallback(async () => {
    if (!view) return;
    try {
      await discardImportBatch(view.batch.id, view.batch.revision);
      await reload();
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    }
  }, [reload, setFailure, view]);

  const changes = useProposalChangeQueue({ setView, setFailure, reload, queued });
  const lines = useLineDecisions(changes.line);
  // §5.5.2 Β9β · Β9δ: κάθε πράξη του ανθρώπου (πεδία · κωδικός μοντέλου · απόφαση γραμμής) γράφεται στη στοίβα αναίρεσης εδώ,
  // στο ΕΝΑ σημείο από όπου περνούν όλες.
  const review = useReviewHistory(view, changes.change, lines.decideLine, changes.saving.size);
  // §5.5.2 (ADR-905): η ανανέωση από το σήμα περιμένει τις αισιόδοξες αλλαγές **και** τις δικές μας επαναφορτώσεις.
  useReleaseWhenSettled(hold, changes.saving.size + refreshing, release);
  const reader = usePageReader(batchId, view, setFailure, reload);
  const upgrade = usePageUpgrade({ view, busy: reader.reading, accept, setFailure });
  const priceTarget = usePriceTarget(view, accept, setFailure);
  const supplier = useSupplierMemory({ view, accept, setFailure });
  const axisOptions = useAxisOptions(view?.batch.id ?? null, accept, setFailure);
  return { view, failure, reload, discard, ...reader, upgrade, ...changes, change: review.change, history: review.history, lineActivity: lines.lineActivity, decideLine: review.decideLine, ...priceTarget, supplier, axisOptions };
}

/** §5.5.2 Β4 Δ1: ο τιμοκατάλογος της παρτίδας. Η απάντηση είναι όλη η όψη, με τις ξανασχεδιασμένες προτάσεις τιμών. */
function usePriceTarget(view: ImportBatchDetailView | null, accept: (fresh: ImportBatchDetailView) => void, setFailure: SetFailure) {
  const [savingPriceTarget, setSaving] = useState(false);
  const setPriceTarget = useCallback(async (priceListVersionId: string | null) => {
    if (!view) return;
    setSaving(true);
    try {
      accept(await setImportPriceTarget(view.batch.id, { expectedRevision: view.batch.revision, priceListVersionId }));
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    } finally {
      setSaving(false);
    }
  }, [accept, setFailure, view]);
  return { savingPriceTarget, setPriceTarget };
}
