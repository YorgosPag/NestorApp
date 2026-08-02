/**
 * 🔴 ADR-739 §26.5 — **ΤΟ «ΚΟΥΜΠΩΜΑ» ΣΤΙΣ ΣΥΓΧΩΝΕΥΣΕΙΣ**: πώς μεγαλώνει ένα ορθογώνιο ώστε
 * να περικλείει **ολόκληρες** τις συγχωνεύσεις που αγγίζει. Καθαρή άλγεβρα ορθογωνίων.
 *
 * ## Γιατί βγήκε από το `table-cell-range.ts` (§27.16)
 * Δύο λόγοι, και ο δεύτερος είναι ο ουσιώδης:
 *
 * 1. **Μέγεθος** (N.7.1): το `table-cell-range.ts` έφτασε **495/500** γραμμές. Στα 500
 *    μπλοκάρει το pre-commit — δηλαδή ο επόμενος που θέλει να προσθέσει έξι γραμμές
 *    τεκμηρίωσης βρίσκει κλειστή πόρτα και κάνει βιαστικό διαχωρισμό στη χειρότερη στιγμή.
 *    Ίδιο μοτίβο με το `jobs-access.ts` (497/500) που το ADR-748 σημείωσε ως **εξαγωγή**.
 * 2. **Δύο ερωτήσεις, όχι μία.** Το `table-cell-range.ts` απαντά «**τι διάλεξε** ο χρήστης
 *    και **ποια κελιά** είναι μέσα». Εδώ ζει μια εντελώς διαφορετική: «δοθέντος ενός
 *    ορθογωνίου και ενός συνόλου συγχωνεύσεων, **ποιο είναι το μικρότερο ορθογώνιο** που
 *    δεν κόβει καμία στη μέση;». Η δεύτερη δεν ξέρει τίποτα για επιλογή, δρομέα ή είδος.
 *
 * ## 🔴 Ο ΕΝΑΣ ΔΡΟΜΟΣ ΔΕΝ ΕΣΠΑΣΕ
 * Η **απόφαση** «κουμπώνει η *περιοχή*, όχι ο *άξονας*» (§27.15) μένει ακέραιη στο
 * `resolveTableSelectionBounds` — εκεί όπου ζει η **πρόθεση**. Εδώ μετακόμισε μόνο ο
 * **μηχανισμός**, που δεν παίρνει καμία απόφαση: τον καλείς ή δεν τον καλείς.
 *
 * ⚠️ Καμία **δεύτερη** λογική συγχωνεύσεων δεν γεννιέται: το ορθογώνιο κάθε span το δίνει
 * το ίδιο `model.merges` που διαβάζει το `buildMergeIndex`, με την ίδια περικοπή στα όρια
 * του πλέγματος και την ίδια ανοχή σε άκυρα spans.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-merge-snap
 * @see bim/table/table-cell-range.ts — ΠΟΙΟΣ το καλεί, και **πότε** (μόνο για `'range'`)
 * @see bim/table/table-model-helpers.ts — `buildMergeIndex`, η ΜΙΑ γνώση συγχωνεύσεων
 */

import type { TableModel } from '../../types/table';
import { indexById } from './table-model-helpers';

/**
 * Ορθογώνιο σε **δείκτες** του μοντέλου, **κλειστό** διάστημα και στα δύο άκρα.
 *
 * Ο ορισμός ζει εδώ (και όχι στο `table-cell-range.ts`) γιατί εδώ ζει η άλγεβρα που τον
 * χειρίζεται· το `table-cell-range.ts` τον **επανεξάγει** ως `TableCellRangeBounds`, ώστε
 * κανένας υπάρχων καταναλωτής να μη χρειαστεί να αλλάξει import.
 */
export interface TableRectBounds {
  readonly firstRow: number;
  readonly lastRow: number;
  readonly firstCol: number;
  readonly lastCol: number;
}

