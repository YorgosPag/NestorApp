'use client';

/**
 * @fileoverview **Το toast «Αναίρεση» που φεύγει μόλις η αναίρεση πάψει να έχει νόημα** — ο ΕΝΑΣ μηχανισμός (ADR-866 §2.10 ·
 * ADR-931 §6.2 Β2.1 · ADR-923 §5.5.2 Β9γ).
 * @related `providers/notification-policy.ts` (ADR-866 §2.10 Β2: toast με ενέργεια ΜΕΝΕΙ) ·
 *   `building-management/CommonSpacesTab/useSuggestionUndoToasts.ts` (απόρριψη πρότασης κοινοχρήστου) ·
 *   `catalog/imports/use-review-undo-toast.ts` (ομαδική πράξη στον έλεγχο εισαγωγής)
 * @module hooks/notifications/useUndoToasts
 *
 * 🔑 **Η μονιμότητα ΔΕΝ αλλάζει** (Material 3 · WCAG 2.2.1): καμία διάρκεια — ο χρήστης αναγνώστη οθόνης πρέπει να προλάβει
 *    το κουμπί. Αλλάζει **πότε παύει να ισχύει**: όχι με ρολόι ούτε με κλικ, αλλά όταν ο καλών πει ότι το κλειδί **δεν** είναι
 *    πια αναιρέσιμο (`liveKeys`). Κάθε δρόμος (το κουμπί · πληκτρολόγιο · λίστα · άλλος άνθρωπος) καταλήγει στο ίδιο.
 * 🔑 **Σταθερό `id` = εύρος + κλειδί** ⇒ ίδια πράξη ξανά **αντικαθιστά** το toast, δεν προσθέτει δεύτερο. Το `id` κρατιέται
 *    όπως **δόθηκε**: αν αλλάξει το εύρος (άλλο κτίριο, άλλη παρτίδα), το παλιό toast αποσύρεται με το δικό του `id`.
 * 🔑 `retireOnUnmount`: όταν η ενέργεια ζει στη μνήμη της οθόνης (στοίβα αναίρεσης), το toast δεν επιζεί της οθόνης — ένα
 *    «Αναίρεση» χωρίς κάτοχο θα ήταν ψέμα.
 */

import { useCallback, useEffect, useRef } from 'react';

import { useNotifications } from '@/providers/NotificationProvider';

/** Το σταθερό `id` του toast — ένα ανά (εύρος, κλειδί). */
export function undoToastId(scope: string, key: string): string {
  return `${scope}:${key}`;
}

export interface UndoToast {
  readonly key: string;
  readonly message: string;
  readonly undoLabel: string;
  readonly onUndo: () => void;
}

export interface UndoToastOptions {
  /** Απόσυρση κάθε ανοιχτού toast όταν φύγει η οθόνη — για αναίρεση που ζει μόνο όσο ζει η οθόνη. */
  readonly retireOnUnmount?: boolean;
}

/**
 * Δείχνει το toast «Αναίρεση» και το αποσύρει όταν το κλειδί πάψει να είναι αναιρέσιμο.
 * @param scope     το εύρος του `id` (π.χ. κτίριο, παρτίδα).
 * @param liveKeys  τα κλειδιά που είναι **τώρα** αναιρέσιμα.
 */
export function useUndoToasts(scope: string, liveKeys: ReadonlySet<string>, options: UndoToastOptions = {}): (toast: UndoToast) => void {
  const notifications = useNotifications();
  const open = useRef(new Map<string, string>());
  const retireOnUnmount = options.retireOnUnmount === true;

  useEffect(() => {
    for (const [key, id] of open.current) {
      if (liveKeys.has(key)) continue;
      notifications.dismiss(id);
      open.current.delete(key);
    }
  }, [liveKeys, notifications]);

  // Η αναφορά του provider είναι σταθερή· ο καθαρισμός διαβάζει την τελευταία, ώστε να τρέχει ΜΟΝΟ στο unmount.
  const latest = useRef(notifications);
  useEffect(() => { latest.current = notifications; }, [notifications]);
  useEffect(() => {
    if (!retireOnUnmount) return undefined;
    const current = open.current;
    return () => {
      for (const id of current.values()) latest.current.dismiss(id);
      current.clear();
    };
  }, [retireOnUnmount]);

  return useCallback(({ key, message, undoLabel, onUndo }: UndoToast) => {
    const id = undoToastId(scope, key);
    open.current.set(key, id);
    notifications.notify(message, {
      id,
      type: 'info',
      actions: [{ label: undoLabel, onClick: onUndo }],
      onCancel: () => { open.current.delete(key); },
    });
  }, [notifications, scope]);
}
