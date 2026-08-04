'use client';

/**
 * 🔴 ADR-739 §40 — **ΠΟΙΟ ⊕ ΕΙΝΑΙ ΚΑΤΩ ΑΠΟ ΤΟ ΠΟΝΤΙΚΙ**, και σε ποια φάση.
 *
 * ## Γιατί store και όχι React state
 * Ο **μόνος** αναγνώστης είναι ο καμβάς (`TableRenderer`), που δεν μπορεί να διαβάσει React
 * state — και ο μόνος γραφέας είναι ένας ακροατής `mousemove` που ζει έξω από τον κύκλο του
 * React. Ένα `useState` εδώ θα σήμαινε **απόδοση React ανά κίνηση ποντικιού**: ακριβώς η
 * κατηγορία που ο ADR-040 απαγορεύει ονομαστικά. Ίδιο σχήμα με το `table-indicator-hover-store`,
 * τον γείτονα που γεννήθηκε από την ίδια ανάγκη μία εβδομάδα νωρίτερα.
 *
 * ## 🔴 ΤΟ ΚΡΙΣΙΜΟ: το καρέ ζητιέται ΜΟΝΟ όταν αλλάζει το χειριστήριο
 * Το `mousemove` πυροδοτεί ~60 φορές το δευτερόλεπτο, ενώ η απάντηση «ποιο ⊕ και σε ποια
 * φάση» αλλάζει μερικές φορές ανά σύρσιμο χεριού. Ένα άνευ όρων `markSystemsDirty` θα ξανάβαφε
 * ολόκληρο τον καμβά σε **κάθε** κίνηση όσο ο πίνακας είναι επιλεγμένος. Γι' αυτό ο φύλακας
 * ισότητας ζει **εδώ**, στον γραφέα, και όχι στον καλούντα: ένας δεύτερος γραφέας αύριο δεν θα
 * μπορεί να τον ξεχάσει.
 *
 * ⚠️ Η σύγκριση γίνεται **κατά ταυτότητα** ({@link sameTableInsertControl}), όχι κατά αναφορά:
 * το `tableInsertControlAtFrame` παράγει **νέο** αντικείμενο σε κάθε κλήση, οπότε μια σύγκριση
 * αναφοράς θα δήλωνε «άλλαξε» σε κάθε pixel και ο φύλακας θα ήταν διακοσμητικός.
 *
 * ⚠️ Και συγκρίνει **και τη φάση**: το πέρασμα `nearby → armed` δεν αλλάζει ούτε άξονα ούτε
 * σύνορο, αλλά αλλάζει **ό,τι βλέπει ο χρήστης** (ένταση + γραμμή προεπισκόπησης). Ένας
 * φύλακας που κοίταζε μόνο την ταυτότητα του συνόρου θα κατάπινε ακριβώς την ανάδραση για την
 * οποία υπάρχουν οι δύο φάσεις.
 *
 * ## Γιατί κουβαλά `entityId`
 * Δύο πίνακες μπορούν να ζουν στην ίδια σκηνή. Χωρίς την ταυτότητα της οντότητας, ένα ⊕ θα
 * ζωγραφιζόταν σε **λάθος** πίνακα — ίδιος λόγος με τον `entityId` του δρομέα κελιού και του
 * hover των ζωνών.
 *
 * @module subapps/dxf-viewer/state/table-insert-control-store
 * @see bim/table/table-insert-control.ts — ΠΟΙΟ ⊕ (η ερώτηση + η σύγκριση ταυτότητας)
 * @see ui/table-cell-editor/use-table-indicator-hover.ts — ο ΕΝΑΣ γραφέας
 * @see rendering/entities/TableRenderer.ts — ο ΕΝΑΣ αναγνώστης, τη στιγμή του καρέ
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §40
 */

import { createExternalStore } from '../stores/createExternalStore';
import { markSystemsDirty } from '../rendering/core/frame-scheduler-api';
import {
  sameTableInsertControl,
  type TableInsertControlHit,
} from '../bim/table/table-insert-control';

/** Το χειριστήριο κάτω από τον δείκτη, μαζί με τον πίνακα στον οποίο ανήκει. */
export interface TableInsertControlState {
  readonly entityId: string;
  readonly control: TableInsertControlHit;
}

/**
 * Ο ζωγράφος του καμβά ξαναβάφει **μόνο** όταν του το ζητήσουν (ADR-040 / ADR-119). Ίδιο
 * σύστημα με τον δρομέα κελιού — το ⊕ ζωγραφίζεται στο **ίδιο** overlay pass, ποτέ μέσα στο
 * cached raster της σκηνής (ADR-040 κανόνας #3).
 */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

const store = createExternalStore<TableInsertControlState | null>(null);

/** Ίδιο χειριστήριο του ίδιου πίνακα; Δες την κεφαλίδα: κατά **ταυτότητα**, ποτέ κατά αναφορά. */
function sameState(a: TableInsertControlState | null, b: TableInsertControlState | null): boolean {
  if (a === null || b === null) return a === b;
  return a.entityId === b.entityId && sameTableInsertControl(a.control, b.control);
}

/** Καθαρή ανάγνωση — ο getter που καλεί ο `TableRenderer` τη στιγμή του καρέ. */
export function getTableInsertControl(): TableInsertControlState | null {
  return store.get();
}

/**
 * Γράφει το χειριστήριο κάτω από το ποντίκι και ζητά **ένα** καρέ — αλλά **μόνο** αν κάτι
 * όντως άλλαξε. Δες την κεφαλίδα για το γιατί ο φύλακας ζει εδώ και όχι στον καλούντα.
 */
export function setTableInsertControl(next: TableInsertControlState | null): void {
  if (sameState(store.get(), next)) return;
  store.set(next);
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
}

/**
 * Κανένα χειριστήριο κάτω από το ποντίκι. Ιδεμποτής — και γι' αυτό μπορεί να δοθεί απευθείας
 * ως ακροατής `mouseleave` χωρίς περιτύλιγμα που θα άλλαζε ταυτότητα σε κάθε απόδοση.
 */
export function clearTableInsertControl(): void {
  setTableInsertControl(null);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα αδελφά stores. */
export function __resetTableInsertControlForTests(): void {
  store.reset(null);
}
