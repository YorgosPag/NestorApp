/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 4) — **«ΥΠΑΡΧΟΥΝ ΗΔΗ ΔΕΔΟΜΕΝΑ ΕΔΩ»**: η ερώτηση πριν σβηστεί περιεχόμενο.
 *
 * Η **πρώτη** από τις τρεις αποφάσεις του ιδιοκτήτη (03/08): *ρώτα πριν σβήσεις*. Ό,τι ζει εδώ
 * είναι **μόνο** η χειραψία — ποιο ερώτημα είναι ανοιχτό και ποια απάντηση δόθηκε· το «θα χαθεί
 * κάτι;» το απαντά η καθαρή γεωμετρία ({@link tableRangeOverwrittenCells}) και το «τι γράφεται»
 * ο εφαρμοστής. Τρία αρχεία, τρεις ερωτήσεις, καμία επικάλυψη.
 *
 * ## Γιατί δεν γράφτηκε boilerplate
 * Χτισμένο πάνω στο **SSoT `createConfirmStore`**, όπως και οι άλλοι **δώδεκα** διάλογοι
 * επιβεβαίωσης του subapp (`hatch-overlap`, `column-perimeter`, `gap-close`, …). Ένα δεύτερο
 * χειροποίητο `_pendingResolve` + `_subs` + `_notify` θα ήταν ακριβώς ο structural clone που
 * μετρά το **CHECK 3.28** (jscpd, N.18) — και ο λόγος που το factory υπάρχει.
 *
 * ## 🔑 ΓΙΑΤΙ Ο ΑΡΙΘΜΟΣ ΤΑΞΙΔΕΥΕΙ ΜΕΣΑ ΣΤΗΝ ΚΑΤΑΣΤΑΣΗ
 * Το Excel ρωτά *«There's already data here. Do you want to replace it?»* — **χωρίς αριθμό**. Η
 * οδηγία της Nielsen Norman για καταστροφικές ενέργειες λέει το αντίθετο: *«Delete 3 issues?»*
 * αντί για «Are you sure?», γιατί ο χρήστης δεν μπορεί να κρίνει ένα ρίσκο που δεν του μετρήθηκε.
 * Το κόστος του αριθμού εδώ είναι **μηδέν** (ο μετρητής υπάρχει ήδη μέσα στο κατηγόρημα), οπότε
 * είναι η μία θέση όπου γίνεται να είμαστε **πιο σαφείς** από τον μεγάλο παίκτη χωρίς να
 * αποκλίνουμε από τη σημασία του.
 *
 * `cells` είναι **πάντα ≥ 1** όσο το ερώτημα είναι ανοιχτό: με `0` δεν ρωτά κανείς — η μεταφορά
 * εκτελείται σιωπηλά, όπως και σήμερα.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-overwrite-confirm-store
 * @see ../../stores/createConfirmStore.ts — το factory (Promise-handshake SSoT)
 * @see ./table-range-transfer-plan.ts — ποιος μετρά τα κελιά
 * @see ../../ui/dialogs/TableRangeOverwriteConfirmDialog.tsx — ο consumer (self-subscribing portal)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36.22
 */

import { createConfirmStore } from '../../stores/createConfirmStore';

/** Απόκριση χρήστη: αντικατάσταση / ακύρωση. Το `Esc` και το «Άκυρο» δίνουν το **ίδιο**. */
export type TableRangeOverwriteAction = 'replace' | 'cancel';

export interface TableRangeOverwriteState {
  readonly open: boolean;
  /** Πόσα κελιά **με περιεχόμενο** θα αντικατασταθούν· `0` μόνο όσο ο διάλογος είναι κλειστός. */
  readonly cells: number;
}

const CLOSED: TableRangeOverwriteState = { open: false, cells: 0 };

const _store = createConfirmStore<TableRangeOverwriteState, TableRangeOverwriteAction>(CLOSED);

/**
 * Ανοίγει την ερώτηση «θα αντικατασταθούν {cells} κελιά». Αναστέλλει τη μεταφορά μέχρι την
 * απόκριση και επιστρέφει Promise με την επιλογή του χρήστη.
 */
export const requestTableRangeOverwriteConfirm = (
  cells: number,
): Promise<TableRangeOverwriteAction> => _store.request({ open: true, cells });

/** Καλείται από τον διάλογο — από **κάθε** έξοδό του (κουμπί, `Esc`). */
export const resolveTableRangeOverwrite = (action: TableRangeOverwriteAction): void =>
  _store.resolve(action);

/** useSyncExternalStore-compatible subscribe. */
export const subscribeTableRangeOverwrite = (cb: () => void): (() => void) => _store.subscribe(cb);

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export const getTableRangeOverwriteState = (): TableRangeOverwriteState => _store.getSnapshot();
