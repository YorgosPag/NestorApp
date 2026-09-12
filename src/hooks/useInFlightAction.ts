/**
 * @fileoverview **Μία ενέργεια τη φορά, και το λέει** — ADR-332 D27 Ζ5.
 * @module hooks/useInFlightAction
 *
 * 🔴 **Η αφορμή, μετρημένη ζωντανά**: η «Αποθήκευση» μιας επαφής κρατούσε **61,4 δευτερόλεπτα** με το
 * κουμπί **ενεργό** και **καμία** ένδειξη. Δύο πατήματα = **δύο εγγραφές** στο ίδιο έγγραφο.
 *
 * ── ΓΙΑΤΙ ΚΟΙΝΟ, ΚΑΙ ΟΧΙ ΑΚΟΜΗ ΕΝΑ `useState(false)` (N.0.2) ──
 * Η σωστή συμπεριφορά **υπήρχε ήδη** στη φόρμα **δημιουργίας** (`useContactSubmission`: σημαία + φραγμός
 * επανεισόδου + `finally`) και **έλειπε** από τη διαδρομή επεξεργασίας. Πουθενά όμως δεν υπήρχε κοινός
 * μηχανισμός — κάθε hook έγραφε δικό του ζευγάρι `loading`/`setLoading`, και ο φραγμός ήταν κάτι που
 * «θυμόταν» ο καθένας. Εδώ ο φραγμός είναι **μέρος της αρχής**, όχι σύσταση.
 *
 * ── ΣΥΜΒΟΛΑΙΟ ──
 * - Όσο τρέχει, κάθε νέα κλήση **αγνοείται** (δεν μπαίνει σε ουρά: ένα δεύτερο πάτημα «Αποθήκευση» δεν
 *   σημαίνει «αποθήκευσε δύο φορές», σημαίνει «δεν κατάλαβα ότι δούλευε»).
 * - Η κατάσταση καθαρίζει **πάντα** (`finally`) — αλλιώς μια αποτυχία θα άφηνε το κουμπί μόνιμα νεκρό.
 * - Το σφάλμα **περνά** στον καλούντα: αυτός ξέρει τι μήνυμα αρμόζει. Ένα hook που καταπίνει σφάλματα
 *   κάνει μια αποτυχημένη αποθήκευση να μοιάζει επιτυχημένη.
 * - Δεν ενημερώνει κατάσταση σε αποπροσαρτημένο component (ο διάλογος μπορεί να κλείσει ενώ τρέχει).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface InFlightAction {
  /** `true` όσο η πράξη τρέχει — δέσε το σε `disabled` **και** σε `aria-busy`. */
  readonly isRunning: boolean;
  /** Τρέχει την πράξη, εκτός αν ήδη τρέχει κάποια. Ξαναπετά ό,τι πετάξει εκείνη. */
  run(action: () => Promise<void>): Promise<void>;
}

export function useInFlightAction(): InFlightAction {
  const [isRunning, setIsRunning] = useState(false);
  /** Ο φραγμός διαβάζεται **τη στιγμή του κλικ**: το `isRunning` του render είναι ήδη παλιό. */
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<void>): Promise<void> => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    try {
      await action();
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setIsRunning(false);
    }
  }, []);

  return { isRunning, run };
}
