'use client';

/**
 * @fileoverview **Ο ΚΑΤΑΛΟΓΟΣ ΤΩΝ ΝΗΜΑΤΩΝ ΜΟΥ** — μία σελίδα τη φορά, με δρομέα.
 * @related ADR-867 Β9β · `services/network-messaging/thread-directory.ts` (ο διακομιστής) ·
 *          `hooks/audit/useAuditFeed.ts` (το ιδίωμα σελιδοποίησης του έργου)
 * @module hooks/network-messaging/useNetworkThreadDirectory
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΡΟΜΕΑΣ, ΟΧΙ ΑΡΙΘΜΟΣ ΣΕΛΙΔΑΣ — ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟΤΗΤΑ, ΟΧΙ ΤΑΧΥΤΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κατάλογος ταξινομείται κατά **δραστηριότητα**, και η δραστηριότητα αλλάζει ενώ ο άνθρωπος
 * διαβάζει: ένα νέο μήνυμα ανεβάζει νήμα στην κορυφή. Με `page=2` η δεύτερη σελίδα θα **ξαναέδινε**
 * γραμμή που μετακινήθηκε και θα **έχανε** εκείνη που την αντικατέστησε. Ο δρομέας κρατά **θέση**,
 * όχι απόσταση, οπότε ούτε διπλασιάζει ούτε χάνει.
 *
 * ⚠️ **Ο δρομέας είναι ΑΔΙΑΦΑΝΗΣ.** Έρχεται αυτούσιος από το `next` και επιστρέφεται αυτούσιος.
 * Τίποτα εδώ δεν τον αποκωδικοποιεί — το εσωτερικό του είναι δικό του διακομιστή, και χαλασμένος
 * δρομέας απαντά **400**, ποτέ σιωπηλά «από την αρχή».
 *
 * 🔑 **Καμία εμβέλεια χώρου.** Το νήμα είναι `cross-space-thread`: η εμβέλεια είναι ο **άνθρωπος**,
 * και τη βάζει ο διακομιστής από την ταυτότητα — ποτέ ο πελάτης από το σώμα.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { networkThreadClient, type NetworkFailure } from '@/services/network-messaging/network-thread.client';
import type { NetworkThreadListItem } from '@/types/network-wire';

export interface NetworkThreadDirectoryView {
  readonly items: readonly NetworkThreadListItem[];
  /** Φορτώνει **τώρα** — η πρώτη σελίδα ή μια επόμενη. */
  readonly isLoading: boolean;
  /** Κωδικός από κλειστό σύνολο· η οθόνη τον μεταφράζει (N.11). */
  readonly failure: NetworkFailure | null;
  readonly hasMore: boolean;
  readonly loadMore: () => void;
  readonly reload: () => void;
}

/** Τι κρατά ο hook ανάμεσα στις σελίδες — μία θέση για να μην αποκλίνουν τρία `useState`. */
interface DirectoryState {
  readonly items: readonly NetworkThreadListItem[];
  readonly cursor: string | null;
  readonly loaded: boolean;
}

const EMPTY: DirectoryState = { items: [], cursor: null, loaded: false };

export function useNetworkThreadDirectory(): NetworkThreadDirectoryView {
  const [state, setState] = useState<DirectoryState>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<NetworkFailure | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // ⚠️ **Φρουρός ταυτόχρονης αίτησης, ΟΧΙ το `isLoading`**: το `isLoading` είναι κατάσταση
  //    απόδοσης και φτάνει στον χειριστή ένα καρέ αργότερα· δύο γρήγορα κλικ στο «κι άλλα» θα
  //    περνούσαν και τα δύο, με τον **ίδιο** δρομέα ⇒ διπλές γραμμές.
  const inFlight = useRef(false);

  const fetchPage = useCallback(async (cursor: string | null, replace: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setFailure(null);

    const result = await networkThreadClient.list(cursor === null ? undefined : { cursor });

    inFlight.current = false;
    if (!mounted.current) return;
    setIsLoading(false);

    if (!result.ok) {
      setFailure(result.failure);
      return;
    }
    setState((previous) => ({
      items: replace ? result.value.items : [...previous.items, ...result.value.items],
      cursor: result.value.next,
      loaded: true,
    }));
  }, []);

  useEffect(() => { void fetchPage(null, true); }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (state.cursor === null) return;
    void fetchPage(state.cursor, false);
  }, [fetchPage, state.cursor]);

  const reload = useCallback(() => {
    setState(EMPTY);
    void fetchPage(null, true);
  }, [fetchPage]);

  return {
    items: state.items,
    isLoading,
    failure,
    hasMore: state.cursor !== null,
    loadMore,
    reload,
  };
}
