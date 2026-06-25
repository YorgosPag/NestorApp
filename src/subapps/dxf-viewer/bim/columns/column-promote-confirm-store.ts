/**
 * ADR-529 — confirm-dialog handshake store για την «Προαγωγή γωνιακής κολόνας σε Γ (boundary element)».
 * Χτισμένο στο SSoT `createConfirmStore` (μηδέν boilerplate) — αδελφός του `column-batch-fill-confirm-store`.
 *
 * Το Revit δεν αλλάζει σιωπηλά γεωμετρία (decision Giorgio 2026-06-25): μετά το commit ενός δοκαριού που
 * πλαισιώνεται σε μη-αναπτυσσόμενη παρειά γωνιακής κολόνας μίας κατεύθυνσης, ρωτάμε αν θα προαχθεί σε Γ.
 *
 * @see ./column-beam-promote-junction.ts (detector)
 * @see ../../hooks/useColumnBeamPromote.ts (orchestrator)
 * @see ../../stores/createConfirmStore.ts (SSoT factory)
 * @see ../../ui/dialogs/ColumnPromoteConfirmDialog.tsx (view)
 */

import { createConfirmStore } from '../../stores/createConfirmStore';

/** 'promote' → προαγωγή σε Γ· 'cancel' → καμία αλλαγή. */
export type ColumnPromoteAction = 'promote' | 'cancel';

export interface ColumnPromoteState {
  readonly open: boolean;
  /** Πλήθος κολόνων που θα προαχθούν σε Γ (boundary element). */
  readonly columnCount: number;
}

const CLOSED: ColumnPromoteState = { open: false, columnCount: 0 };

const _store = createConfirmStore<ColumnPromoteState, ColumnPromoteAction>(CLOSED);

/** Ανοίγει το dialog «προαγωγή σε Γ;» και περιμένει την επιλογή του χρήστη. */
export function requestColumnPromoteConfirm(args: { columnCount: number }): Promise<ColumnPromoteAction> {
  return _store.request({ open: true, columnCount: args.columnCount });
}

/** Καλείται από το dialog στο κλικ του χρήστη. */
export function resolveColumnPromoteConfirm(action: ColumnPromoteAction): void {
  _store.resolve(action);
}

/** useSyncExternalStore-compatible subscribe. */
export const subscribeColumnPromoteConfirm = _store.subscribe;

/** useSyncExternalStore-compatible snapshot getter (σταθερή reference μεταξύ αλλαγών). */
export const getColumnPromoteConfirmState = _store.getSnapshot;
