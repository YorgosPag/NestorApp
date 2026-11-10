'use client';

/**
 * @fileoverview **Η όψη μιας παρτίδας, ζωντανή σε κάθε ανοιχτή καρτέλα** (ADR-923 §5.5.2 · ADR-905 · ADR-901 §14.8).
 * @related services/realtime/hooks/use-server-view-signal.ts (ο ΕΝΑΣ ελεγκτής: σήμα · ορατότητα · δίκτυο · `freshUntil`) ·
 *   services/catalog/catalog-view-signal.client-ref.ts · server/catalog/import-reads.server.ts (`readImportBatchDetail`, ο μόνος παραγωγός)
 * @module components/catalog/imports/use-live-import-batch-view
 *
 * 🔑 **Κανένας νέος μηχανισμός**: η ζωντάνια είναι το `useServerViewSignal` με πηγή `importBatch:{id}` — ίδιο ιδίωμα με τους
 *    τιμοκαταλόγους. Αλλαγή από **άλλη** καρτέλα/χρήστη ⇒ σήμα ⇒ μία ανάγνωση· δική σου πράξη ⇒ η απάντηση φέρνει ήδη τη φρέσκια
 *    αναθεώρηση (`noteView`) ⇒ καμία δεύτερη.
 * ⚠️ **Μία πύλη αποδοχής** (`accept`) για κάθε όψη που φτάνει (αρχική φόρτωση · επαναφόρτωση · απάντηση πράξης · ανανέωση):
 *    **μονοτονική** — όψη με μικρότερη αναθεώρηση από αυτή που δείχνουμε απορρίπτεται, άρα μια αργή απάντηση δεν γυρίζει ποτέ
 *    πίσω την οθόνη ούτε τη βάση του CAS. Οι εκκρεμείς αποφάσεις ξαναμπαίνουν από πάνω (`overlayView`), όπως πριν.
 * ⚠️ **Αναμονή** (`isHeld`): όσο εκκρεμούν αισιόδοξες αλλαγές **ή** τρέχει δική μας επαναφόρτωση, η ανανέωση περιμένει —
 *    αλλιώς η επαναφόρτωση που κάνει η ουρά όταν αδειάζει θα συνέπιπτε με ανάγνωση από το σήμα της ίδιας πράξης (δύο GET).
 * ⚠️ Αποτυχημένη ανανέωση **στο παρασκήνιο** κρατά ό,τι δείχνουμε (stale-while-revalidate)· μόνο η ρητή επαναφόρτωση δείχνει σφάλμα.
 */

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import type { PendingHold } from '@/hooks/catalog/useCatalogServerView';
import { useCompanyId } from '@/hooks/useCompanyId';
import { fetchImportBatch } from '@/services/catalog/catalog-import-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import { catalogViewSignalSource } from '@/services/catalog/catalog-view-signal.client-ref';
import { useServerViewSignal, type ServerViewSignalSource } from '@/services/realtime/hooks/use-server-view-signal';
import { viewSignalRevisionOf } from '@/services/realtime/view-signal-revision';
import type { ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import { overlayView, queuedDecisionsOf, type QueueState } from './proposal-change-queue';

type SetFailure = (failure: CatalogFailure | null) => void;

export interface LiveImportBatchView {
  readonly view: ImportBatchDetailView | null;
  readonly setView: Dispatch<SetStateAction<ImportBatchDetailView | null>>;
  readonly failure: CatalogFailure | null;
  readonly setFailure: SetFailure;
  /** Ρητή επαναφόρτωση (μετά από πράξη ή κουμπί) — σφάλμα ⇒ ορατό. */
  readonly reload: () => Promise<void>;
  /** Η μία πύλη αποδοχής όψης (μονοτονική, με τις εκκρεμείς αποφάσεις από πάνω). */
  readonly accept: (fresh: ImportBatchDetailView) => void;
  /** Επαναφορτώσεις σε εξέλιξη — ο καλών τις προσθέτει στις εκκρεμείς αλλαγές της ουράς (`useReleaseWhenSettled`). */
  readonly refreshing: number;
  /** Η αναμονή τελείωσε — ό,τι ζήτησε το σήμα, ξεκινά. */
  readonly release: () => void;
}

/** Νεότερη ή ίση αναθεώρηση ⇒ δεκτή· παλαιότερη ⇒ μένει ό,τι δείχνουμε. */
export function acceptNewer(current: ImportBatchDetailView | null, fresh: ImportBatchDetailView): boolean {
  return current === null || fresh.freshness.revision >= current.freshness.revision;
}

function useBatchSignalSource(batchId: string): ServerViewSignalSource | null {
  const companyId = useCompanyId()?.companyId ?? null;
  return useMemo(() => (companyId ? catalogViewSignalSource(companyId, { kind: 'importBatch', batchId }) : null), [companyId, batchId]);
}

/** Οι επαναφορτώσεις που τρέχουν τώρα — μετρούν στην αναμονή μαζί με τις αλλαγές. */
function useRefreshCount() {
  const [refreshing, setRefreshing] = useState(0);
  const track = useCallback(async <T>(work: () => Promise<T>): Promise<T> => {
    setRefreshing((count) => count + 1);
    try {
      return await work();
    } finally {
      setRefreshing((count) => count - 1);
    }
  }, []);
  return { refreshing, track };
}

export function useLiveImportBatchView(batchId: string, queued: { readonly current: QueueState }, hold: PendingHold): LiveImportBatchView {
  const [view, setView] = useState<ImportBatchDetailView | null>(null);
  const [failure, setFailure] = useState<CatalogFailure | null>(null);
  const { refreshing, track } = useRefreshCount();

  const accept = useCallback((fresh: ImportBatchDetailView) => {
    setView((current) => (acceptNewer(current, fresh) ? overlayView(fresh, queuedDecisionsOf(queued.current)) : current));
  }, [queued]);

  const reload = useCallback(() => track(async () => {
    try {
      accept(await fetchImportBatch(batchId));
    } catch (cause) {
      setFailure(catalogFailureOf(cause));
    }
  }), [accept, batchId, track]);

  useEffect(() => { void reload(); }, [reload]);

  const fetch = useCallback(async (): Promise<number | null> => {
    const fresh = await fetchImportBatch(batchId);
    accept(fresh);
    return fresh.freshness.revision;
  }, [accept, batchId]);

  const { release } = useServerViewSignal({
    source: useBatchSignalSource(batchId),
    revisionOf: viewSignalRevisionOf,
    freshness: view === null ? 'pending' : view.freshness,
    fetch,
    isHeld: hold.isHeld,
    label: 'catalog-import-batch-view',
  });
  return { view, setView, failure, setFailure, reload, accept, refreshing, release };
}
