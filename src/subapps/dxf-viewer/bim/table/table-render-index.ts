/**
 * ADR-739 Φάση Γ — **ευρετήριο ορατότητας** πάνω σε ένα έτοιμο `TableLayout`.
 *
 * Δεν είναι δεύτερη μηχανή διάταξης (N.18): δεν υπολογίζει **καμία** γεωμετρία — απλώς
 * ταξινομεί ό,τι η μηχανή έβγαλε ήδη, ώστε ο ζωγράφος να ρωτά «τι φαίνεται;» σε
 * **O(log n + ορατά)** αντί για O(όλα) σε κάθε καρέ.
 *
 * ## Γιατί χρειάζεται ξεχωριστό ευρετήριο για τα περιγράμματα
 * Το `visibleRowRange` (Φ.Α) λύνει τις **γραμμές**, γιατί το `layout.rows` είναι αύξον σε
 * `yMm`. Τα `layout.borders` όμως είναι **μεικτά**: πρώτα οι οριζόντιες (αύξουσες κατά y)
 * και μετά οι κατακόρυφες — δηλαδή ο πίνακας **δεν** είναι ταξινομημένος συνολικά και η
 * δυαδική αναζήτηση πάνω του θα ήταν λάθος. Ο διαχωρισμός γίνεται **μία φορά** ανά
 * διάταξη και μετά κάθε καρέ είναι δυαδικό.
 *
 * Οι κατακόρυφες επιστρέφονται **πάντα ολόκληρες** και αυτό είναι σωστό, όχι παράλειψη:
 * το στάδιο περιγραμμάτων τις **συγχωνεύει** σε ένα τμήμα ανά στήλη για όλο το ύψος, άρα
 * είναι το πολύ `στήλες + 1` — μια κατακόρυφη που τέμνει το παράθυρο πρέπει να
 * ζωγραφιστεί ολόκληρη ούτως ή άλλως (η αποκοπή είναι δουλειά του καμβά).
 *
 * ## Γιατί WeakMap με κλειδί τη διάταξη
 * Το `TableLayout` παράγεται απομνημονευμένο (`resolveTableLayout`) — ίδιο μοντέλο+στυλ ⇒
 * ίδια αναφορά. Άρα η ταυτότητά του **είναι** η έκδοση, όπως και στη διάταξη: μηδέν
 * χειροκίνητο `invalidate()` που κάποιος θα ξεχνούσε.
 *
 * @module subapps/dxf-viewer/bim/table/table-render-index
 * @see bim/table/table-layout.ts — `visibleRowRange` (το αντίστοιχο για τις γραμμές)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §6
 */

import type { TableBorderSegment, TableCellLayout, TableLayout } from './table-layout-types';

export interface TableRenderIndex {
  /** Οριζόντια τμήματα, **αύξοντα** κατά `y` — δυαδικά αναζητήσιμα. */
  readonly horizontals: readonly TableBorderSegment[];
  /** Κατακόρυφα τμήματα (ένα ανά στήλη, όλο το ύψος). */
  readonly verticals: readonly TableBorderSegment[];
  /** Κελιά ομαδοποιημένα κατά ταυτότητα γραμμής — O(1) από το εύρος ορατών γραμμών. */
  readonly cellsByRowId: ReadonlyMap<string, readonly TableCellLayout[]>;
  /**
   * 🔴 ADR-739 §37 — το πάχος του **παχύτερου ορατού** μολυβιού πάνω στην **περίμετρο**, σε
   * sheet-mm· `0` όταν καμία εξωτερική ακμή δεν ζωγραφίζεται.
   *
   * Το καταναλώνει ο δείκτης λειτουργίας, που πρέπει να καθίσει **έξω** από αυτό το μολύβι
   * ({@link tableModeOutlineOffsetPx}). Ζει εδώ και όχι στον ζωγράφο για δύο λόγους:
   *
   *  1. **Κόστος μηδέν.** Το ευρετήριο χτίζεται το πολύ **μία φορά ανά διάταξη** (WeakMap),
   *     και η μέτρηση χωρά στο πέρασμα που ήδη γίνεται — καμία δεύτερη σάρωση ανά καρέ.
   *     Ένας πίνακας 500 γραμμών θα πλήρωνε αλλιώς 500 συγκρίσεις × καρέ για μία απάντηση
   *     που δεν αλλάζει· ακριβώς το σχήμα που ο ADR-735 πλήρωσε σε παραγωγή.
   *  2. **Μόνο τα ορατά μετράνε.** Ένα αόρατο μολύβι δεν βάφει τίποτα, άρα δεν υπάρχει
   *     τίποτα να αποφύγει ο δείκτης. Ο έλεγχος `spec.visible` είναι ο **ίδιος** που κάνει
   *     ο ζωγράφος — μία ερώτηση, μία απάντηση.
   */
  readonly perimeterMaxWidthMm: number;
}

