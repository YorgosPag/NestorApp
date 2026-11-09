'use client';

/**
 * @fileoverview **Ο προμηθευτής μιας παρτίδας και η μνήμη του** (ADR-923 §5.5.2 Β5.2): ορισμός προμηθευτή, διακόπτης μάθησης, ρητή
 *   εφαρμογή και αναίρεση όλων της μνήμης. Κάθε απάντηση είναι όλη η όψη· η οθόνη δεν μαντεύει τι έκανε ο διακομιστής.
 * @module components/catalog/imports/use-supplier-memory
 *
 * 🔑 Ίδιο μοτίβο με τον τιμοκατάλογο της παρτίδας (`usePriceTarget`): CAS στην αναθεώρηση που βλέπει ο άνθρωπος, μία πράξη τη φορά.
 * 🔑 Η πράξη μνήμης αφήνει πίσω της **τι έγινε** (`ImportMemoryActionOutcome`), ώστε ο άνθρωπος να δει γραμμές, αρνήσεις και όριο.
 */

import { useCallback, useState } from 'react';

import { runImportMemoryAction, setImportSupplier } from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import type { ImportBatchDetailView, ImportMemoryActionRequest } from '@/subapps/catalog/types/catalog-import-requests';
import type { MemoryActionReport } from './supplier-field-props';

interface SupplierMemoryDeps {
  readonly view: ImportBatchDetailView | null;
  readonly accept: (fresh: ImportBatchDetailView) => void;
  readonly setFailure: (failure: CatalogFailure | null) => void;
}

export function useSupplierMemory({ view, accept, setFailure }: SupplierMemoryDeps) {
  const [savingSupplier, setSaving] = useState(false);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryReport, setReport] = useState<MemoryActionReport | null>(null);

  const saveSupplier = useCallback(async (change: { readonly supplierContactId?: string | null; readonly learnLabels?: boolean }) => {
    if (!view || view.batch.target.purpose !== 'attributes') return;
    const { target } = view.batch;
    setSaving(true);
    try {
      const supplierContactId = change.supplierContactId === undefined ? (target.supplierContactId ?? null) : change.supplierContactId;
      accept(await setImportSupplier(view.batch.id, { expectedRevision: view.batch.revision, supplierContactId, learnLabels: change.learnLabels ?? target.learnLabels ?? true }));
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    } finally {
      setSaving(false);
    }
  }, [accept, setFailure, view]);

  const runMemory = useCallback(async (action: ImportMemoryActionRequest['action']) => {
    if (!view) return;
    setMemoryBusy(true);
    setReport(null);
    try {
      const result = await runImportMemoryAction(view.batch.id, { action });
      accept(result.view);
      setReport({ action, outcome: result.outcome });
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    } finally {
      setMemoryBusy(false);
    }
  }, [accept, setFailure, view]);

  return {
    savingSupplier,
    setSupplier: useCallback((supplierContactId: string | null) => saveSupplier({ supplierContactId }), [saveSupplier]),
    setLearning: useCallback((learnLabels: boolean) => saveSupplier({ learnLabels }), [saveSupplier]),
    memoryBusy,
    memoryReport,
    runMemory,
    /** Αποτυχία της επιφάνειας (λίστα μνήμης) ⇒ η ίδια ειδοποίηση με κάθε άλλη αποτυχία της παρτίδας. */
    reportFailure: setFailure,
  };
}
