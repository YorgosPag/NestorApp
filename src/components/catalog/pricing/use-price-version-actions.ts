'use client';

/**
 * @fileoverview **Οι πράξεις πάνω στις εκδόσεις ενός τιμοκαταλόγου** — νέα (με σπορά) · «ισχύει από» · απόρριψη
 *   (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related services/catalog/catalog-pricing-api.client.ts (μεταφορά) · hooks/catalog/usePriceListViews.ts (η όψη)
 * @module components/catalog/pricing/use-price-version-actions
 *
 * 🔑 **Η όψη είναι η αλήθεια**: μετά από κάθε πράξη `revalidate()` (στο παρασκήνιο, χωρίς «φορτώνει»)· το σήμα της όψης
 *    φέρνει έτσι κι αλλιώς την αλλαγή — η ρητή ανανέωση απλώς δεν περιμένει το σήμα για τη δική μας πράξη.
 * 🔑 **Σπορά με πρόοδο**: «από την τρέχουσα» αντιγράφει σε τμήματα· η οθόνη δείχνει «N αντιγράφηκαν» ζωντανά και, αν
 *    διακοπεί (δίκτυο · κλείσιμο σελίδας), η έκδοση μένει «σε εξέλιξη» με «Συνέχιση» — ο δρομέας ζει στον διακομιστή.
 * 🔑 Αποτυχίες με τη **μία** ερμηνεία (`catalogFailureOf`) + τη **μία** ειδοποίηση (`useCatalogFailureNotice`).
 */

import { useCallback, useMemo, useState } from 'react';

import { useMountedRef } from '@/hooks/useMountedRef';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import {
  createPriceListVersion,
  discardVersion,
  seedUntilDone,
  setVersionValidFrom,
} from '@/services/catalog/catalog-pricing-api.client';
import type { CreatePriceVersionRequest } from '@/subapps/catalog/types/price-list-requests';
import type { PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';

export interface PriceVersionActions {
  /** Πράξεις σε εξέλιξη, κατά id έκδοσης (ή `NEW_VERSION_KEY` για τη δημιουργία). */
  readonly busy: ReadonlySet<string>;
  /** Γραμμές που αντιγράφηκαν **σε αυτή τη συνεδρία** ανά έκδοση — νεότερο από την όψη όσο τρέχει η σπορά. */
  readonly seeded: ReadonlyMap<string, number>;
  readonly create: (request: CreatePriceVersionRequest) => Promise<PriceListVersionWire | null>;
  readonly seed: (version: PriceListVersionWire) => Promise<void>;
  readonly setValidFrom: (version: PriceListVersionWire, validFrom: string | null) => Promise<PriceListVersionWire | null>;
  readonly discard: (version: PriceListVersionWire) => Promise<void>;
}

export const NEW_VERSION_KEY = '__new';

function useBusyKeys() {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const mark = useCallback((key: string, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  return { busy, mark };
}

export function usePriceVersionActions(priceListId: string, revalidate: () => Promise<void>): PriceVersionActions {
  const notice = useCatalogFailureNotice();
  const mounted = useMountedRef();
  const { busy, mark } = useBusyKeys();
  const [seeded, setSeeded] = useState<ReadonlyMap<string, number>>(new Map());

  /** Μία πράξη: σημάδι «σε εξέλιξη» · αποτυχία ⇒ ειδοποίηση (ποτέ εξαίρεση προς την οθόνη) · πάντα ανανέωση της όψης. */
  const run = useCallback(async <R>(key: string, work: () => Promise<R>): Promise<R | null> => {
    mark(key, true);
    try {
      return await work();
    } catch (cause) {
      notice(catalogFailureOf(cause));
      return null;
    } finally {
      if (mounted.current) mark(key, false);
      await revalidate();
    }
  }, [mark, notice, mounted, revalidate]);

  const progress = useCallback((version: PriceListVersionWire) => {
    if (!mounted.current) return;
    setSeeded((prev) => new Map(prev).set(version.id, version.derived.seed?.copied ?? 0));
  }, [mounted]);

  const seed = useCallback(async (version: PriceListVersionWire) => {
    await run(version.id, () => seedUntilDone(version, progress, () => !mounted.current));
  }, [run, progress, mounted]);

  const create = useCallback(async (request: CreatePriceVersionRequest) => {
    const created = await run(NEW_VERSION_KEY, () => createPriceListVersion(priceListId, request));
    // Η σπορά συνεχίζει στο παρασκήνιο με πρόοδο στη χρονογραμμή — ο διάλογος κλείνει μόλις γεννηθεί η έκδοση.
    if (created?.derived.seed && !created.derived.seed.done) void seed(created);
    return created;
  }, [run, seed, priceListId]);

  const setValidFrom = useCallback(
    (version: PriceListVersionWire, validFrom: string | null) =>
      run(version.id, () => setVersionValidFrom(version.id, version.revision, validFrom)),
    [run],
  );

  const discard = useCallback(async (version: PriceListVersionWire) => {
    await run(version.id, () => discardVersion(version.id, version.revision));
  }, [run]);

  return useMemo(() => ({ busy, seeded, create, seed, setValidFrom, discard }), [busy, seeded, create, seed, setValidFrom, discard]);
}
