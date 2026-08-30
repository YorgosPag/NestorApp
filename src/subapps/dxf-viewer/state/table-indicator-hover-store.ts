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
import type { TableWorksheetId } from '../types/table-worksheet';

/**
 * 🔴 ADR-739 §43 — **ΠΟΙΟ ΚΟΜΜΑΤΙ ΤΟΥ ΔΕΙΚΤΗ** είναι κάτω από το ποντίκι.
 *
 * ## Γιατί το πεδίο έπαψε να είναι σκέτο `TableIndicatorHit`
 * Μέχρι το §43 ο δείκτης είχε **μόνο** υποδιαιρέσεις άξονα, οπότε «ποιο κομμάτι;» και «ποια
 * υποδιαίρεση;» ήταν η ίδια ερώτηση. Με το κουμπί της γωνίας δεν είναι πια: η γωνία φωτίζεται
 * με τον **ίδιο** κανόνα hover (§30) αλλά **δεν είναι άξονας** — δες την κεφαλίδα του
 * `table-select-all-corner` για το τι κοστίζει ένα `{ axis: 'corner' }`.
 *
 * 🔑 **Και γιατί ΔΕΝ έγινε πέμπτο store.** Τα τέσσερα αδέλφια (`insert`, `delete`, hover,
 * δείκτης ΟΣ) έχουν ήδη ταυτόσημο σκελετό — ένα πέμπτο με φορτίο **μόνο** ένα `entityId` θα
 * ήταν sibling clone που το CHECK 3.28 (jscpd, N.18) πιάνει, και θα ήταν και **λάθος τοποθεσία**:
 * η γωνία δεν είναι νέο χειριστήριο με δικό του κύκλο ζωής, είναι το τρίτο κομμάτι του **ίδιου**
 * δείκτη. Ένα πεδίο που διαβάζουν οι ίδιοι δύο, στο ίδιο καρέ.
 */
export type TableIndicatorHoverTarget =
  /** Ένα γράμμα στήλης ή ένας αριθμός γραμμής (§30). */
  | { readonly kind: 'tick'; readonly hit: TableIndicatorHit }
  /** Το τετραγωνάκι της συμβολής — το κουμπί «επιλογή όλων» (§43). */
  | { readonly kind: 'select-all' }
  /**
   * 🔴 ADR-833 Φάση 3 — **μια καρτέλα φύλλου**, στη λωρίδα κάτω από τον πίνακα.
   *
   * Τέταρτο κομμάτι του **ίδιου** δείκτη, με το **ίδιο** σκεπτικό που κράτησε τη γωνία εδώ
   * αντί για πέμπτο store (δες παραπάνω): ο σκελετός θα ήταν ταυτόσημος (`entityId` + φορτίο),
   * δηλαδή sibling clone που πιάνει το CHECK 3.28 — και θα ήταν και λάθος τοποθεσία, γιατί
   * ο δείκτης φωτίζει **ένα** πράγμα κάθε στιγμή και αυτό είναι ήδη το νόημα του ενός πεδίου.
   *
   * ⚠️ Κουβαλά **ταυτότητα φύλλου**, όχι θέση στη λωρίδα: η λωρίδα κυλά (παράγωγο παράθυρο
   * υπερχείλισης), άρα η θέση δεν είναι σταθερή ανάμεσα σε δύο καρέ — ενώ το φύλλο είναι.
   */
  | { readonly kind: 'worksheet-tab'; readonly worksheetId: TableWorksheetId }
  /**
   * 🔴 ADR-833 Φάση 4 — **το ⊕ της προσθήκης φύλλου**, στο τέλος της ίδιας λωρίδας.
   *
   * **Χωρίς φορτίο**, όπως η γωνία «επιλογή όλων» και για τον ίδιο ακριβώς λόγο: το ⊕ είναι
   * **ένα** ανά πίνακα και δεν έχει ούτε ταυτότητα (ποιο;) ούτε φάση (πατιέται;) — το `entityId`
   * του καλούντος αρκεί για να ξεχωρίσει δύο πίνακες στην ίδια σκηνή. Ένα πεδίο εδώ θα ήταν
   * σχήμα που υπόσχεται διακρίσεις οι οποίες δεν υπάρχουν.
   */
  | { readonly kind: 'worksheet-add' };

/** Το κομμάτι του δείκτη κάτω από το ποντίκι, μαζί με τον πίνακα στον οποίο ανήκει. */
export interface TableIndicatorHoverState {
  readonly entityId: string;
  readonly target: TableIndicatorHoverTarget;
}

/**
 * Ο ζωγράφος του καμβά ξαναβάφει **μόνο** όταν του το ζητήσουν (ADR-040 / ADR-119). Ίδιο
 * σύστημα με τον δρομέα κελιού — ο δείκτης ζωγραφίζεται στο **ίδιο** overlay pass, ποτέ μέσα
 * στο cached raster της σκηνής (ADR-040 κανόνας #3).
 */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

const store = createExternalStore<TableIndicatorHoverState | null>(null);

/**
 * Η ταυτότητα του κομματιού, ανεξάρτητα από είδος — η **μία** έκφραση της σύγκρισης.
 *
 * Η γωνία είναι **μία** ανά πίνακα, άρα σταθερή ταυτότητα: το `entityId` του καλούντος αρκεί
 * για να ξεχωρίσει δύο πίνακες στην ίδια σκηνή. Το πρόθεμα κρατά το χώρο ονομάτων ξένο προς
 * κάθε `colId`/`rowId` που θα μπορούσε να λέγεται τυχαία το ίδιο.
 */
function targetIdOf(target: TableIndicatorHoverTarget): string {
  if (target.kind === 'select-all') return 'select-all';
  // ADR-833 Φ3 — πρόθεμα, για τον ίδιο λόγο με τα `col:`/`row:`: ένα `ws0` δεν επιτρέπεται να
  // συγκριθεί ίσο με στήλη που τυχαίνει να λέγεται το ίδιο.
  if (target.kind === 'worksheet-tab') return `ws:${target.worksheetId}`;
  // ADR-833 Φ4 — σταθερή ταυτότητα, όπως το `select-all`: το ⊕ είναι ένα ανά πίνακα.
  if (target.kind === 'worksheet-add') return 'ws-add';
  return target.hit.axis === 'column' ? `col:${target.hit.colId}` : `row:${target.hit.rowId}`;
}

/** Ίδιο κομμάτι του ίδιου πίνακα; Δες την κεφαλίδα: κατά **ταυτότητα**, ποτέ κατά αναφορά. */
function sameHover(a: TableIndicatorHoverState | null, b: TableIndicatorHoverState | null): boolean {
  if (a === null || b === null) return a === b;
  return a.entityId === b.entityId && targetIdOf(a.target) === targetIdOf(b.target);
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
