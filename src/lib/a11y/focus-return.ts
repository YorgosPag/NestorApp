/**
 * ADR-711 §3.3 · ADR-241 — **Ποιος κρατούσε το focus, και μπορεί να το ξαναπάρει;**
 *
 * Το ίδιο ερώτημα το κάνουν **δύο** επιφάνειες: οι διάλογοι (`useDialogFocusRestore`) και η πλήρης οθόνη
 * (`FullscreenOverlay`). Ζει εδώ μία φορά — δύο αντίγραφα της ίδιας κρίσης θα απέκλιναν την ημέρα που θα άλλαζε η μία
 * (π.χ. αν το `body` σημαίνει «κανείς»).
 *
 * Framework-free: μόνο DOM, SSR-safe.
 */

/**
 * Το στοιχείο που κρατά τώρα το focus, ως υποψήφιος «opener» μιας επιφάνειας που ανοίγει.
 *
 * `null` όταν δεν υπάρχει DOM ή όταν το focus είναι στο `body`: το `body` σημαίνει «κανείς δεν κρατούσε το focus»
 * (π.χ. προγραμματικό άνοιγμα χωρίς κλικ) — επαναφορά εκεί δεν προσφέρει τίποτα.
 */
export function captureFocusOpener(): HTMLElement | null {
  if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  return active === document.body ? null : active;
}

/**
 * `true` όταν ο opener υπάρχει ακόμη στο DOM — **μόνο** τότε αξίζει να διεκδικήσει κανείς την επαναφορά. Αν χάθηκε
 * (π.χ. ο διάλογος διέγραψε τη γραμμή που τον άνοιξε), ο καλών αφήνει την προεπιλεγμένη διαδρομή να αποφασίσει.
 */
export function canRestoreFocusTo(opener: HTMLElement | null): opener is HTMLElement {
  return opener !== null && opener.isConnected;
}
