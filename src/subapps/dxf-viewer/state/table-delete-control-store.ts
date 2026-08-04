'use client';

/**
 * 🔴 ADR-739 §42 — **ΠΟΙΟ ⊖ ΕΙΝΑΙ ΚΑΤΩ ΑΠΟ ΤΟ ΠΟΝΤΙΚΙ**, σε ποια φάση, και **ποιους άξονες**
 * θα σβήσει.
 *
 * ## Γιατί store και όχι React state
 * Ο **μόνος** αναγνώστης είναι ο καμβάς (`TableRenderer`), που δεν μπορεί να διαβάσει React
 * state — και ο μόνος γραφέας είναι ένας ακροατής `mousemove` που ζει έξω από τον κύκλο του
 * React. Ένα `useState` εδώ θα σήμαινε **απόδοση React ανά κίνηση ποντικιού**: ακριβώς η
 * κατηγορία που ο ADR-040 απαγορεύει ονομαστικά. Ίδιο σχήμα με τα δύο αδέλφια stores
 * (`table-indicator-hover-store`, `table-insert-control-store`).
 *
 * ## 🔴 ΓΙΑΤΙ ΚΟΥΒΑΛΑ ΟΛΟΚΛΗΡΟ ΤΟΝ ΣΤΟΧΟ ΚΑΙ ΟΧΙ ΜΟΝΟ ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ
 * Το §27.17 κατέγραψε το ελάττωμα με στιγμιότυπο: ο χρήστης μάρκαρε **τρεις** στήλες, το μενού
 * έσβησε **μία**, και τίποτα δεν το δήλωνε. Η θεραπεία ήταν το `resolveTableAxisActionTarget`
 * — «η επιλογή μετράει αν το πάτημα έπεσε μέσα της». Το ⊖ υπακούει στον **ίδιο** κανόνα, και
 * γι' αυτό ο στόχος ταξιδεύει **μαζί** με το χειριστήριο αντί να ξαναϋπολογιστεί:
 *
 *  - ο **ζωγράφος** βάφει κόκκινους ακριβώς τους άξονες που θα φύγουν·
 *  - το **πάτημα** σβήνει ακριβώς αυτούς που είναι βαμμένοι.
 *
 * Δύο ξεχωριστοί υπολογισμοί θα ήταν δύο ευκαιρίες να διαφωνήσουν — και η διαφωνία θα ήταν
 * **αόρατη**, γιατί και τα δύο αποτελέσματα είναι απολύτως έγκυρα. *Ό,τι πατιέται είναι ό,τι
 * φαίνεται* (§40.5), εφαρμοσμένο σε πράξη που **καταστρέφει**.
 *
 * ## 🔴 ΤΟ ΚΡΙΣΙΜΟ: το καρέ ζητιέται ΜΟΝΟ όταν αλλάζει κάτι ορατό
 * Το `mousemove` πυροδοτεί ~60 φορές το δευτερόλεπτο. Ο φύλακας ισότητας ζει **εδώ**, στον
 * γραφέα, ώστε ένας δεύτερος γραφέας αύριο να μην μπορεί να τον ξεχάσει — ίδια αρχή με τα δύο
 * αδέλφια.
 *
 * ⚠️ Ο φύλακας συγκρίνει **και το διάστημα του στόχου**, όχι μόνο το χειριστήριο. Με ακίνητο
 * χέρι πάνω στο `C` και επέκταση επιλογής από το πληκτρολόγιο (`Shift+βέλος`), το ⊖ μένει
 * ταυτόσημο ενώ το **πλύσιμο** οφείλει να απλωθεί σε τρεις στήλες. Ένας φύλακας που κοίταζε
 * μόνο το χειριστήριο θα κατάπινε ακριβώς αυτό το καρέ, και η οθόνη θα υποσχόταν μία στήλη
 * ενώ το πάτημα θα έσβηνε τρεις — το §27.17, αντεστραμμένο.
 *
 * @module subapps/dxf-viewer/state/table-delete-control-store
 * @see bim/table/table-delete-control.ts — ΠΟΙΟ ⊖ (η ερώτηση + η σύγκριση ταυτότητας)
 * @see bim/table/table-axis-action-target.ts — ΠΟΙΟΥΣ άξονες (ο κανόνας του §27.17)
 * @see ui/table-cell-editor/use-table-indicator-hover.ts — ο ΕΝΑΣ γραφέας
 * @see rendering/entities/TableRenderer.ts — ο ΕΝΑΣ αναγνώστης, τη στιγμή του καρέ
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §42
 */

import { createExternalStore } from '../stores/createExternalStore';
import { markSystemsDirty } from '../rendering/core/frame-scheduler-api';
import {
  sameTableDeleteControl,
  type TableDeleteControlHit,
} from '../bim/table/table-delete-control';
import type { TableAxisActionTarget } from '../bim/table/table-axis-action-target';

/** Το χειριστήριο κάτω από τον δείκτη, ο πίνακάς του, και **τι ακριβώς θα φύγει**. */
export interface TableDeleteControlState {
  readonly entityId: string;
  readonly control: TableDeleteControlHit;
  /** Οι άξονες που θα σβηστούν — δες την κεφαλίδα: ο ζωγράφος και το πάτημα διαβάζουν αυτόν. */
  readonly target: TableAxisActionTarget;
}

/**
 * Ο ζωγράφος του καμβά ξαναβάφει **μόνο** όταν του το ζητήσουν (ADR-040 / ADR-119). Το ⊖
 * ζωγραφίζεται στο **ίδιο** overlay pass με τον δρομέα, ποτέ μέσα στο cached raster της σκηνής.
 */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

const store = createExternalStore<TableDeleteControlState | null>(null);

/** Ίδιο χειριστήριο **και** ίδιο διάστημα στόχου; Δες την κεφαλίδα για το γιατί και τα δύο. */
function sameState(a: TableDeleteControlState | null, b: TableDeleteControlState | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.entityId === b.entityId &&
    sameTableDeleteControl(a.control, b.control) &&
    a.target.axis === b.target.axis &&
    a.target.firstIndex === b.target.firstIndex &&
    a.target.lastIndex === b.target.lastIndex
  );
}

/** Καθαρή ανάγνωση — ο getter που καλούν ο `TableRenderer` και το πάτημα. */
export function getTableDeleteControl(): TableDeleteControlState | null {
  return store.get();
}

/**
 * Γράφει το χειριστήριο κάτω από το ποντίκι και ζητά **ένα** καρέ — αλλά **μόνο** αν κάτι
 * όντως άλλαξε. Δες την κεφαλίδα για το γιατί ο φύλακας ζει εδώ και όχι στον καλούντα.
 */
export function setTableDeleteControl(next: TableDeleteControlState | null): void {
  if (sameState(store.get(), next)) return;
  store.set(next);
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
}

/**
 * Κανένα χειριστήριο κάτω από το ποντίκι. Ιδεμποτής — και γι' αυτό μπορεί να δοθεί απευθείας
 * ως ακροατής `mouseleave` χωρίς περιτύλιγμα που θα άλλαζε ταυτότητα σε κάθε απόδοση.
 */
export function clearTableDeleteControl(): void {
  setTableDeleteControl(null);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα αδελφά stores. */
export function __resetTableDeleteControlForTests(): void {
  store.reset(null);
}
