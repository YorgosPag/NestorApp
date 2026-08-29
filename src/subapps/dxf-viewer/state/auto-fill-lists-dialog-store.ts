'use client';

/**
 * 🔴 ADR-828 Φ4β — **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΔΙΑΧΕΙΡΙΣΤΗ ΛΙΣΤΩΝ**, με το ίδιο μοτίβο που έλυσε το
 * ADR-739 §61 για τη «Μορφοποίηση κελιών»: ελαφρύ store + **ένας** ξενιστής.
 *
 * ## Γιατί store και όχι `useState` σε κάποιον εκκινητή
 * Ο ένας από τους δύο εκκινητές είναι το item «Σειρά…» του μενού συμπλήρωσης — και ένα item
 * μενού **ξεμοντάρει τη στιγμή που το πατάς**. Δεν μπορεί να ζωγραφίσει τίποτα που επιβιώνει
 * του πατήματός του. Ο άλλος (η καρτέλα των ρυθμίσεων) δεν χρειάζεται καν διάλογο: αποδίδει
 * τον **ίδιο** διαχειριστή μέσα στο πάνελ. Μία υλοποίηση, δύο πόρτες.
 *
 * ## 🔑 ΓΙΑΤΙ ΟΙ ΣΠΟΡΟΙ ΤΑΞΙΔΕΥΟΥΝ ΜΕ ΤΟ ΑΙΤΗΜΑ
 * Όταν ο άνθρωπος ανοίγει τον διαχειριστή από **γέμισμα**, τα κελιά που μόλις μάρκαρε είναι
 * ήδη η λίστα που θέλει να δηλώσει — αυτό ακριβώς κάνουν το *Import from cells* του Excel και
 * το *Copy List from* του LibreOffice, απλώς εκείνα το ζητούν με δεύτερη κίνηση. Ο ίδιος
 * κανόνας με τον στόχο του §61: διαβάζονται **τη στιγμή του πατήματος** (ADR-040 #2) και
 * ταξιδεύουν με το αίτημα. Ένας ξενιστής που τα ρωτούσε μόνος του θα διάβαζε την επιλογή
 * όπως είναι **όταν ανοίγει**, δηλαδή μετά το κλείσιμο του μενού.
 *
 * ⚠️ **Δεν είναι λίστα** — είναι **πρόταση**: μπαίνουν στη φόρμα και ο άνθρωπος τα βλέπει,
 * τα σβήνει ή τα ονομάζει. Τίποτα δεν αποθηκεύεται χωρίς να το πατήσει εκείνος.
 *
 * @module subapps/dxf-viewer/state/auto-fill-lists-dialog-store
 * @see ui/components/auto-fill-lists/AutoFillListsDialogHost.tsx — ο ΕΝΑΣ ξενιστής
 * @see state/table-format-cells-dialog-store.ts — το μοτίβο (ADR-739 §61)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../stores/createExternalStore';

export interface AutoFillListsRequest {
  /**
   * 🔴 Ο **σειριακός αριθμός του ανοίγματος** — η ταυτότητα της *ερώτησης*.
   *
   * Ίδιος λόγος με το §61: ο ξενιστής επιβιώνει, ενώ η φόρμα σπέρνεται στο mount. Χωρίς αυτόν,
   * ένα δεύτερο άνοιγμα πάνω σε **άλλα** κελιά θα κρατούσε την προηγούμενη πρόταση — δηλαδή ο
   * άνθρωπος θα έβλεπε ονόματα που δεν μάρκαρε.
   */
  readonly id: number;
  /** Οι τιμές των μαρκαρισμένων κελιών ως **πρόταση** για νέα λίστα· κενό = καμία πρόταση. */
  readonly seeds: readonly string[];
}

const requestStore = createExternalStore<AutoFillListsRequest | null>(null);

/** Μονότονα αύξων· δες {@link AutoFillListsRequest.id}. Ποτέ ρολόι, ποτέ τυχαίος. */
let nextRequestId = 1;

/**
 * Άνοιξε τον διαχειριστή — προαιρετικά με πρόταση από τα κελιά που μόλις μαρκαρίστηκαν.
 *
 * ⚠️ Τα κενά και τα διπλότυπα φεύγουν **εδώ** και όχι στη φόρμα: μια πρόταση με τρία κενά
 * και δύο ίδιες λέξεις δεν είναι πρόταση που ο άνθρωπος θα ήθελε να δει, και η φόρμα δεν
 * πρέπει να μάθει δεύτερο κανόνα καθαρισμού δίπλα σε αυτόν της αποθήκευσης.
 */
export function openAutoFillListsDialog(seeds: readonly string[] = []): void {
  const cleaned: string[] = [];
  for (const seed of seeds) {
    const trimmed = seed.trim();
    if (trimmed !== '' && !cleaned.includes(trimmed)) cleaned.push(trimmed);
  }
  requestStore.set({ id: nextRequestId++, seeds: cleaned });
}

/** Άκυρο / `Escape` / `✕` — κλείνουν τον **έναν** διάλογο. */
export function closeAutoFillListsDialog(): void {
  requestStore.set(null);
}

/** Τι είναι ανοιχτό **τη στιγμή της κλήσης**· `null` = κλειστός. */
export function getAutoFillListsRequest(): AutoFillListsRequest | null {
  return requestStore.get();
}

/** Συνδρομή για `useSyncExternalStore`· επιστρέφει την αποδέσμευση. */
export function subscribeAutoFillListsDialog(listener: () => void): () => void {
  return requestStore.subscribe(listener);
}

/**
 * Το αίτημα ως αντιδραστική τιμή — για τον ξενιστή.
 *
 * Ο server snapshot είναι `null` (κλειστός): ο διάλογος είναι καθαρά πράξη χρήστη, οπότε καμία
 * απόδοση στον διακομιστή δεν μπορεί να έχει άλλη απάντηση.
 */
export function useAutoFillListsRequest(): AutoFillListsRequest | null {
  return useSyncExternalStore(subscribeAutoFillListsDialog, getAutoFillListsRequest, () => null);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα υπόλοιπα stores του subapp. */
export function __resetAutoFillListsDialogForTests(): void {
  requestStore.reset(null);
  nextRequestId = 1;
}
