/**
 * 🔴 ADR-833 §1.4 — **«ΤΙ ΝΑ ΚΑΝΩ ΜΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ;»**: η ερώτηση του «Ανοίγματος».
 *
 * Απόφαση Giorgio (30/08): το «Άνοιγμα» **ρωτάει**. Οι δύο απαντήσεις δεν είναι «ναι/όχι» —
 * είναι **δύο διαφορετικές πράξεις**, και καμία δεν είναι προφανώς σωστή:
 *
 * ```
 *   replace    →  ο ΙΔΙΟΣ πίνακας γίνεται το αρχείο   (χάνεται ό,τι είχε)
 *   new-table  →  ΝΕΟΣ πίνακας δίπλα                  (ο παλιός μένει ανέπαφος)
 *   cancel     →  τίποτα
 * ```
 *
 * ## 🔑 ΓΙΑΤΙ ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ ΚΑΙ ΟΧΙ ΔΥΟ
 * Ο αδελφός {@link TableRangeOverwriteAction} έχει `replace | cancel`, γιατί εκεί η ερώτηση
 * είναι *«θα σβήσω κάτι — προχωράω;»* και η μόνη εναλλακτική είναι να μην προχωρήσεις. Εδώ ο
 * χρήστης έχει **τρίτο δρόμο που θέλει πραγματικά**: να πάρει τα δεδομένα **χωρίς** να χάσει
 * τα παλιά. Ένα «Άκυρο» που τον αναγκάζει να φτιάξει μόνος του δεύτερο πίνακα και να ξαναπατήσει
 * «Άνοιγμα» θα ήταν ο διάλογος να τον στέλνει πίσω σε δουλειά που ξέρει ήδη να κάνει μόνος του.
 *
 * ## 🔴 ΤΟ ΟΝΟΜΑ ΤΟΥ ΑΡΧΕΙΟΥ ΤΑΞΙΔΕΥΕΙ ΜΕΣΑ ΣΤΗΝ ΚΑΤΑΣΤΑΣΗ
 * Ίδιος συλλογισμός με τον αριθμό κελιών του αδελφού (οδηγία Nielsen Norman για καταστροφικές
 * ενέργειες): ο χρήστης **δεν μπορεί να κρίνει** μια αντικατάσταση αν δεν βλέπει τι μπαίνει στη
 * θέση των δεδομένων του. Το κόστος είναι μηδέν — το όνομα το κρατά ήδη ο επιλογέας.
 *
 * ## Γιατί δεν γράφτηκε boilerplate
 * Χτισμένο πάνω στο **SSoT `createConfirmStore`**, όπως και οι άλλοι δεκατρείς διάλογοι
 * επιβεβαίωσης του subapp. Ένα δεύτερο χειροποίητο `_pendingResolve` + `_subs` + `_notify` θα
 * ήταν ακριβώς ο structural clone που μετρά το **CHECK 3.28** (jscpd, N.18).
 *
 * @module subapps/dxf-viewer/bim/table/table-xlsx-open-confirm-store
 * @see ../../stores/createConfirmStore.ts — το factory (Promise-handshake SSoT)
 * @see ./table-range-overwrite-confirm-store.ts — ο αδελφός με τις δύο απαντήσεις
 * @see ../../ui/dialogs/TableXlsxOpenConfirmDialog.tsx — ο consumer (self-subscribing portal)
 */

import { createConfirmStore } from '../../stores/createConfirmStore';

/** Απόκριση χρήστη. Το `Esc` και το «Άκυρο» δίνουν το **ίδιο** — `cancel`. */
export type TableXlsxOpenAction = 'replace' | 'new-table' | 'cancel';

export interface TableXlsxOpenState {
  readonly open: boolean;
  /** Το όνομα του αρχείου που διάλεξε ο χρήστης· κενό μόνο όσο ο διάλογος είναι κλειστός. */
  readonly fileName: string;
}

const CLOSED: TableXlsxOpenState = { open: false, fileName: '' };

const _store = createConfirmStore<TableXlsxOpenState, TableXlsxOpenAction>(CLOSED);

/**
 * Ανοίγει την ερώτηση «αντικατάσταση ή νέος πίνακας;». Αναστέλλει την εισαγωγή μέχρι την
 * απόκριση και επιστρέφει Promise με την επιλογή του χρήστη.
 */
export const requestTableXlsxOpenConfirm = (
  params: { readonly fileName: string },
): Promise<TableXlsxOpenAction> => _store.request({ open: true, fileName: params.fileName });

/** Καλείται από τον διάλογο — από **κάθε** έξοδό του (κουμπιά, `Esc`). */
export const resolveTableXlsxOpen = (action: TableXlsxOpenAction): void => _store.resolve(action);

/** useSyncExternalStore-compatible subscribe. */
export const subscribeTableXlsxOpen = (cb: () => void): (() => void) => _store.subscribe(cb);

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export const getTableXlsxOpenState = (): TableXlsxOpenState => _store.getSnapshot();
