'use client';

/**
 * @fileoverview **Το toast «Αναίρεση» της απόρριψης πρότασης κοινοχρήστου** (ADR-931 §6.2 · Β2.1) — ΕΝΑ toast ανά
 * πρόταση, που φεύγει μόλις η «Αναίρεση» πάψει να έχει νόημα.
 * @related `hooks/notifications/useUndoToasts.ts` — ο ΕΝΑΣ μηχανισμός (ADR-923 §5.5.2 Β9γ: γενικεύτηκε από εδώ, ίδια συμπεριφορά)
 * @module components/building-management/CommonSpacesTab/useSuggestionUndoToasts
 *
 * 🔴 **Ζωντανή επαλήθευση 2026-11-07**: τα toast «Η πρόταση … απορρίφθηκε · Αναίρεση» σωρεύονταν (τέσσερα στη στοίβα)
 *   και έμεναν **και μετά** την επαναφορά — ένα «Αναίρεση» για κάτι που είχε ήδη αναιρεθεί.
 * 🔑 **Η αλήθεια είναι οι απορρίψεις, όχι τα κλικ**: «Αναίρεση» · επαναφορά από τη λίστα · «Επαναφορά όλων» · επαναφορά
 *   από **άλλον** άνθρωπο (snapshot) — όλα καταλήγουν στο ίδιο: το κλειδί λείπει από το `dismissedKeys` ⇒ το toast φεύγει.
 * 🔑 **Σταθερό `id` = κτίριο + κλειδί** ⇒ ξανά απόρριψη της ίδιας πρότασης **αντικαθιστά** το toast, δεν προσθέτει δεύτερο.
 */

import { undoToastId, useUndoToasts, type UndoToast } from '@/hooks/notifications/useUndoToasts';

const UNDO_TOAST_PREFIX = 'common-space-suggestion-dismissed:';

const scopeOf = (buildingId: string): string => `${UNDO_TOAST_PREFIX}${buildingId}`;

/** Το σταθερό `id` του toast — ένα ανά (κτίριο, πρόταση). */
export function suggestionUndoToastId(buildingId: string, key: string): string {
  return undoToastId(scopeOf(buildingId), key);
}

export type SuggestionUndoToast = UndoToast;

/**
 * Δείχνει το toast «Αναίρεση» και το αποσύρει όταν το κλειδί πάψει να είναι απορριφθέν.
 * @param dismissedKeys τα κλειδιά που είναι **τώρα** απορριφθέντα (αισιόδοξη εικόνα + snapshot).
 */
export function useSuggestionUndoToasts(buildingId: string, dismissedKeys: ReadonlySet<string>): (toast: SuggestionUndoToast) => void {
  return useUndoToasts(scopeOf(buildingId), dismissedKeys);
}
