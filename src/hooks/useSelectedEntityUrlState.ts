'use client';

/**
 * @module useSelectedEntityUrlState
 * @description Το **ένα** δοχείο για την ερώτηση «ποια οντότητα είναι ανοιχτή»: το URL.
 *
 * ## Γιατί το URL και όχι React state + δικλείδα
 * Πριν από το ADR-332 D21 η σελίδα Επαφών απαντούσε την ίδια ερώτηση από **δύο**
 * μηχανισμούς: το `?contactId=` (μόνο για ανάγνωση, από εξωτερικά deep links) και
 * ένα κλειδί `contact-selected` στο `sessionStorage`. Το δεύτερο μπήκε ως δικλείδα
 * επειδή το React state δεν επιβιώνει σε remount — και γέννησε τη δική του σειρά
 * ελαττωμάτων (D20.1: το `null` είχε δύο σημασίες και η δικλείδα έσβηνε το ίδιο της
 * το κλειδί 325ms πριν φτάσουν τα δεδομένα).
 *
 * Το URL **δεν χρειάζεται δικλείδα**: επιβιώνει reload, remount, Fast Refresh,
 * back/forward, bookmark, share, restore-tab — δωρεάν. Ένα δοχείο, καμία
 * συγχρονιστική λογική, κανένας αγώνας δρόμου. Επιπλέον η κατάσταση γίνεται
 * **μοιράσιμη**: το «άνοιξε αυτή την επαφή» είναι πλέον ένας σύνδεσμος.
 *
 * ## Ιδεμποτεντικό εξ ορισμού
 * Το ίδιο id δύο φορές = ίδιο URL = ίδιο αποτέλεσμα. Ο φρουρός ταυτότητας παρακάτω
 * αποτρέπει ακόμη και την περιττή εγγραφή στο ιστορικό.
 *
 * ## Τι **δεν** κάνει
 * Δεν αποφασίζει αν το id είναι έγκυρο, δεν φέρνει δεδομένα και δεν καθαρίζει
 * «σκουπίδια». Αυτά είναι πολιτική της σελίδας, γιατί μόνο η σελίδα ξέρει πότε
 * έχει φορτώσει η λίστα της — και το μάθημα του D20.1 ισχύει αυτούσιο: «δεν το
 * βρίσκω» δεν σημαίνει «δεν υπάρχει», όσο τα δεδομένα δεν έχουν καθίσει.
 *
 * @see ADR-332 — D21 (η επιλεγμένη επαφή ζει στο URL)
 * @see ADR-400 — το ίδιο μοτίβο για το viewport του DXF Viewer
 */

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { currentSearchParams, replaceUrlSearchParams } from '@/lib/url-query-state';

export interface SelectedEntityUrlState {
  /** Το id της ανοιχτής οντότητας, ή `null` όταν καμία δεν είναι επιλεγμένη. */
  readonly selectedId: string | null;
  /** Θέτει — ή καθαρίζει — την επιλογή. Χωρίς πλοήγηση, χωρίς remount. */
  readonly setSelectedId: (id: string | null) => void;
}

/**
 * Επιλογή οντότητας με σχήμα `useState`, αλλά με δοχείο το query string.
 *
 * @param paramName - Το κλειδί του query param (π.χ. `'contactId'`).
 */
export function useSelectedEntityUrlState(paramName: string): SelectedEntityUrlState {
  // Ανάγνωση: αντιδραστική. Το `history.replaceState` παρακάτω συγχρονίζεται με το
  // `useSearchParams` — τεκμηριωμένη συμπεριφορά του App Router, μετρημένη ζωντανά
  // στην έκδοση που τρέχει η παραγωγή (βλ. `@/lib/url-query-state`).
  const searchParams = useSearchParams();
  const selectedId = searchParams.get(paramName);

  const setSelectedId = useCallback(
    (id: string | null) => {
      // Φρουρός ταυτότητας: ίδια τιμή ⇒ καμία εγγραφή. Κρατά το ιστορικό καθαρό και
      // αποτρέπει βρόχο αν ποτέ κάποιος καλέσει τον setter μέσα από effect.
      if (currentSearchParams().get(paramName) === (id || null)) return;

      replaceUrlSearchParams(params => {
        if (id) params.set(paramName, id);
        else params.delete(paramName);
      });
    },
    [paramName],
  );

  return { selectedId, setSelectedId };
}
