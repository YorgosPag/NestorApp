'use client';

/**
 * @fileoverview **ΤΑ ΣΥΜΦΡΑΖΟΜΕΝΑ ΤΗΣ ΑΝΟΙΧΤΗΣ ΣΥΝΟΜΙΛΙΑΣ** — μία ανάγνωση, στο άνοιγμα (ADR-867 Β9γ).
 * @related services/network-messaging/thread-context.ts · `useNetworkThreadDirectory.ts` (ίδιο ιδίωμα)
 * @module hooks/network-messaging/useNetworkThreadContext
 *
 * 🔑 **Δεν είναι ζωντανή συνδρομή, και δεν πρέπει να γίνει**: πλευρά, ομάδα και αντικείμενο αλλάζουν
 * σε ρυθμό **ημερών**, όχι δευτερολέπτων. Τα **μηνύματα** είναι εκείνα που ζουν ζωντανά, και τα
 * διαβάζει το `NetworkThreadPanel` κατευθείαν από τον κανόνα (`use-live-snapshot`).
 *
 * ⚠️ **«Δεν βρέθηκε» ΔΕΝ είναι σφάλμα**: ξένο και ανύπαρκτο νήμα απαντούν **ίδια** (`not-audience`,
 * ADR-742) — η οθόνη λέει «αυτή η συνομιλία δεν βρέθηκε», ποτέ «δεν σου επιτρέπεται», που θα
 * επιβεβαίωνε σε άγνωστο ότι το νήμα υπάρχει.
 */

import { useCallback, useEffect, useState } from 'react';

import { networkThreadClient, type NetworkFailure } from '@/services/network-messaging/network-thread.client';
import type { NetworkThreadContext } from '@/types/network-wire';

export type NetworkThreadContextView =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly context: NetworkThreadContext }
  /** `not-audience` ⇒ **δεν βρέθηκε**· οτιδήποτε άλλο ⇒ βλάβη με «δοκιμάστε ξανά». */
  | { readonly state: 'failed'; readonly failure: NetworkFailure; readonly reload: () => void };

export function useNetworkThreadContext(threadId: string): NetworkThreadContextView {
  const [view, setView] = useState<NetworkThreadContextView>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    setView({ state: 'loading' });

    void networkThreadClient.context(threadId).then((result) => {
      if (!alive) return;
      setView(result.ok
        ? { state: 'ready', context: result.value }
        : { state: 'failed', failure: result.failure, reload });
    });

    // ⚠️ Ο καθαρισμός είναι **υποχρεωτικός**: ο άνθρωπος πηδά από συνομιλία σε συνομιλία στο πλαϊνό
    //    φύλλο, και μια αργοπορημένη απάντηση θα έγραφε τα συμφραζόμενα του **προηγούμενου** νήματος.
    return () => { alive = false; };
  }, [threadId, attempt, reload]);

  return view;
}
