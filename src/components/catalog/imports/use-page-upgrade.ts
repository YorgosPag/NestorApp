'use client';

/**
 * @fileoverview **Αναβάθμιση κατά το άνοιγμα** (ADR-923 §5.5.2 Β3.1): όταν ανοίγει παρτίδα με σελίδες γραμμένες από παλαιότερη έκδοση
 *   παραγωγής, ζητά από τον διακομιστή να τις ξαναχτίσει, **μία τη φορά**, χωρίς AI. Όπως το Revit: ο άνθρωπος βλέπει ότι γίνεται
 *   αναβάθμιση, η αναθεώρηση περιμένει, και τα παράγωγα δεν μένουν ποτέ σιωπηλά μπαγιάτικα.
 * @module components/catalog/imports/use-page-upgrade
 *
 * 🔑 Ο κριτής είναι ο ίδιος με του διακομιστή (`stalePages`)· ο διακομιστής ξανακρίνει, άρα δύο καρτέλες δεν βλάπτουν (ιδεμπότητο).
 * 🔑 Κάθε σελίδα ζητείται **μία φορά ανά άνοιγμα**: αποτυχία μεταφοράς δεν γίνεται βρόχος, ξαναδοκιμάζεται στο επόμενο άνοιγμα.
 */

import { useEffect, useRef, useState } from 'react';

import { reinterpretImportPage } from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import { stalePages } from '@/subapps/catalog/import/page-derivation';
import type { ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_FINISHED_BATCH_STATUSES } from '@/subapps/catalog/vocabulary/catalog-import';

export interface PageUpgradeProgress {
  readonly done: number;
  readonly total: number;
}

interface PageUpgradeDeps {
  readonly view: ImportBatchDetailView | null;
  /** Δεν αναβαθμίζουμε όσο διαβάζονται σελίδες: η ανάγνωση γράφει ήδη την τρέχουσα έκδοση. */
  readonly busy: boolean;
  readonly accept: (view: ImportBatchDetailView) => void;
  readonly setFailure: (failure: CatalogFailure | null) => void;
}

/** Οι μπαγιάτικες σελίδες ανοιχτής παρτίδας που δεν ζητήθηκαν ακόμη σε αυτό το άνοιγμα. */
function pagesToUpgrade(view: ImportBatchDetailView | null, asked: ReadonlySet<number>): number[] {
  const { batch } = view ?? {};
  if (!batch?.pages || IMPORT_FINISHED_BATCH_STATUSES.includes(batch.status)) return [];
  return stalePages(batch.pages).filter((page) => !asked.has(page));
}

export function usePageUpgrade({ view, busy, accept, setFailure }: PageUpgradeDeps): PageUpgradeProgress | null {
  const [progress, setProgress] = useState<PageUpgradeProgress | null>(null);
  const asked = useRef(new Set<number>());
  const running = useRef(false);
  const batchId = view?.batch.id ?? null;
  const active = useRef(batchId);
  useEffect(() => {
    active.current = batchId;
    asked.current = new Set();
  }, [batchId]);
  useEffect(() => {
    const pages = pagesToUpgrade(view, asked.current);
    if (busy || running.current || batchId === null || pages.length === 0) return;
    running.current = true;
    for (const page of pages) asked.current.add(page);
    void (async () => {
      try {
        for (const [index, page] of pages.entries()) {
          setProgress({ done: index, total: pages.length });
          const fresh = await reinterpretImportPage(batchId, page);
          // Άλλαξε παρτίδα στο μεταξύ: η απάντηση ανήκει στην παλιά, δεν μπαίνει στην όψη της νέας.
          if (active.current !== batchId) break;
          accept(fresh);
        }
      } catch (cause) {
        setFailure(catalogFailureOf(cause));
      } finally {
        running.current = false;
        setProgress(null);
      }
    })();
  }, [accept, batchId, busy, setFailure, view]);
  return progress;
}
