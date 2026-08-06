/**
 * 🔴 ADR-764 — **τα εύρη συρρικνώνονται όταν σβήνεται γραμμή/στήλη**, όπως στο Excel.
 * Καθαρή συνάρτηση: μηδέν React, μηδέν DOM, μηδέν store.
 *
 * ## Ο κανόνας των μεγάλων, σε μία πρόταση — μετρημένος, όχι από μνήμη
 * Excel, Google Sheets και HyperFormula συμφωνούν απόλυτα:
 *
 * > **Το εύρος δηλώνει ΠΕΡΙΟΧΗ και επιβιώνει συρρικνούμενο.
 * > Η άμεση αναφορά δηλώνει ΚΕΛΙ και πεθαίνει σε `#REF!`.**
 *
 * `=SUM(A1:A4)` με σβησμένη τη γραμμή 4 γίνεται `=SUM(A1:A3)` — **όχι** `#REF!`. Σε πίνακα
 * ποσοτήτων η εναλλακτική είναι απαράδεκτη: ο μηχανικός σβήνει την τελευταία γραμμή άρθρου
 * και **χάνει το σύνολο**.
 *
 * ## Πόσο λίγο κάνει αυτό το αρχείο — και γιατί αυτό είναι το ζητούμενο
 * Επειδή οι αναφορές μας είναι δεμένες σε **ταυτότητες** και όχι σε θέσεις (ADR-739 §9), τα
 * τρία από τα τέσσερα σενάρια είναι **ήδη σωστά χωρίς καμία γραμμή**:
 *
 * | σενάριο | ποιος το λύνει |
 * |---|---|
 * | σβήνεται κελί **εσωτερικό** του εύρους | οι ταυτότητες — το `expandRangeShape` ανοίγει το εύρος πάνω στο **ζωντανό** πλέγμα |
 * | σβήνεται το κελί μιας **άμεσης** αναφοράς | ο αναγνώστης (`readCellRefValue`) απαντά `#REF!` |
 * | σβήνεται **ολόκληρο** το εύρος | ίδιο — κανένα άκρο δεν έχει επιζώντα γείτονα, ο αναγνώστης λέει `#REF!` |
 * | **σβήνεται ΑΚΡΟ του εύρους** | 🔴 **μόνο αυτό** — η θέση του γείτονα χάνεται με τη διαγραφή |
 *
 * Ένα θεσιακό μοντέλο (Excel) υποχρεώνεται να ξαναγράψει **κάθε** αναφορά κάτω από τη σβησμένη
 * γραμμή. Εδώ αγγίζεται τυπικά **ένα δέντρο ή κανένα**.
 *
 * ## 🔑 ΓΙΑΤΙ ΤΡΕΧΕΙ **ΠΡΙΝ** ΤΗΝ ΑΦΑΙΡΕΣΗ
 * Ο επιζών γείτονας είναι γνώσιμος **μόνο όσο η σβησμένη ταυτότητα βρίσκεται ακόμη στη σειρά**.
 * Μετά την αφαίρεση, το «ποιος ήταν δίπλα της» **έχει χαθεί οριστικά** και καμία μεταγενέστερη
 * θεραπεία δεν μπορεί να το ανασυνθέσει. Ίδια αρχή με το `rebuildTableEdgesOnDelete`, που
 * δέχεται ρητά τον κληρονόμο ως όρισμα αντί να τον ψάξει μετά.
 *
 * ## Τι ΔΕΝ κάνει — και είναι απόφαση, όχι παράλειψη
 * **Δεν** ξαναγράφει την άμεση αναφορά σε κόμβο `#REF!`, όπως κάνει το Excel. Η ταυτότητα
 * μένει στο δέντρο και το `#REF!` **παράγεται** τη στιγμή της ερώτησης — άρα αν η γραμμή
 * ξαναζωντανέψει (αναίρεση), ο τύπος **θεραπεύεται μόνος του**. Στο Excel η πληροφορία
 * «σε ποιο κελί έδειχνε» καταστρέφεται οριστικά.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-structural-heal
 * @see bim/table/formula/table-formula-rewrite.ts — η ΜΙΑ κάθοδος στο δέντρο (ADR-754 Γ1)
 * @see bim/table/formula/table-formula-ref-scope.ts — ο αναγνώστης που λέει `#REF!`
 * @see docs/centralized-systems/reference/adrs/ADR-764-structural-ops-formula-recalc.md §3
 */

import type { PersistedTableModel, TableCellEntry } from '../../../types/table';
import type { TableFormulaCellRef, TableFormulaNode } from '../../../types/table-formula';
import { indexById, type TableAxis } from '../table-cell-order';
import { rewriteTableFormulaRefs } from './table-formula-rewrite';

/** Το σκέλος της αναφοράς που ζει πάνω σε αυτόν τον άξονα. */
function axisIdOf(ref: TableFormulaCellRef, axis: TableAxis): string {
  return axis === 'row' ? ref.rowId : ref.colId;
}

/**
 * Η αναφορά με **αλλαγμένο μόνο** το σκέλος αυτού του άξονα.
 *
 * `spread` και εδώ, για τον λόγο του `remapRef` (ADR-754 Γ2): ό,τι δεν αφορά τον άξονα —
 * κυρίως οι σημαίες `$` — **μένει**. Επίπεδη αντικατάσταση θα ξεκλείδωνε σιωπηλά τα δολάρια
 * του χρήστη, και ο έλεγχος τύπων **δεν το πιάνει** (προαιρετικά πεδία + δομικός τύπος).
 */