/** Το ορθογώνιο που καταλαμβάνει μια συγχώνευση, σε δείκτες — ή `null` αν είναι άκυρη. */
function mergeBoundsOf(
  model: TableModel,
  rowIndex: ReadonlyMap<string, number>,
  colIndex: ReadonlyMap<string, number>,
  span: { anchorRowId: string; anchorColId: string; rowSpan: number; colSpan: number },
): TableRectBounds | null {
  const r0 = rowIndex.get(span.anchorRowId);
  const c0 = colIndex.get(span.anchorColId);
  if (r0 === undefined || c0 === undefined) return null;
  if (span.rowSpan < 1 || span.colSpan < 1) return null;
  return {
    firstRow: r0,
    lastRow: Math.min(r0 + span.rowSpan, model.rows.length) - 1,
    firstCol: c0,
    lastCol: Math.min(c0 + span.colSpan, model.columns.length) - 1,
  };
}

/** Τέμνονται δύο ορθογώνια (κλειστά διαστήματα); */
function intersects(a: TableRectBounds, b: TableRectBounds): boolean {
  return (
    a.firstRow <= b.lastRow &&
    b.firstRow <= a.lastRow &&
    a.firstCol <= b.lastCol &&
    b.firstCol <= a.lastCol
  );
}

/** Το μικρότερο ορθογώνιο που περιέχει και τα δύο. */
function union(a: TableRectBounds, b: TableRectBounds): TableRectBounds {
  return {
    firstRow: Math.min(a.firstRow, b.firstRow),
    lastRow: Math.max(a.lastRow, b.lastRow),
    firstCol: Math.min(a.firstCol, b.firstCol),
    lastCol: Math.max(a.lastCol, b.lastCol),
  };
}

function sameBounds(a: TableRectBounds, b: TableRectBounds): boolean {
  return (
    a.firstRow === b.firstRow &&
    a.lastRow === b.lastRow &&
    a.firstCol === b.firstCol &&
    a.lastCol === b.lastCol
  );
}

/**
 * 🔴 **Το κούμπωμα** — ο κανόνας που κάνει την επιλογή να έχει νόημα.
 *
 * Μια ορθογώνια περιοχή που **κόβει** μια συγχώνευση στη μέση είναι ανερμήνευτη: το
 * περιεχόμενο ζει στην άγκυρα, οπότε «τα μισά ενός κελιού» δεν αντιγράφονται, δεν
 * σβήνονται και δεν γεμίζουν. Το Excel μεγαλώνει την επιλογή ώστε να **περικλείει
 * ολόκληρες** τις συγχωνεύσεις που αγγίζει (επιβεβαιώθηκε: επιλογή της γραμμής 5 σε φύλλο
 * με συγχώνευση `A1:A10` γίνεται `1:10`).
 *
 * ⚠️ **Ισχύει για ΠΕΡΙΟΧΗ, όχι για ΑΞΟΝΑ** (§27.15). Ποιος από τους δύο είναι, το ξέρει
 * **μόνο** ο καλών — γι' αυτό η απόφαση μένει εκεί και **δεν** μπαίνει εδώ. Αν έμπαινε,
 * αυτή η συνάρτηση θα χρειαζόταν να μάθει τι είναι «είδος επιλογής», δηλαδή θα ξαναγεννιόταν
 * το ίδιο σφάλμα που το §27.15 έλυσε: ένας μηχανισμός που αποφασίζει μόνος του.
 *
 * Ο βρόχος **τερματίζει πάντα**: κάθε επανάληψη ή μεγαλώνει γνήσια το ορθογώνιο (και το
 * ορθογώνιο είναι φραγμένο από το πλέγμα) ή σταματά. Χειρότερη περίπτωση: όσες οι
 * συγχωνεύσεις.
 */
export function snapToWholeMerges(model: TableModel, start: TableRectBounds): TableRectBounds {
  if (model.merges.length === 0) return start;
  const rowIndex = indexById(model.rows);
  const colIndex = indexById(model.columns);

  let bounds = start;
  for (;;) {
    let grown = bounds;
    for (const span of model.merges) {
      const spanBounds = mergeBoundsOf(model, rowIndex, colIndex, span);
      if (spanBounds && intersects(grown, spanBounds)) grown = union(grown, spanBounds);
    }
    if (sameBounds(grown, bounds)) return bounds;
    bounds = grown;
  }
}
