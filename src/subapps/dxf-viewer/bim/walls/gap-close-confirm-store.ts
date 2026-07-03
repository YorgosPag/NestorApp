/**
 * ADR-419 §gap-close — confirm store για το «Να κλείσω το κενό;» (open-loop).
 *
 * Όταν ένα region/perimeter pick εντοπίζει ΜΗ κλειστό βρόχο με ακριβώς 2 ανοιχτά
 * άκρα (AutoCAD BOUNDARY gap), η εφαρμογή ρωτά τον χρήστη αν θέλει να κλείσει το
 * κενό· «Ναι» → προσθέτει μια γραμμή που ενώνει τα δύο άκρα (κλείνει τον βρόχο).
 *
 * Promise-handshake μέσω του κοινού `createConfirmStore` SSoT (μηδέν boilerplate),
 * όπως `column-perimeter-confirm-store`.
 *
 * @see ../../stores/createConfirmStore.ts
 * @see ../../hooks/drawing/use-region-gap-close.ts (listener → line insert)
 */

import type { Point2D } from '../../rendering/types/Types';
import { createConfirmStore } from '../../stores/createConfirmStore';

export type GapCloseAction = 'close' | 'cancel';

export interface GapCloseConfirmState {
  readonly open: boolean;
  /** Τα δύο ανοιχτά άκρα που θα ενωθούν (world units). */
  readonly start: Point2D | null;
  readonly end: Point2D | null;
}

const CLOSED: GapCloseConfirmState = { open: false, start: null, end: null };

const store = createConfirmStore<GapCloseConfirmState, GapCloseAction>(CLOSED);

/** Άνοιξε το «Να κλείσω το κενό;» με τα δύο άκρα· επιστρέφει την επιλογή. */
export function requestGapCloseConfirm(start: Point2D, end: Point2D): Promise<GapCloseAction> {
  return store.request({ open: true, start, end });
}

export function resolveGapCloseConfirm(action: GapCloseAction): void {
  store.resolve(action);
}

export const subscribeGapCloseConfirm = store.subscribe;
export const getGapCloseConfirmState = store.getSnapshot;
