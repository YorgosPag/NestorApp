'use client';

/**
 * @fileoverview **Ζήτα το στιγμιότυπο ενός σημαδιού** — και άκου πότε είναι έτοιμο.
 * @related ADR-777 §8.70 (Φάση 2) · lib/maps/map-snapshot-store
 * @module components/listing-map-snapshot/use-listing-map-snapshot
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

import { readListingMapPaint, type ListingMapPaint } from '@/components/search-results/listing-map-paint';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import type { MapSnapshotState, MapSnapshotStore } from '@/lib/maps/map-snapshot-store';

/** Ό,τι χρειάζεται ο κρυφός χάρτης για μία λήψη. */
export interface ListingSnapshotPayload {
  readonly mark: ListingMapMark;
  readonly paint: ListingMapPaint;
}

export type ListingSnapshotStore = MapSnapshotStore<ListingSnapshotPayload>;

/**
 * Τρεις τιμές, τρεις σημασίες:
 * - `undefined` ⇒ **κανένας provider** πάνω από την κάρτα ⇒ η κάρτα δείχνει την απουσία·
 * - `null` ⇒ ο provider υπάρχει αλλά δεν έστησε ακόμη το κατάστημα (πρώτο καρέ) ⇒ αναμονή·
 * - κατάστημα ⇒ λειτουργία.
 */
export const ListingMapSnapshotContext = createContext<ListingSnapshotStore | null | undefined>(undefined);

export type ListingMapSnapshotView =
  | MapSnapshotState
  | { readonly status: 'pending' }
  | { readonly status: 'unavailable' };

const PENDING: ListingMapSnapshotView = { status: 'pending' };
const UNAVAILABLE: ListingMapSnapshotView = { status: 'unavailable' };
const NOOP_UNSUBSCRIBE = (): void => undefined;

/**
 * @param near `true` μόλις η κάρτα πλησιάσει την οθόνη — πριν από αυτό **δεν** ζητείται τίποτα.
 */
export function useListingMapSnapshot(mark: ListingMapMark, near: boolean): ListingMapSnapshotView {
  const store = useContext(ListingMapSnapshotContext);
  const markKey = JSON.stringify(mark);

  // Τα χρώματα διαβάζονται από το θέμα ΤΩΡΑ ⇒ ανήκουν στο κλειδί: άλλο θέμα, άλλη εικόνα.
  const payload = useMemo<ListingSnapshotPayload>(
    () => ({ mark: JSON.parse(markKey) as ListingMapMark, paint: readListingMapPaint() }),
    [markKey],
  );
  const key = useMemo(() => JSON.stringify(payload), [payload]);

  const subscribe = useCallback(
    (listener: () => void) => (store ? store.subscribe(listener) : NOOP_UNSUBSCRIBE),
    [store],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => store?.get(key),
    () => undefined,
  );

  useEffect(() => {
    if (store && near) store.request(key, payload);
  }, [store, near, key, payload]);

  if (store === undefined) return UNAVAILABLE;
  return state ?? PENDING;
}
