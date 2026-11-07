'use client';

/**
 * @fileoverview **Το toast «Αναίρεση» της απόρριψης πρότασης κοινοχρήστου** (ADR-931 §6.2 · Β2.1) — ΕΝΑ toast ανά
 * πρόταση, που φεύγει μόλις η «Αναίρεση» πάψει να έχει νόημα.
 * @related `providers/notification-policy.ts` (ADR-866 §2.10 Β2: toast με ενέργεια ΜΕΝΕΙ) ·
 *   `property-dossier/usePropertyDossierLifecycle.ts` (ADR-866 §2.10 Π3: ένα toast ανά οντότητα, σταθερό `id`)
 * @module components/building-management/CommonSpacesTab/useSuggestionUndoToasts
 *
 * 🔴 **Ζωντανή επαλήθευση 2026-11-07**: τα toast «Η πρόταση … απορρίφθηκε · Αναίρεση» σωρεύονταν (τέσσερα στη στοίβα)
 *   και έμεναν **και μετά** την επαναφορά — ένα «Αναίρεση» για κάτι που είχε ήδη αναιρεθεί.
 * 🔑 **Η μονιμότητα ΔΕΝ αλλάζει** (Material 3 · WCAG 2.2.1 — ο χρήστης αναγνώστη οθόνης πρέπει να προλάβει το κουμπί).
 *   Αλλάζει **πότε παύει να ισχύει**: όχι με ρολόι, αλλά όταν το κλειδί δεν είναι πια απορριφθέν.
 * 🔑 **Η αλήθεια είναι οι απορρίψεις, όχι τα κλικ**: «Αναίρεση» · επαναφορά από τη λίστα · «Επαναφορά όλων» · επαναφορά
 *   από **άλλον** άνθρωπο (snapshot) — όλα καταλήγουν στο ίδιο: το κλειδί λείπει από το `dismissedKeys` ⇒ το toast φεύγει.
 * 🔑 **Σταθερό `id` = κτίριο + κλειδί** ⇒ ξανά απόρριψη της ίδιας πρότασης **αντικαθιστά** το toast, δεν προσθέτει δεύτερο.
 */

import { useCallback, useEffect, useRef } from 'react';

import { useNotifications } from '@/providers/NotificationProvider';

const UNDO_TOAST_PREFIX = 'common-space-suggestion-dismissed:';

/** Το σταθερό `id` του toast — ένα ανά (κτίριο, πρόταση). */
export function suggestionUndoToastId(buildingId: string, key: string): string {
  return `${UNDO_TOAST_PREFIX}${buildingId}:${key}`;
}

export interface SuggestionUndoToast {
  readonly key: string;
  readonly message: string;
  readonly undoLabel: string;
  readonly onUndo: () => void;
}

/**
 * Δείχνει το toast «Αναίρεση» και το αποσύρει όταν το κλειδί πάψει να είναι απορριφθέν.
 * @param dismissedKeys τα κλειδιά που είναι **τώρα** απορριφθέντα (αισιόδοξη εικόνα + snapshot).
 */
export function useSuggestionUndoToasts(buildingId: string, dismissedKeys: ReadonlySet<string>): (toast: SuggestionUndoToast) => void {
  const notifications = useNotifications();
  const open = useRef(new Set<string>());

  useEffect(() => {
    for (const key of open.current) {
      if (dismissedKeys.has(key)) continue;
      notifications.dismiss(suggestionUndoToastId(buildingId, key));
      open.current.delete(key);
    }
  }, [buildingId, dismissedKeys, notifications]);

  return useCallback(({ key, message, undoLabel, onUndo }: SuggestionUndoToast) => {
    open.current.add(key);
    notifications.notify(message, {
      id: suggestionUndoToastId(buildingId, key),
      type: 'info',
      actions: [{ label: undoLabel, onClick: onUndo }],
      onCancel: () => { open.current.delete(key); },
    });
  }, [buildingId, notifications]);
}
