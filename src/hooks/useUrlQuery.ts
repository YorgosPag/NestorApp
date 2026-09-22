'use client';

/**
 * @module useUrlQuery
 * @description Το ζωντανό query string, **αντιδραστικά** — ο ένας αναγνώστης πάνω στο `@/lib/url-query-state`.
 *
 * ## Γιατί όχι `useSearchParams()`
 * Η τεκμηρίωση του Next λέει ότι το `history.replaceState` συγχρονίζεται με το `useSearchParams`.
 * **Μετρήθηκε ότι ισχύει μόνο στο production build** (Next 15.5.22): στον dev server η ίδια γραφή
 * δεν προκαλεί **καμία** επανασχεδίαση. Ένας αναγνώστης που δουλεύει μόνο στην παραγωγή είναι
 * παγίδα — γι' αυτό η αντιδραστικότητα **παράγεται** από το `url-query-state`, όχι από τον router.
 *
 * ## Γιατί ζει σε δικό του hook
 * Η τριάδα `useSyncExternalStore(subscribe, snapshot, serverSnapshot)` είναι **η** ερώτηση
 * «τι λέει τώρα η διεύθυνση;». Όταν απέκτησε δεύτερο καταναλωτή (ADR-777 §8.60.21.7 — τα
 * κατοικίδια της σελίδας αγγελίας), εξήχθη εδώ αντί να αντιγραφεί.
 *
 * Επιστρέφει **string**, σκόπιμα: το `useSyncExternalStore` συγκρίνει με `Object.is`, οπότε ένα
 * φρέσκο `URLSearchParams` ανά render θα ήταν ατέρμονος βρόχος. Ο καταναλωτής το αναλύει μέσα σε `useMemo`.
 *
 * @see ADR-332 — D21 · ADR-400 · ADR-777 §8.60.21.7
 */

import { useSyncExternalStore } from 'react';
import {
  getServerUrlQuerySnapshot,
  getUrlQuerySnapshot,
  subscribeToUrlQuery,
} from '@/lib/url-query-state';

/** Το τρέχον query string (με `?`, ή κενό). Κενό στον server — η τιμή έρχεται μετά την ενυδάτωση. */
export function useUrlQuery(): string {
  return useSyncExternalStore(subscribeToUrlQuery, getUrlQuerySnapshot, getServerUrlQuerySnapshot);
}
