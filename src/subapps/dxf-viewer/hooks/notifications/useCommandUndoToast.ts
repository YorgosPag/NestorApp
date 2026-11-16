'use client';

/**
 * @fileoverview **Το toast «Αναίρεση» μιας εντολής του viewer, δεμένο στο ΕΝΑ ιστορικό αναίρεσης** (ADR-929 §6.24).
 * @related `@/hooks/notifications/useUndoToasts.ts` — ο ΕΝΑΣ μηχανισμός (μονιμότητα ADR-866 §2.10 Β2, σταθερό `id`, απόσυρση)
 * @related `@/components/catalog/imports/use-review-undo-toast.ts` — ίδιος κανόνας «κορυφή της στοίβας», άλλη στοίβα
 * @module subapps/dxf-viewer/hooks/notifications/useCommandUndoToast
 *
 * 🔴 **Μετρημένο ζωντανά 2026-11-16**: «Η βαθμονόμηση αποθηκεύτηκε · Αναίρεση» → Ctrl+Z ⇒ η αναίρεση έγινε, το toast
 *    **έμεινε** — ένα «Αναίρεση» για κάτι ήδη αναιρεμένο (το κουμπί έδινε μόνο «αναίρεσε πρώτα τις επόμενες»).
 * 🔑 **Η αλήθεια είναι το ιστορικό, όχι το κλικ** (Gmail «Undo»: φεύγει μόλις αναιρεθεί): το toast ζει **όσο η εντολή του
 *    είναι στην ΚΟΡΥΦΗ** της στοίβας αναίρεσης. Ctrl+Z · κουμπί ribbon · κουμπί του toast · νέα εντολή που τη θάβει ·
 *    `clear` ⇒ όλα καταλήγουν στο ίδιο: το κλειδί πάψει να είναι ζωντανό ⇒ το toast αποσύρεται. Έτσι το «Αναίρεση» του
 *    toast αναιρεί **πάντα** αυτό που γράφει.
 * 🔑 Κλειδί = `command.id` (σταθερή ταυτότητα της εντολής) ⇒ ένα toast ανά ενέργεια.
 * 🔑 `retireOnUnmount`: η οθόνη που ανακοίνωσε είναι ο κάτοχος της απόσυρσης — χωρίς κάτοχο, κανένα toast.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useUndoToasts, type UndoToast } from '@/hooks/notifications/useUndoToasts';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import type { ICommand } from '../../core/commands/interfaces';

export interface CommandUndoToast extends Omit<UndoToast, 'key'> {
  /** Η εντολή που **ήδη** μπήκε στο ιστορικό — η ταυτότητά της είναι το κλειδί του toast. */
  readonly command: ICommand;
}

const subscribeHistory = (notify: () => void): (() => void) => getGlobalCommandHistory().subscribe(() => notify());
const topCommandId = (): string | null => getGlobalCommandHistory().getLastCommand()?.id ?? null;

/** Δείχνει το toast «Αναίρεση» μιας εντολής και το αποσύρει μόλις η εντολή πάψει να είναι η κορυφή του ιστορικού. */
export function useCommandUndoToast(scope: string): (toast: CommandUndoToast) => void {
  const topId = useSyncExternalStore(subscribeHistory, topCommandId, topCommandId);
  const liveKeys = useMemo(() => new Set(topId === null ? [] : [topId]), [topId]);
  const show = useUndoToasts(scope, liveKeys, { retireOnUnmount: true });
  return useCallback(({ command, ...toast }: CommandUndoToast) => {
    show({ ...toast, key: command.id });
  }, [show]);
}
