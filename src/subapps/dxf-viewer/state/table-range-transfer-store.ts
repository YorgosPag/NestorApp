'use client';

/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 3) — **ΠΟΥ ΘΑ ΠΡΟΣΓΕΙΩΘΕΙ Η ΠΕΡΙΟΧΗ ΑΝ ΤΗΝ ΑΦΗΣΩ ΤΩΡΑ.**
 *
 * Η προεπισκόπηση της μεταφοράς, όσο ζει η σύρση. Ίδιο σχήμα με το
 * `table-indicator-hover-store` και για τους **ίδιους** δύο λόγους, που εδώ είναι ακόμη πιο
 * δεσμευτικοί:
 *
 *  - **Ο μόνος αναγνώστης είναι ο καμβάς** (`TableRenderer`), που δεν διαβάζει React state, και
 *    ο μόνος γραφέας είναι ακροατής `mousemove` έξω από τον κύκλο του React. Ένα `useState` θα
 *    σήμαινε απόδοση React **ανά κίνηση ποντικιού** — η κατηγορία που ο ADR-040 απαγορεύει
 *    ονομαστικά.
 *  - **Το καρέ ζητιέται ΜΟΝΟ όταν αλλάζει η απάντηση.** Η σύρση παράγει 60-120 συμβάντα το
 *    δευτερόλεπτο ενώ ο προορισμός αλλάζει μερικές φορές· ένα άνευ όρων `markSystemsDirty` θα
 *    ξανάβαφε ολόκληρη τη σκηνή σε κάθε pixel — ακριβώς το σχήμα που ο **ADR-735** πλήρωσε σε
 *    παραγωγή. Ο φύλακας ζει **στον γραφέα**, ώστε ένας δεύτερος καλών να μην μπορεί να τον
 *    παρακάμψει.
 *
 * ## 🔴 ΓΙΑΤΙ ΤΟ ΚΡΑΤΟΥΜΕΝΟ ΕΙΝΑΙ **ΟΡΙΑ ΚΕΛΙΩΝ** ΚΑΙ ΟΧΙ ΟΡΘΟΓΩΝΙΟ ΣΕ mm
 * Ο πειρασμός είναι να αποθηκευτεί έτοιμο `TableRectMm` — ο ζωγράφος θα το ζωγράφιζε αμέσως.
 * Θα ήταν **δεύτερη γεωμετρία**: το ορθογώνιο της επιλογής παράγεται ήδη από τη διάταξη μέσω
 * του `tableRangeRectMm` (`TableRenderer.selectionOf`), και δύο δρόμοι προς το ίδιο ορθογώνιο
 * μπορούν να αποκλίνουν την πρώτη φορά που θα αλλάξει πλάτος στήλης **μέσα** στη σύρση. Εδώ
 * ταξιδεύει η **απάντηση** (ποια κελιά), και ο ζωγράφος τη μεταφράζει με τον ΕΝΑ δρόμο.
 *
 * ## Γιατί κουβαλά `entityId`
 * Δύο πίνακες μπορούν να ζουν στην ίδια σκηνή· χωρίς την ταυτότητα, το φάντασμα θα
 * ζωγραφιζόταν και στους δύο. Ίδιος λόγος με τον δρομέα κελιού και με το hover των λωρίδων.
 *
 * @module subapps/dxf-viewer/state/table-range-transfer-store
 * @see ui/table-cell-editor/table-range-transfer-drag.ts — ο ΕΝΑΣ γραφέας
 * @see rendering/entities/table/stamp-table-range-ghost.ts — ο ΕΝΑΣ ζωγράφος
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import { createExternalStore } from '../stores/createExternalStore';
import { markSystemsDirty } from '../rendering/core/frame-scheduler-api';
import type { TableCellRangeBounds } from '../bim/table/table-cell-range';
import type { TableRangeShiftAxis } from '../bim/table/table-range-axis-view';

/** Η ζωντανή υπόσχεση της σύρσης: πού, με ποια μορφή, και αν το σχέδιο λέει «ναι». */
export interface TableRangeTransferPreview {
  readonly entityId: string;
  /**
   * 🔴 Τα κελιά όπου προσγειώνεται η περιοχή — **πάντα** το `plan.destination`, ποτέ αφελής
   * μετατόπιση: με `Shift`, όταν κλείνει η τρύπα της πηγής, η περιοχή κάθεται **ψηλότερα**
   * (§36.5). Το φάντασμα που ζωγραφίζει το ενδιάμεσο θα υποσχόταν μια θέση και το drop θα
   * παρέδιδε άλλη.
   *
   * `null` όταν η θέση **δεν είναι σχεδιάσιμη**: το χέρι βγήκε από το πλέγμα, οπότε δεν
   * υπάρχουν γραμμές/στήλες πάνω στις οποίες να χαραχτεί ορθογώνιο. Η άρνηση παραμένει
   * ορατή — από τον **δείκτη** (`not-allowed`), που δεν χρειάζεται γεωμετρία.
   */
  readonly destination: TableCellRangeBounds | null;
  /** Ο άξονας της **γραμμής-Ι**· `null` χωρίς `Shift` (καμία εισαγωγή, κανένα σύνορο). */
  readonly insertAxis: TableRangeShiftAxis | null;
  /** Το σχέδιο απάντησε «όχι». Το φάντασμα το λέει με **χρώμα**, ο δείκτης με `not-allowed`. */
  readonly refused: boolean;
}

/**
 * Ο ζωγράφος ξαναβάφει **μόνο** όταν του το ζητήσουν (ADR-040 / ADR-119). Το φάντασμα ζει στο
 * ίδιο overlay pass με τον δρομέα κελιού, ποτέ μέσα στο cached raster (ADR-040 κανόνας #3).
 */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

const store = createExternalStore<TableRangeTransferPreview | null>(null);

/** Ίδιο ορθογώνιο ορίων; Σύγκριση **κατά τιμή** — τα όρια παράγονται νέα σε κάθε καρέ. */
function sameBounds(a: TableCellRangeBounds | null, b: TableCellRangeBounds | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.firstRow === b.firstRow &&
    a.lastRow === b.lastRow &&
    a.firstCol === b.firstCol &&
    a.lastCol === b.lastCol
  );
}

/** Ίδια υπόσχεση; Δες την κεφαλίδα: **ποτέ** κατά αναφορά — κάθε κίνηση φτιάχνει νέο σχέδιο. */
function samePreview(a: TableRangeTransferPreview | null, b: TableRangeTransferPreview | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.entityId === b.entityId &&
    a.refused === b.refused &&
    a.insertAxis === b.insertAxis &&
    sameBounds(a.destination, b.destination)
  );
}

/** Καθαρή ανάγνωση — ο getter που καλεί ο `TableRenderer` τη στιγμή του καρέ. */
export function getTableRangeTransferPreview(): TableRangeTransferPreview | null {
  return store.get();
}

/** Γράφει την υπόσχεση και ζητά **ένα** καρέ — μόνο αν κάτι όντως άλλαξε. */
export function setTableRangeTransferPreview(next: TableRangeTransferPreview | null): void {
  if (samePreview(store.get(), next)) return;
  store.set(next);
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
}

/**
 * Καμία σύρση σε εξέλιξη. Ιδεμποτής — καλείται και από την **αποπροσάρτηση** της συνεδρίας,
 * όπου η χειρονομία μπορεί να έκλεισε με το κουμπί ακόμα κάτω.
 */
export function clearTableRangeTransferPreview(): void {
  setTableRangeTransferPreview(null);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα αδελφά stores. */
export function __resetTableRangeTransferPreviewForTests(): void {
  store.reset(null);
}
