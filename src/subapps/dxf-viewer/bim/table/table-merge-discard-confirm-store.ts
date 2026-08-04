/**
 * 🔴 ADR-755 — **«θα κρατηθεί μόνο η επάνω αριστερή τιμή»**: η ερώτηση πριν η συγχώνευση πετάξει
 * περιεχόμενο.
 *
 * Ίδια χειραψία με το {@link table-range-overwrite-confirm-store}, και σκόπιμα **δεύτερο** store
 * αντί για επαναχρήση του πρώτου: η ερώτηση είναι άλλη. Εκείνο ρωτά «θα **αντικατασταθούν**»
 * (τα δεδομένα φεύγουν επειδή έρχονται καινούργια στη θέση τους), αυτό «θα **χαθούν**» (τα
 * δεδομένα φεύγουν και δεν τα διαδέχεται τίποτα). Ένα κοινό store θα ανάγκαζε τον διάλογο να
 * κουβαλά και το **κείμενο** στην κατάσταση — δηλαδή θα μετακόμιζε i18n μέσα σε store.
 *
 * ## Γιατί δεν γράφτηκε boilerplate
 * Χτισμένο πάνω στο **SSoT `createConfirmStore`**, όπως και οι άλλοι δεκατρείς διάλογοι
 * επιβεβαίωσης του subapp. Ένα δεύτερο χειροποίητο `_pendingResolve` + `_subs` + `_notify` θα
 * ήταν ακριβώς ο structural clone που μετρά το CHECK 3.28 (jscpd, N.18).
 *
 * `cells` είναι **πάντα ≥ 1** όσο το ερώτημα είναι ανοιχτό: με `0` δεν ρωτά κανείς — η
 * συγχώνευση εκτελείται σιωπηλά (`tableMergeDiscardedCells === 0`).
 *
 * @module subapps/dxf-viewer/bim/table/table-merge-discard-confirm-store
 * @see ../../stores/createConfirmStore.ts — το factory (Promise-handshake SSoT)
 * @see ./table-range-merge-ops.ts — ποιος μετρά τα κελιά (`tableMergeDiscardedCells`)
 * @see ../../ui/dialogs/TableMergeDiscardConfirmDialog.tsx — ο consumer (self-subscribing portal)
 */

import { createConfirmStore } from '../../stores/createConfirmStore';

/** Απόκριση χρήστη. Το `Esc` και το «Άκυρο» δίνουν το **ίδιο**. */
export type TableMergeDiscardAction = 'merge' | 'cancel';

export interface TableMergeDiscardState {
  readonly open: boolean;
  /** Πόσα κελιά **με περιεχόμενο** θα χαθούν· `0` μόνο όσο ο διάλογος είναι κλειστός. */
  readonly cells: number;
}

const CLOSED: TableMergeDiscardState = { open: false, cells: 0 };

const _store = createConfirmStore<TableMergeDiscardState, TableMergeDiscardAction>(CLOSED);

/**
 * Ανοίγει την ερώτηση «θα χαθεί το περιεχόμενο {cells} κελιών». Αναστέλλει τη συγχώνευση μέχρι
 * την απόκριση και επιστρέφει Promise με την επιλογή του χρήστη.
 */
export const requestTableMergeDiscardConfirm = (
  cells: number,
): Promise<TableMergeDiscardAction> => _store.request({ open: true, cells });

/** Καλείται από τον διάλογο — από **κάθε** έξοδό του (κουμπί, `Esc`). */
export const resolveTableMergeDiscard = (action: TableMergeDiscardAction): void =>
  _store.resolve(action);

/** useSyncExternalStore-compatible subscribe. */
export const subscribeTableMergeDiscard = (cb: () => void): (() => void) => _store.subscribe(cb);

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export const getTableMergeDiscardState = (): TableMergeDiscardState => _store.getSnapshot();
