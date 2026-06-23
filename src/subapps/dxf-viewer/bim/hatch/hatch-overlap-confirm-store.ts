/**
 * ADR-507 Φ3 — confirm-dialog handshake store για επικάλυψη γραμμοσκίασης.
 *
 * Όταν ο χρήστης κάνει pick-point μέσα σε περιοχή που ΕΧΕΙ ήδη γραμμοσκίαση, η
 * δημιουργία αναστέλλεται και τον ρωτάμε (opt-in «ΠΟΤΕ σιωπηλά»): να προστεθεί
 * δεύτερη (stack, σαν AutoCAD) ή άκυρο. Επιλογή Giorgio: «Προειδοποίηση + επιτρέπεται».
 *
 * Χτισμένο πάνω στο **SSoT `createConfirmStore`** factory (μηδέν hand-rolled boilerplate)·
 * τα named wrappers κρατούν σαφές το public API ανά domain.
 *
 * @see ../../stores/createConfirmStore.ts — το factory (Promise-handshake SSoT)
 * @see ../../ui/dialogs/HatchOverlapConfirmDialog.tsx — ο consumer (self-subscribing portal)
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import { createConfirmStore } from '../../stores/createConfirmStore';

/** Απόκριση χρήστη: δημιουργία (stack) / ακύρωση. */
export type HatchOverlapAction = 'create' | 'cancel';

export interface HatchOverlapState {
  readonly open: boolean;
}

const _store = createConfirmStore<HatchOverlapState, HatchOverlapAction>({ open: false });

/**
 * Ανοίγει το confirm dialog «η περιοχή έχει ήδη γραμμοσκίαση». Αναστέλλει τη δημιουργία
 * μέχρι την απόκριση. Επιστρέφει Promise που resolve-άρει με την επιλογή του χρήστη.
 */
export const requestHatchOverlapConfirm = (): Promise<HatchOverlapAction> =>
  _store.request({ open: true });

/** Καλείται από το dialog στο κλικ του χρήστη. */
export const resolveHatchOverlap = (action: HatchOverlapAction): void => _store.resolve(action);

/** useSyncExternalStore-compatible subscribe. */
export const subscribeHatchOverlap = (cb: () => void): () => void => _store.subscribe(cb);

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export const getHatchOverlapState = (): HatchOverlapState => _store.getSnapshot();
