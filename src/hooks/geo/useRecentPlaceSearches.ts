'use client';

/**
 * **Η React όψη του ιστορικού αναζητήσεων τόπου** (ADR-882).
 *
 * Καμία κατάσταση React — η αποθήκη είναι η ΜΙΑ πηγή και το `useSyncExternalStore` τη
 * διαβάζει. Έτσι δύο κουτιά (ή δύο καρτέλες) δεν μπορούν να διαφωνήσουν, και η διαγραφή μιας
 * γραμμής φαίνεται **αμέσως** (οπτιμιστικά).
 *
 * 🔑 **Φάση 2 — ο δεσμός με τον λογαριασμό ζει ΕΔΩ, ΜΙΑ φορά**: το hook λέει στην αποθήκη
 * ποιος είναι συνδεδεμένος (`bindAccountPlaceSearches`, ιδεμποτικό — δέκα κουτιά ⇒ ένας
 * δεσμός). Όσο η ταυτότητα **φορτώνει**, ο δεσμός δεν αλλάζει: αλλιώς ο συνδεδεμένος θα
 * έβλεπε για μια στιγμή το ιστορικό της συσκευής.
 *
 * ⚠️ Στον server και στην πρώτη ενυδάτωση επιστρέφει **άδειο**: ιστορικό στο HTML του server
 * θα ήταν hydration mismatch.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { useAuthOptional } from '@/auth/contexts/AuthContext';
import {
  bindAccountPlaceSearches,
  getRecentPlaceSearchesSnapshot,
  subscribeRecentPlaceSearches,
  NO_RECENT_PLACE_SEARCHES,
  type RecentPlaceSearch,
} from '@/lib/geo/recent-place-searches';

function getServerSnapshot(): readonly RecentPlaceSearch[] {
  return NO_RECENT_PLACE_SEARCHES;
}

export function useRecentPlaceSearches(): readonly RecentPlaceSearch[] {
  const auth = useAuthOptional();
  const uid = auth?.user?.uid ?? null;
  const authLoading = auth?.loading ?? false;

  useEffect(() => {
    if (!authLoading) bindAccountPlaceSearches(uid);
  }, [uid, authLoading]);

  return useSyncExternalStore(
    subscribeRecentPlaceSearches,
    getRecentPlaceSearchesSnapshot,
    getServerSnapshot,
  );
}