/**
 * Ανοχή ταύτισης με τις ακμές της διάταξης, σε **sheet-mm**.
 *
 * Οι συντεταγμένες της περιμέτρου γεννιούνται από αθροίσεις πλατών/υψών, οπότε μια ωμή
 * σύγκριση `=== widthMm` μπορεί να αστοχήσει σε ένα ulp — και η αστοχία θα ήταν **σιωπηλή
 * και επικίνδυνη**: ο δείκτης θα υπολόγιζε «καμία περίμετρος» και θα ξανακάθονταν πάνω στη
 * γραμμή. Ένα νανόμετρο είναι ασύγκριτα μικρότερο από κάθε εσωτερικό όριο που μπορεί να
 * υπάρξει, άρα δεν μπορεί να μπερδέψει εσωτερική γραμμή με ακμή.
 */
const PERIMETER_EPSILON_MM = 1e-6;

function isOnEdge(value: number, extent: number): boolean {
  return Math.abs(value) <= PERIMETER_EPSILON_MM || Math.abs(value - extent) <= PERIMETER_EPSILON_MM;
}

const INDEX_CACHE = new WeakMap<TableLayout, TableRenderIndex>();

/** Το ευρετήριο μιας διάταξης — χτίζεται **το πολύ μία φορά** ανά διάταξη. */
export function tableRenderIndex(layout: TableLayout): TableRenderIndex {
  const cached = INDEX_CACHE.get(layout);
  if (cached) return cached;

  const horizontals: TableBorderSegment[] = [];
  const verticals: TableBorderSegment[] = [];
  let perimeterMaxWidthMm = 0;
  for (const segment of layout.borders) {
    const horizontal = segment.a.y === segment.b.y;
    if (horizontal) horizontals.push(segment);
    else verticals.push(segment);
    // ADR-739 §37 — η μέτρηση της περιμέτρου χωρά στο πέρασμα που ήδη γίνεται. Οριζόντια
    // ακμή = πάνω/κάτω πλευρά· κατακόρυφη = αριστερή/δεξιά.
    if (!segment.spec.visible) continue;
    const onPerimeter = horizontal
      ? isOnEdge(segment.a.y, layout.heightMm)
      : isOnEdge(segment.a.x, layout.widthMm);
    if (onPerimeter && segment.spec.widthMm > perimeterMaxWidthMm) {
      perimeterMaxWidthMm = segment.spec.widthMm;
    }
  }
  // Το στάδιο περιγραμμάτων τα εκπέμπει ήδη αύξοντα, αλλά η ταξινόμηση εδώ κάνει το
  // συμβόλαιο **τοπικό**: η δυαδική αναζήτηση παρακάτω δεν εξαρτάται από τη σειρά
  // εκπομπής ενός άλλου αρχείου (που μπορεί να αλλάξει χωρίς να το προσέξει κανείς).
  horizontals.sort((p, q) => p.a.y - q.a.y);

  const cellsByRowId = new Map<string, TableCellLayout[]>();
  for (const cell of layout.cells) {
    const bucket = cellsByRowId.get(cell.rowId);
    if (bucket) bucket.push(cell);
    else cellsByRowId.set(cell.rowId, [cell]);
  }

  const index: TableRenderIndex = { horizontals, verticals, cellsByRowId, perimeterMaxWidthMm };
  INDEX_CACHE.set(layout, index);
  return index;
}

/** Πρώτος δείκτης με `y >= value` (δυαδικά). */
function lowerBound(segments: readonly TableBorderSegment[], value: number): number {
  let lo = 0;
  let hi = segments.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].a.y < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Οι οριζόντιες γραμμές μέσα στο κατακόρυφο παράθυρο `[topMm, bottomMm]`, **κλειστό** και
 * στα δύο άκρα: μια γραμμή ακριβώς πάνω στην ακμή του παραθύρου είναι ορατή — αν την
 * κόβαμε, ο πίνακας θα φαινόταν χωρίς πάνω ή κάτω ακμή στο όριο της κύλισης.
 */
export function visibleHorizontals(
  index: TableRenderIndex,
  topMm: number,
  bottomMm: number,
): readonly TableBorderSegment[] {
  if (bottomMm < topMm) return [];
  const start = lowerBound(index.horizontals, topMm);
  let end = start;
  while (end < index.horizontals.length && index.horizontals[end].a.y <= bottomMm) end++;
  return index.horizontals.slice(start, end);
}
