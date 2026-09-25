'use client';

/**
 * **Η React όψη του ιστορικού αναζητήσεων τόπου** (ADR-882).
 *
 * Καμία κατάσταση React — ο δίσκος είναι η ΜΙΑ πηγή και το `useSyncExternalStore` τη
 * διαβάζει. Έτσι δύο κουτιά (ή δύο καρτέλες) δεν μπορούν να διαφωνήσουν, και η διαγραφή μιας
 * γραμμής φαίνεται **αμέσως** (οπτιμιστικά, γιατί η εγγραφή στο `localStorage` είναι σύγχρονη).
 *
 * ⚠️ Στον server και στην πρώτη ενυδάτωση επιστρέφει **άδειο**: το `localStorage` δεν υπάρχει
 * εκεί, και ένα ιστορικό στο HTML του server θα ήταν hydration mismatch.
 */

import { useSyncExternalStore } from 'react';
import {
  getRecentPlaceSearchesSnapshot,
  subscribeRecentPlaceSearches,
  NO_RECENT_PLACE_SEARCHES,
  type RecentPlaceSearch,
} from '@/lib/geo/recent-place-searches';

function getServerSnapshot(): readonly RecentPlaceSearch[] {
  return NO_RECENT_PLACE_SEARCHES;
}

export function useRecentPlaceSearches(): readonly RecentPlaceSearch[] {
  return useSyncExternalStore(
    subscribeRecentPlaceSearches,
    getRecentPlaceSearchesSnapshot,
    getServerSnapshot,
  );
}
