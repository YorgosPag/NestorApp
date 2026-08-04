'use client';

/**
 * 🔴 ADR-754 **Γ4** — **ΠΟΙΑ ΚΕΛΙΑ ΘΑ ΓΕΜΙΣΟΥΝ ΑΝ ΑΦΗΣΩ ΤΩΡΑ ΤΗ ΛΑΒΗ.**
 *
 * Η προεπισκόπηση της συμπλήρωσης, όσο ζει η σύρση. Ίδιο σχήμα με το
 * `table-range-transfer-store.ts` και για τους **ίδιους** δύο λόγους:
 *
 *  - **Ο μόνος αναγνώστης είναι ο καμβάς** (`TableRenderer`), που δεν διαβάζει React state, και
 *    ο μόνος γραφέας είναι ακροατής `mousemove` έξω από τον κύκλο του React. Ένα `useState` θα
 *    σήμαινε απόδοση React **ανά κίνηση ποντικιού** — η κατηγορία που ο ADR-040 απαγορεύει
 *    ονομαστικά.
 *  - **Το καρέ ζητιέται ΜΟΝΟ όταν αλλάζει η απάντηση.** Ο φύλακας ζει **στον γραφέα**, ώστε
 *    ένας δεύτερος καλών να μην μπορεί να τον παρακάμψει (ADR-735).
 *
 * ## 🔴 Γιατί κρατιέται η **ένωση** και όχι το γέμισμα μόνο
 * Ο ζωγράφος δείχνει ένα ορθογώνιο γύρω από **πηγή + γέμισμα** — έτσι ο χρήστης βλέπει τι
 * επαναλαμβάνεται και πού καταλήγει, με μία γραμμή. Η ένωση υπολογίζεται **μία φορά** στον
 * γραφέα (`tableFillPreviewBounds`) και ταξιδεύει έτοιμη· δύο δρόμοι προς το ίδιο ορθογώνιο
 * θα μπορούσαν να αποκλίνουν μέσα στην ίδια σύρση.
 *
 * ## Γιατί κουβαλά `entityId`
 * Δύο πίνακες μπορούν να ζουν στην ίδια σκηνή· χωρίς την ταυτότητα, η προεπισκόπηση θα
 * ζωγραφιζόταν και στους δύο. Ίδιος λόγος με τον δρομέα κελιού και με το φάντασμα μεταφοράς.
 *
 * @module subapps/dxf-viewer/state/table-fill-preview-store
 * @see ui/table-cell-editor/table-fill-handle-drag.ts — ο ΕΝΑΣ γραφέας
 * @see rendering/entities/table/stamp-table-fill-handle.ts — ο ΕΝΑΣ ζωγράφος
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §13
 */

import { createExternalStore } from '../stores/createExternalStore';
import { markSystemsDirty } from '../rendering/core/frame-scheduler-api';
import type { TableCellRangeBounds } from '../bim/table/table-cell-range';

/** Η ζωντανή υπόσχεση της λαβής: ποιος πίνακας, και ποιο ορθογώνιο θα ισχύει στο τέλος. */
export interface TableFillPreview {
  readonly entityId: string;
  /** Η **ένωση** πηγής και γεμίσματος — δες την κεφαλίδα. */
  readonly bounds: TableCellRangeBounds;
}

/** Ο ζωγράφος ξαναβάφει **μόνο** όταν του το ζητήσουν (ADR-040 / ADR-119). */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

const store = createExternalStore<TableFillPreview | null>(null);

/** Ίδια υπόσχεση; **Ποτέ** κατά αναφορά — κάθε κίνηση φτιάχνει νέο αντικείμενο ορίων. */
function samePreview(a: TableFillPreview | null, b: TableFillPreview | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.entityId === b.entityId &&
    a.bounds.firstRow === b.bounds.firstRow &&
    a.bounds.lastRow === b.bounds.lastRow &&
    a.bounds.firstCol === b.bounds.firstCol &&
    a.bounds.lastCol === b.bounds.lastCol
  );
}

/** Καθαρή ανάγνωση — ο getter που καλεί ο `TableRenderer` τη στιγμή του καρέ. */
export function getTableFillPreview(): TableFillPreview | null {
  return store.get();
}

/** Γράφει την υπόσχεση και ζητά **ένα** καρέ — μόνο αν κάτι όντως άλλαξε. */
export function setTableFillPreview(next: TableFillPreview | null): void {
  if (samePreview(store.get(), next)) return;
  store.set(next);
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
}

/**
 * Καμία σύρση σε εξέλιξη. Ιδεμποτής — καλείται και από την **αποπροσάρτηση** της συνεδρίας,
 * όπου η χειρονομία μπορεί να έκλεισε με το κουμπί ακόμα κάτω.
 */
export function clearTableFillPreview(): void {
  setTableFillPreview(null);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα αδελφά stores. */
export function __resetTableFillPreviewForTests(): void {
  store.reset(null);
}
