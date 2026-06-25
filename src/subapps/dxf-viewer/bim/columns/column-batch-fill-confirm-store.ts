/**
 * ADR-524 — confirm-dialog handshake store για την «Πολλαπλή πλήρωση όμοιων
 * πλαισίων». Χτισμένο στο SSoT `createConfirmStore` (μηδέν boilerplate).
 *
 * Ξεχωριστό store από το `column-perimeter-confirm-store` ώστε να μην συγκρούεται
 * το pending Promise: το batch-fill προτείνεται ΜΕΤΑ το πραγματικό commit (sync ή
 * μετά το intent-resolve), οπότε δεν συνυπάρχουν δύο ανοιχτά dialogs.
 *
 * @see ./column-batch-fill.ts (orchestrator)
 * @see ../../stores/createConfirmStore.ts (SSoT factory)
 * @see ../../ui/dialogs/ColumnBatchFillConfirmDialog.tsx (view)
 */

import { createConfirmStore } from '../../stores/createConfirmStore';

/** 'fill-all' → δημιουργία σε όλα τα όμοια πλαίσια· 'cancel' → τίποτα. */
export type ColumnBatchFillAction = 'fill-all' | 'cancel';

export interface ColumnBatchFillState {
  readonly open: boolean;
  /** Πλήθος όμοιων πλαισίων που θα γίνουν κολόνες. */
  readonly columnCount: number;
  /** Πλήθος όμοιων πλαισίων που θα γίνουν τοιχία (aspect > 4, EC2 §9.6.1). */
  readonly wallCount: number;
}

const CLOSED: ColumnBatchFillState = { open: false, columnCount: 0, wallCount: 0 };

const _store = createConfirmStore<ColumnBatchFillState, ColumnBatchFillAction>(CLOSED);

/** Ανοίγει το dialog «βρέθηκαν όμοια πλαίσια» και περιμένει την επιλογή του χρήστη. */
export function requestColumnBatchFillConfirm(args: {
  columnCount: number;
  wallCount: number;
}): Promise<ColumnBatchFillAction> {
  return _store.request({ open: true, columnCount: args.columnCount, wallCount: args.wallCount });
}

/** Καλείται από το dialog στο κλικ του χρήστη. */
export function resolveColumnBatchFillConfirm(action: ColumnBatchFillAction): void {
  _store.resolve(action);
}

/** useSyncExternalStore-compatible subscribe. */
export const subscribeColumnBatchFillConfirm = _store.subscribe;

/** useSyncExternalStore-compatible snapshot getter (σταθερή reference μεταξύ αλλαγών). */
export const getColumnBatchFillConfirmState = _store.getSnapshot;
