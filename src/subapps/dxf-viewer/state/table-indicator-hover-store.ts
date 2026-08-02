'use client';

/**
 * ADR-739 §30 — **ΠΟΙΑ ΥΠΟΔΙΑΙΡΕΣΗ ΖΩΝΗΣ ΕΙΝΑΙ ΚΑΤΩ ΑΠΟ ΤΟ ΠΟΝΤΙΚΙ.**
 *
 * Ο δείκτης πίνακα (γράμματα στηλών πάνω, αριθμοί γραμμών αριστερά) ήξερε μέχρι τώρα **δύο**
 * καταστάσεις: ουδέτερη και **ενεργή** (η στήλη/γραμμή που δέχεται το πληκτρολόγιο). Έλειπε
 * η τρίτη, που κάθε φύλλο υπολογισμού έχει από την πρώτη του έκδοση: **«εδώ δείχνεις τώρα»**.
 * Χωρίς αυτήν, ο χρήστης δεν μαθαίνει ποτέ ότι η λωρίδα είναι **πατήσιμη** — μαθαίνει μόνο
 * ό,τι πάτησε ήδη, δηλαδή το feedback έρχεται πάντα μετά την ενέργεια, ποτέ πριν.
 *
 * ## 🔴 Γιατί store και όχι React state
 * Ο **μόνος** καταναλωτής είναι ο καμβάς (`TableRenderer`), που δεν μπορεί να διαβάσει React
 * state — και ο μόνος γραφέας είναι ένας ακροατής `mousemove` που ζει έξω από τον κύκλο του
 * React. Ένα `useState` εδώ θα σήμαινε **απόδοση React ανά κίνηση ποντικιού**: ακριβώς η
 * κατηγορία που ο ADR-040 απαγορεύει ονομαστικά. Ίδιο σχήμα με το `HoverStore` των οντοτήτων
 * και με το `table-cell-cursor-store`: μηδέν React state, ανάγνωση με getter τη στιγμή του
 * καρέ.
 *
 * ## 🔴 ΤΟ ΚΡΙΣΙΜΟ: το καρέ ζητιέται ΜΟΝΟ όταν αλλάζει η υποδιαίρεση
 * Το `mousemove` πυροδοτεί ~60 φορές το δευτερόλεπτο, ενώ η απάντηση «σε ποιο γράμμα είμαι»
 * αλλάζει **μία φορά ανά διάσχιση ορίου στήλης** — δηλαδή μερικές φορές ανά σύρσιμο χεριού.
 * Ένα άνευ όρων `markSystemsDirty` θα ξανάβαφε ολόκληρο τον καμβά σε **κάθε** κίνηση όσο ο
 * πίνακας είναι ανοιχτός. Γι' αυτό ο φύλακας ισότητας ζει **εδώ**, στον γραφέα, και όχι στον
 * καλούντα: ένας δεύτερος γραφέας αύριο δεν θα μπορεί να τον ξεχάσει.
 *
 * ⚠️ Η σύγκριση γίνεται **κατά ταυτότητα υποδιαίρεσης**, όχι κατά αναφορά αντικειμένου: το
 * `tableIndicatorHitAtFrame` παράγει **νέο** αντικείμενο σε κάθε κλήση, οπότε μια σύγκριση
 * αναφοράς θα δήλωνε «άλλαξε» σε κάθε pixel και ο φύλακας θα ήταν διακοσμητικός.
 *
 * ## Γιατί κουβαλά `entityId`
 * Δύο πίνακες μπορούν να ζουν στην ίδια σκηνή. Χωρίς την ταυτότητα της οντότητας, ένα
 * `colId` που τυχαίνει να συμπίπτει θα άναβε γράμμα σε **λάθος** πίνακα — ίδιος λόγος με τον
 * `entityId` του δρομέα κελιού.
 *
 * @module subapps/dxf-viewer/state/table-indicator-hover-store
 * @see bim/table/table-indicator-geometry.ts — ΠΟΙΑ υποδιαίρεση χτυπήθηκε (η ερώτηση)
 * @see ui/table-cell-editor/use-table-indicator-hover.ts — ο ΕΝΑΣ γραφέας
 * @see rendering/entities/TableRenderer.ts — ο ΕΝΑΣ αναγνώστης, τη στιγμή του καρέ
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §30
 */

import { createExternalStore } from '../stores/createExternalStore';
import { markSystemsDirty } from '../rendering/core/frame-scheduler-api';
import type { TableIndicatorHit } from '../bim/table/table-indicator-geometry';

/** Η υποδιαίρεση κάτω από τον δείκτη, μαζί με τον πίνακα στον οποίο ανήκει. */
export interface TableIndicatorHoverState {
  readonly entityId: string;
  readonly hit: TableIndicatorHit;
}

/**
 * Ο ζωγράφος του καμβά ξαναβάφει **μόνο** όταν του το ζητήσουν (ADR-040 / ADR-119). Ίδιο
 * σύστημα με τον δρομέα κελιού — ο δείκτης ζωγραφίζεται στο **ίδιο** overlay pass, ποτέ μέσα
 * στο cached raster της σκηνής (ADR-040 κανόνας #3).
 */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

const store = createExternalStore<TableIndicatorHoverState | null>(null);

/** Η ταυτότητα της υποδιαίρεσης, ανεξάρτητα από άξονα — η **μία** έκφραση της σύγκρισης. */
function tickIdOf(hit: TableIndicatorHit): string {
  return hit.axis === 'column' ? hit.colId : hit.rowId;
}

/** Ίδια υποδιαίρεση του ίδιου πίνακα; Δες την κεφαλίδα: κατά **ταυτότητα**, ποτέ κατά αναφορά. */
function sameHover(a: TableIndicatorHoverState | null, b: TableIndicatorHoverState | null): boolean {
  if (a === null || b === null) return a === b;
  return a.entityId === b.entityId && a.hit.axis === b.hit.axis && tickIdOf(a.hit) === tickIdOf(b.hit);
}

/** Καθαρή ανάγνωση — ο getter που καλεί ο `TableRenderer` τη στιγμή του καρέ. */
export function getTableIndicatorHover(): TableIndicatorHoverState | null {
  return store.get();
}

/**
 * Γράφει την υποδιαίρεση κάτω από το ποντίκι και ζητά **ένα** καρέ — αλλά **μόνο** αν κάτι
 * όντως άλλαξε. Δες την κεφαλίδα για το γιατί ο φύλακας ζει εδώ και όχι στον καλούντα.
 */
export function setTableIndicatorHover(next: TableIndicatorHoverState | null): void {
  if (sameHover(store.get(), next)) return;
  store.set(next);
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
}

/**
 * Καμία υποδιαίρεση κάτω από το ποντίκι. Ιδεμποτής — και γι' αυτό μπορεί να δοθεί απευθείας
 * ως ακροατής `mouseleave` χωρίς περιτύλιγμα που θα άλλαζε ταυτότητα σε κάθε απόδοση.
 */
export function clearTableIndicatorHover(): void {
  setTableIndicatorHover(null);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα αδελφά stores. */
export function __resetTableIndicatorHoverForTests(): void {
  store.reset(null);
}
