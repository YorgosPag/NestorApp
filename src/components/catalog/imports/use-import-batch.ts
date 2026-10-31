'use client';

/**
 * @fileoverview **Μία παρτίδα σε έλεγχο** (ADR-923 §5.5.1): φόρτωση, ανάγνωση σελίδων με πρόοδο, αποφάσεις, έγκριση.
 * @module components/catalog/imports/use-import-batch
 *
 * 🔑 **Οι σελίδες διαβάζονται μία-μία από εδώ**: ένα αίτημα ανά σελίδα, ζωντανή πρόοδος, συνέχιση μετά από διακοπή (η
 *    διαβασμένη σελίδα δεν ξαναπληρώνεται). Ο διακομιστής κρίνει· το hook απλώς προχωρά στην επόμενη.
 * 🔑 **Κάθε απάντηση αντικαθιστά την πρόταση**: ο διακομιστής ξανακρίνει σε κάθε απόφαση, άρα η οθόνη δεν μαντεύει ποτέ τα ευρήματα.
 */

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import {
  applyImportProposal,
  discardImportBatch,
  fetchImportBatch,
  readImportPage,
  rejectImportProposal,
  updateImportProposal,
} from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import type { ImportBatchPages } from '@/subapps/catalog/types/catalog-import';
import type {
  ImportBatchDetailView,
  ImportFieldDecisionInput,
  ImportFieldEditInput,
  ImportProposalWire,
} from '@/subapps/catalog/types/catalog-import-requests';

/** Οι σελίδες που μένουν: όσες δεν έχουν κριθεί, και όσες απέτυχαν όταν ζητηθεί ρητά επανάληψη. */
export function pagesToRead(pages: ImportBatchPages, retryFailed: boolean): number[] {
  const judged = new Set([...pages.done, ...(retryFailed ? [] : pages.failed)]);
  return Array.from({ length: pages.to - pages.from + 1 }, (_, index) => pages.from + index).filter((page) => !judged.has(page));
}

export interface ProposalChange {
  readonly decisions?: readonly ImportFieldDecisionInput[];
  readonly edits?: readonly ImportFieldEditInput[];
  readonly modelCode?: string | null;
}

type SetView = Dispatch<SetStateAction<ImportBatchDetailView | null>>;
type SetFailure = (failure: CatalogFailure | null) => void;

function useProposalActions(setView: SetView, setFailure: SetFailure, reload: () => Promise<void>) {
  const run = useCallback(async (work: () => Promise<ImportProposalWire>) => {
    setFailure(null);
    try {
      const next = await work();
      setView((current) => current && { ...current, proposals: current.proposals.map((proposal) => (proposal.id === next.id ? next : proposal)) });
      await reload();
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    }
  }, [reload, setFailure, setView]);

  const change = useCallback((proposal: ImportProposalWire, input: ProposalChange) => run(() =>
    updateImportProposal(proposal.id, { expectedRevision: proposal.revision, decisions: input.decisions ?? [], edits: input.edits ?? [], modelCode: input.modelCode ?? null }),
  ), [run]);
  const apply = useCallback((proposal: ImportProposalWire) => run(() => applyImportProposal(proposal.id, proposal.revision)), [run]);
  const reject = useCallback((proposal: ImportProposalWire) => run(() => rejectImportProposal(proposal.id, proposal.revision)), [run]);
  return { change, apply, reject };
}

function usePageReader(batchId: string, view: ImportBatchDetailView | null, setFailure: SetFailure, reload: () => Promise<void>) {
  const [reading, setReading] = useState(false);
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
    }
  }, [batchId, reload, setFailure, view]);
  return { reading, readPages };
}

export function useImportBatch(batchId: string) {
  const [view, setView] = useState<ImportBatchDetailView | null>(null);
  const [failure, setFailure] = useState<CatalogFailure | null>(null);

  const reload = useCallback(async () => {
    try {
      setView(await fetchImportBatch(batchId));
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

  return { view, failure, reload, discard, ...usePageReader(batchId, view, setFailure, reload), ...useProposalActions(setView, setFailure, reload) };
}
