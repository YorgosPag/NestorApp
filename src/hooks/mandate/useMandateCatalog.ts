'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** — φόρτωση, πράξη, ξαναφόρτωση.
 * @related ADR-777 §8.34 · services/mandate/mandate-catalog.client.ts
 * @module hooks/mandate/useMandateCatalog
 *
 * 🔴 **ΜΕΤΑ ΑΠΟ ΚΑΘΕ ΠΡΑΞΗ, ΞΑΝΑΦΟΡΤΩΝΕΙ — ΔΕΝ «ΔΙΟΡΘΩΝΕΙ» ΤΗ ΓΡΑΜΜΗ ΤΟΠΙΚΑ.**
 * Ένα αισιόδοξο `standing: 'awaiting-view'` μετά το «ξαναστείλτε» θα ήταν **τρίτος
 * ταξινομητής** (μετά τον διακομιστή και τον κοινό κριτή) — και θα απέκλινε την πρώτη
 * φορά που κάποιος άλλαζε τον κανόνα σε ένα από τα δύο άλλα σημεία. Το κόστος είναι
 * μία ανάγνωση· το όφελος είναι ότι υπάρχει **μία** αλήθεια για το τι βλέπει ο μεσίτης.
 *
 * ⚠️ **Η γραμμή που δουλεύει ονομάζεται** ({@link MandateCatalogState.busyId}), ώστε η
 * οθόνη να κλειδώνει **μόνο** τα δικά της κουμπιά. Ένα καθολικό «φορτώνει» θα πάγωνε
 * ολόκληρο τον κατάλογο επειδή μία γραμμή στέλνει email.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  fetchMandateCatalog,
  runMandateAction,
  type ActionResult,
} from '@/services/mandate/mandate-catalog.client';
import type { MandateAction } from '@/lib/mandate/mandate-actions';
import type { MandateCatalog } from '@/services/mandate/mandate-catalog.service';

/** Το αποτέλεσμα της **τελευταίας** πράξης, όπως το δείχνει η οθόνη. */
export interface CatalogFeedback {
  readonly ownerPropertyId: string;
  readonly result: ActionResult;
}

export type MandateCatalogState =
  | { readonly state: 'loading' }
  | { readonly state: 'failed' }
  | {
      readonly state: 'ready';
      readonly catalog: MandateCatalog;
      readonly busyId: string | null;
      readonly feedback: CatalogFeedback | null;
    };

export interface MandateCatalogApi {
  readonly view: MandateCatalogState;
  readonly reload: () => void;
  readonly act: (ownerPropertyId: string, action: MandateAction) => void;
}

export function useMandateCatalog(): MandateCatalogApi {
  const [catalog, setCatalog] = useState<MandateCatalog | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CatalogFeedback | null>(null);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    let alive = true;
    setCatalog(null);
    setLoadFailed(false);

    void fetchMandateCatalog().then((load) => {
      if (!alive) return;
      if (load.kind === 'ready') setCatalog(load.catalog);
      else setLoadFailed(true);
    });

    return () => {
      alive = false;
    };
  }, [epoch]);

  const reload = useCallback(() => setEpoch((value) => value + 1), []);

  const act = useCallback(
    (ownerPropertyId: string, action: MandateAction) => {
      setBusyId(ownerPropertyId);
      setFeedback(null);

      void runMandateAction(ownerPropertyId, action).then((result) => {
        setBusyId(null);
        setFeedback({ ownerPropertyId, result });
        // ⚠️ Ξαναφόρτωση **μόνο** σε επιτυχία: μια απόρριψη δεν άλλαξε τίποτα στη βάση,
        // και μια περιττή ανάγνωση θα έσβηνε το μήνυμα προτού προλάβει να διαβαστεί.
        if (result.kind === 'done') reload();
      });
    },
    [reload],
  );

  if (loadFailed) return { view: { state: 'failed' }, reload, act };
  if (catalog === null) return { view: { state: 'loading' }, reload, act };
  return { view: { state: 'ready', catalog, busyId, feedback }, reload, act };
}
