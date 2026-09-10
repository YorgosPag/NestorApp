/**
 * @fileoverview Ο **κύκλος ζωής** των παράγωγων αποτυπωμάτων στην οθόνη: ζητά τη
 * φόρτωση μία φορά και δίνει αναγνώστη **σωστής ταυτότητας**. ADR-846 Φάση 2.5.
 * @related lib/geo/admin-footprints.ts (τα δεδομένα) · hooks/useLazySnapshot.ts
 * @module hooks/useAdminFootprints
 */

'use client';

import { useCallback } from 'react';

import { useLazySnapshot } from '@/hooks/useLazySnapshot';
import { ADMIN_FOOTPRINTS_SOURCE, EMPTY_FOOTPRINTS } from '@/lib/geo/admin-footprints';
import type { FootprintResolver, FootprintSnapshot } from '@/types/geo/admin-footprint';

interface UseAdminFootprintsReturn {
  /** `true` όσο **δεν ξέρουμε ακόμη** — ούτε «υπάρχουν» ούτε «δεν υπάρχουν». */
  readonly isLoading: boolean;
  /**
   * Ο αναγνώστης για τον κριτή.
   *
   * 🔑 **Η ταυτότητά του κρέμεται από το στιγμιότυπο, και ΜΟΝΟ από αυτό.** Ένας
   * καταναλωτής που τον βάζει σε `useMemo(…, [footprintOf])` είναι **σωστός εξ
   * ορισμού**: όταν φτάσει το αρχείο, η ταυτότητα αλλάζει και το φιλτράρισμα ξαναγίνεται
   * μόνο του. Ο ίδιος ο module-level {@link footprintOf} **δεν** θα το πετύχαινε αυτό —
   * είναι το ακριβές σφάλμα της §6.2 *(«ψεύτικες λίστες εξαρτήσεων»)*, που άφησε τον
   * επιλογέα περιοχής άδειο σε κάθε κρύο φόρτωμα.
   */
  readonly footprintOf: FootprintResolver;
  /**
   * **ΟΛΕΣ οι εγγραφές** — για τον καλούντα που ρωτά *«ΠΟΙΑ οντότητα είναι εδώ;»*.
   *
   * ⚠️ **ΔΕΝ είναι το ίδιο ερώτημα με τον {@link footprintOf}, και γι' αυτό είναι
   * ξεχωριστό πεδίο.** Ο αναγνώστης απαντά για οντότητα που **ήδη ονομάζεις**· ο χάρτης
   * απαιτεί **σάρωση 7.440 εγγραφών**. Ένας καταναλωτής που παίρνει τον χάρτη ενώ του
   * αρκεί ο αναγνώστης αποκτά εξάρτηση που **δεν χρειάζεται** — και το `grep` παύει να
   * λέει ποιος πραγματικά σαρώνει. Σήμερα σαρώνει **ένας**: το
   * `useCircleAnchorName` *(ADR-846 §9 #12)*.
   *
   * 🔑 **ΠΟΤΕ `null`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ**: όσο φορτώνει, είναι ο **κενός** χάρτης — άρα
   * ο καλών δεν χρειάζεται δεύτερο έλεγχο. Το *«δεν ρώτησα»* το λέει το
   * {@link isLoading}, και **οφείλει** να το ρωτήσει όποιος πρόκειται να **γράψει**
   * συμπέρασμα *(N.12 — δες `presenceAdminIdsOf`)*. Ο δικός μας καταναλωτής μόνο
   * **διαβάζει**: κενός χάρτης ⇒ κανένας περιέκτης ⇒ «δεν ξέρω» ⇒ η οθόνη σιωπά για το
   * όνομα, χωρίς να ψευδιστεί.
   *
   * 🔴 **Η ΤΑΥΤΟΤΗΤΑ ΑΛΛΑΖΕΙ ΑΚΡΙΒΩΣ ΟΤΑΝ ΦΤΑΝΟΥΝ ΤΑ ΔΕΔΟΜΕΝΑ** — `EMPTY_FOOTPRINTS`
   * είναι σταθερά module, το στιγμιότυπο νέος `Map`. Άρα ένα `useMemo(…, [entries])`
   * είναι **σωστό εξ ορισμού**, ίδια εγγύηση με το `footprintOf` παραπάνω. Το μάθημα
   * της §6.2 δεν χρειάζεται να το θυμηθεί ο επόμενος.
   */
  readonly entries: FootprintSnapshot;
}

/** Φορτώνει τα αποτυπώματα (μία φορά ανά σελίδα) και τα δίνει με **δύο** πόρτες. */
export function useAdminFootprints(): UseAdminFootprintsReturn {
  const snapshot = useLazySnapshot(ADMIN_FOOTPRINTS_SOURCE, EMPTY_FOOTPRINTS);

  const footprintOf = useCallback<FootprintResolver>(
    (adminId) => snapshot?.get(adminId) ?? null,
    [snapshot],
  );

  return { isLoading: snapshot === null, footprintOf, entries: snapshot ?? EMPTY_FOOTPRINTS };
}
