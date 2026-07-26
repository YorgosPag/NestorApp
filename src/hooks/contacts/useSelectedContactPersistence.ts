'use client';

/**
 * @module useSelectedContactPersistence
 * @description Ο **ένας** ιδιοκτήτης του κύκλου ζωής της persisted επιλογής επαφής.
 *
 * ## Γιατί υπάρχει ως hook και όχι ως δύο effects στον καλούντα
 * Η γραφή και η καθυστερημένη επαναφορά είναι **η ίδια απόφαση σε δύο χρόνους**: και
 * οι δύο ρωτούν «σημαίνει το τρέχον `null` πραγματικά *καμία επιλογή*;». Όσο ζούσαν
 * χωριστά, η μία έσβηνε το κλειδί που η άλλη χρειαζόταν (ADR-332 D20.1 — μετρημένο
 * ζωντανά, βλ. το ίχνος στο `contact-session-storage`). Ένας ιδιοκτήτης ⇒ η σειρά
 * είναι γεγονός, όχι σύμβαση (N.7.2 #7).
 *
 * ## Συμβόλαιο
 * - **Ιδεμποτεντικό**: η καθυστερημένη επαναφορά τρέχει **μία** φορά ανά mount, τη
 *   στιγμή που η λίστα καθίζει. Χωρίς αυτό, μια διαγραμμένη επαφή θα «επανερχόταν»
 *   σε κάθε ανανέωση της λίστας — χειρότερο από το αρχικό ελάττωμα.
 * - **Καμία ανάκτηση από δίκτυο**: η επαναφορά ψάχνει τη λίστα που έχει ήδη ο καλών.
 * - ⚠️ **Γνωστό, αποδεκτό όριο**: αν ο χρήστης αποεπιλέξει μέσα στο παράθυρο **πριν**
 *   καθίσει η λίστα (~300ms σε φρέσκο φόρτωμα), η επαναφορά θα επαναφέρει την
 *   προηγούμενη επαφή. Καταγράφεται ρητά αντί να «λυθεί» με σύζευξη του hook στο
 *   `creationMode` του καλούντα — το tradeoff είναι ένα render window έναντι
 *   διαρροής άσχετης κατάστασης σε SSoT module.
 *
 * @see ADR-332 — D20.1 (γιατί το `null` έχει δύο σημασίες)
 * @see ADR-300 — Stale Cache Factory (γιατί η λίστα επιβιώνει και η επιλογή όχι)
 */

import { useEffect, useRef } from 'react';
import {
  isSelectionWriteAllowed,
  resolveLateSelectionRestore,
  writeSelectedContactId,
} from '@/utils/contacts/contact-session-storage';

/** Ελάχιστο σχήμα που χρειάζεται η επαναφορά — δεν δεσμεύει τον τύπο `Contact`. */
interface IdentifiableContact {
  id?: string;
}

interface SelectedContactPersistenceParams<T extends IdentifiableContact> {
  /** Η τρέχουσα επιλογή του καλούντα. */
  selected: T | null;
  /** Η λίστα υποψηφίων, όπως τη βλέπει ο καλών αυτή τη στιγμή. */
  contacts: readonly T[];
  /**
   * Έχει καθίσει η λίστα; Πριν από αυτό, `selected === null` σημαίνει «δεν ξέρω
   * ακόμη» και **δεν** επιτρέπεται σβήσιμο του κλειδιού.
   */
  listSettled: boolean;
  /** Καλείται μία φορά, αν η επαφή του αποθηκευμένου id βρεθεί καθυστερημένα. */
  onRestore: (contact: T) => void;
}

/**
 * Διατηρεί την επιλεγμένη επαφή σε `sessionStorage` και την επαναφέρει μετά από
 * remount — ακόμη κι όταν ο αρχικοποιητής του καλούντα έτρεξε με κενή λίστα.
 */
export function useSelectedContactPersistence<T extends IdentifiableContact>({
  selected,
  contacts,
  listSettled,
  onRestore,
}: SelectedContactPersistenceParams<T>): void {
  /** Έγινε η μία-και-μόνη προσπάθεια καθυστερημένης επαναφοράς; */
  const lateRestoreSettledRef = useRef(false);
  /** Σταθερή αναφορά στον callback ⇒ το effect δεν εξαρτάται από την ταυτότητά του. */
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Βήμα 1 — καθυστερημένη επαναφορά. Τρέχει πρώτο ώστε η γραφή του βήματος 2 να
  // βλέπει ήδη το αποτέλεσμα και να μη σβήσει κλειδί που μόλις χρησιμοποιήθηκε.
  useEffect(() => {
    if (lateRestoreSettledRef.current || !listSettled) return;
    lateRestoreSettledRef.current = true;

    // Ο αρχικοποιητής πρόλαβε (το module cache ήταν ζεστό) ⇒ τίποτα να κάνουμε.
    if (selected) return;

    const outcome = resolveLateSelectionRestore(contacts);
    if (outcome.kind === 'restored') onRestoreRef.current(outcome.contact);
    else if (outcome.kind === 'garbage') writeSelectedContactId(null);
  }, [listSettled, contacts, selected]);

  // Βήμα 2 — γραφή. Το φίλτρο είναι ο λόγος ύπαρξης του module: `null` πριν καθίσει
  // η λίστα δεν είναι αποεπιλογή.
  useEffect(() => {
    const selectedId = selected?.id ?? null;
    if (!isSelectionWriteAllowed(selectedId, lateRestoreSettledRef.current)) return;

    writeSelectedContactId(selectedId);
  }, [selected?.id]);
}
