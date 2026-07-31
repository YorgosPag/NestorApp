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
}

const INDEX_CACHE = new WeakMap<TableLayout, TableRenderIndex>();

/** Το ευρετήριο μιας διάταξης — χτίζεται **το πολύ μία φορά** ανά διάταξη. */
export function tableRenderIndex(layout: TableLayout): TableRenderIndex {
  const cached = INDEX_CACHE.get(layout);
  if (cached) return cached;

  const horizontals: TableBorderSegment[] = [];
  const verticals: TableBorderSegment[] = [];
  for (const segment of layout.borders) {
    if (segment.a.y === segment.b.y) horizontals.push(segment);
    else verticals.push(segment);
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

  const index: TableRenderIndex = { horizontals, verticals, cellsByRowId };
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