function withAxisId(ref: TableFormulaCellRef, axis: TableAxis, id: string): TableFormulaCellRef {
  return axis === 'row' ? { ...ref, rowId: id } : { ...ref, colId: id };
}

/** Ό,τι χρειάζεται η συρρίκνωση από τον άξονα, υπολογισμένο **μία** φορά ανά πράξη. */
interface AxisCut {
  readonly axis: TableAxis;
  /** Η σειρά **πριν** τη διαγραφή — η ίδια ακολουθία που ευρετηριάζει το `order`. */
  readonly items: readonly { readonly id: string }[];
  readonly order: ReadonlyMap<string, number>;
  readonly removedIndex: number;
}

/**
 * Το εύρος μετά τη διαγραφή — **το ίδιο αντικείμενο** όταν δεν το αφορά.
 *
 * ⚠️ Τα άκρα **δεν κανονικοποιούνται**: ό,τι έγραψε ο χρήστης ως `B5:A1` παραμένει `B5:A1`,
 * απλώς με το ένα άκρο μετακινημένο. Γι' αυτό η φορά της συρρίκνωσης υπολογίζεται από τη
 * σχέση των **δύο δεικτών** και όχι από σταθερό πρόσημο (δες `types/table-formula.ts`).
 */
function shrinkRange(
  node: Extract<TableFormulaNode, { kind: 'range' }>,
  cut: AxisCut,
): TableFormulaNode {
  const fromIndex = cut.order.get(axisIdOf(node.from, cut.axis));
  const toIndex = cut.order.get(axisIdOf(node.to, cut.axis));
  // Άκρο που έχει ήδη σβηστεί σε προηγούμενη πράξη: δεν το «διορθώνουμε» μαντεύοντας —
  // το `#REF!` το λέει ο αναγνώστης, με την πληροφορία που πράγματι υπάρχει.
  if (fromIndex === undefined || toIndex === undefined) return node;

  const { removedIndex } = cut;
  if (removedIndex < Math.min(fromIndex, toIndex)) return node;
  if (removedIndex > Math.max(fromIndex, toIndex)) return node;
  // Μονή θέση πάνω σε αυτόν τον άξονα, και σβήνεται: δεν υπάρχει επιζών γείτονας **μέσα** στο
  // εύρος, άρα δεν υπάρχει τίποτα να συρρικνωθεί — η περιοχή έπαψε να υπάρχει.
  if (fromIndex === toIndex) return node;

  if (fromIndex === removedIndex) {
    const next = cut.items[fromIndex + (toIndex > fromIndex ? 1 : -1)].id;
    return { ...node, from: withAxisId(node.from, cut.axis, next) };
  }
  if (toIndex === removedIndex) {
    const next = cut.items[toIndex + (fromIndex > toIndex ? 1 : -1)].id;
    return { ...node, to: withAxisId(node.to, cut.axis, next) };
  }
  // Εσωτερικό: οι ταυτότητες το κάνουν δωρεάν — το εύρος ανοίγει πάνω στο ζωντανό πλέγμα.
  return node;
}

/**
 * Ξαναγράφει τα εύρη **κάθε** τύπου ώστε να επιβιώσουν της διαγραφής. Επιστρέφει το **ίδιο**
 * μοντέλο by-reference όταν κανένα δέντρο δεν άλλαξε.
 *
 * Το `model` είναι το μοντέλο **ΠΡΙΝ** την αφαίρεση — δες την κεφαλίδα για το γιατί δεν
 * μπορεί να είναι το μετά.
 *
 * Η εγγύηση ταυτότητας δεν είναι βελτιστοποίηση: η αλυσίδα `PersistedTableModel →
 * RESOLVED_MODEL_CACHE → TableModel → LAYOUT_CACHE` κλειδώνει σε ταυτότητα αντικειμένου, και
 * νέο αντικείμενο χωρίς λόγο σημαίνει ακυρωμένη μνήμη **και** βήμα undo που δεν αναιρεί
 * τίποτα. Την ίδια εγγύηση δίνουν ήδη `setPersistedCellText`, `remapTableFormulaRefs` και
 * `recalculateTableModel` — εδώ συνεχίζεται, δεν εφευρίσκεται.
 */
export function healTableFormulaRefsOnDelete(
  model: PersistedTableModel,
  axis: TableAxis,
  removedId: string,
): PersistedTableModel {
  const items: readonly { readonly id: string }[] = axis === 'row' ? model.rows : model.columns;
  const order = indexById(items);
  const removedIndex = order.get(removedId);
  if (removedIndex === undefined) return model;

  const cut: AxisCut = { axis, items, order, removedIndex };
  let changed = false;
  const cells: readonly TableCellEntry[] = model.cells.map((entry) => {
    const [rowId, colId, cell] = entry;
    if (cell.kind !== 'formula' || cell.formula === undefined) return entry;
    const root = rewriteTableFormulaRefs(cell.formula.root, (leaf) =>
      leaf.kind === 'range' ? shrinkRange(leaf, cut) : leaf,
    );
    if (root === cell.formula.root) return entry;
    changed = true;
    return [rowId, colId, { ...cell, formula: { ...cell.formula, root } }] as TableCellEntry;
  });

  return changed ? { ...model, cells } : model;
}
