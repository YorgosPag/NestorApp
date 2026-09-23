'use client';

/**
 * @fileoverview **Ο ιδιοκτήτης της ουράς στιγμιοτύπων** για μία σελίδα.
 * @related ADR-777 §8.70 (Φάση 2) · lib/maps/map-snapshot-store
 * @module components/listing-map-snapshot/ListingMapSnapshotProvider
 *
 * 🔑 **Ποιος κατέχει τον κύκλο ζωής**: αυτός εδώ, ρητά. Στήνει το κατάστημα όταν ανεβαίνει η
 * σελίδα και το ξηλώνει (αποδέσμευση κάθε `blob:` URL) όταν φεύγει. Ο κρυφός χάρτης ανεβαίνει
 * **μόνο** όταν υπάρξει πρώτο αίτημα.
 *
 * ⚠️ **Το κατάστημα στήνεται σε effect, όχι σε `useState`**: στο StrictMode η React ξεστήνει και
 * ξαναστήνει τα effects κρατώντας την ίδια κατάσταση — ένα κατάστημα από `useState` θα έβγαινε
 * **νεκρό** από το πρώτο `dispose`. Όσο στήνεται, οι κάρτες βλέπουν `null` ⇒ αναμονή, όχι απουσία.
 */

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import { createMapSnapshotStore } from '@/lib/maps/map-snapshot-store';

import {
  ListingMapSnapshotContext,
  type ListingSnapshotPayload,
  type ListingSnapshotStore,
} from './use-listing-map-snapshot';

const ListingMapSnapshotStage = dynamic(() => import('./ListingMapSnapshotStage'), { ssr: false });

/**
 * «Ζήτησε ήδη κάποια κάρτα;» — ⚠️ τα effects των **παιδιών** τρέχουν πριν από του γονέα, άρα τα
 * πρώτα αιτήματα γίνονται **πριν** εγγραφεί ο provider. Γι' αυτό η εγγραφή ρωτά και το `size`.
 */
function useHasRequests(store: ListingSnapshotStore | null): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (store === null || active) return undefined;
    const check = (): void => {
      if (store.size() > 0) setActive(true);
    };
    const unsubscribe = store.subscribe(check);
    check();
    return unsubscribe;
  }, [store, active]);
  return active;
}

export function ListingMapSnapshotProvider({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  const [store, setStore] = useState<ListingSnapshotStore | null>(null);
  const active = useHasRequests(store);

  useEffect(() => {
    const created = createMapSnapshotStore<ListingSnapshotPayload>();
    setStore(created);
    return () => created.dispose();
  }, []);

  return (
    <ListingMapSnapshotContext.Provider value={store}>
      {children}
      {store !== null && active ? <ListingMapSnapshotStage store={store} /> : null}
    </ListingMapSnapshotContext.Provider>
  );
}
