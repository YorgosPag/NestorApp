/**
 * 🔴 ADR-739 §60 — **ΤΟ «ΔΕΙΓΜΑ» ΤΟΥ ΔΙΑΛΟΓΟΥ**: πώς θα φαίνεται *αυτό* το κελί με *αυτή* τη
 * μορφή, πριν πατηθεί το ΟΚ. Καθαρό· μηδέν React, μηδέν DOM.
 *
 * ## 🔬 Τι κάνουν οι δύο μεγάλοι — **μετρημένο, όχι υποτεθειμένο**
 * ```
 *   Excel   «Sample»   → η ΠΡΑΓΜΑΤΙΚΗ τιμή του ενεργού κελιού
 *                        («The number in the active cell of the selection on the worksheet
 *                          appears in the Sample box», Microsoft Support)
 *   AutoCAD «Preview»  → σταθερό παράδειγμα της επιλεγμένης μορφής
 *                        («Displays a preview of the option you selected in the Format list»)
 * ```
 * ⚠️ Το handoff της Φάσης Ε πρότεινε τη ζωντανή προεπισκόπηση ως **σημείο υπεροχής** έναντι του
 * Excel. **Ψευδές, και επαληθεύτηκε πριν γραφτεί γραμμή**: το Excel το κάνει από πάντα. Είναι η
 * **τρίτη** φορά σε αυτή την εκστρατεία που ένας ισχυρισμός για τον ανταγωνιστή κατέρρευσε στον
 * έλεγχο (§58: AutoFit Row Height· §59: AutoCAD `SetTextRotation`) — και ο λόγος που η παγίδα
 * #12 του handoff είναι γραμμένη.
 *
 * ## 🏆 Πού πάμε παραπέρα: **και τα δύο, με τη σωστή σειρά**
 * Το κενό κελί είναι το σημείο όπου το Excel σιωπά: το «Δείγμα» μένει άδειο, δηλαδή ο χρήστης
 * που μορφοποιεί **πριν** πληκτρολογήσει — η φυσική σειρά όταν στήνεις στήλη σχεδίου — δεν
 * μαθαίνει τίποτα από το χειριστήριο που υπάρχει ακριβώς για να τον πληροφορήσει. Εδώ πέφτει
 * πίσω στο **παράδειγμα** (η λύση του AutoCAD), και το λέει ρητά ώστε το δείγμα να μη διαβαστεί
 * ποτέ ως περιεχόμενο του κελιού.
 *
 * @module subapps/dxf-viewer/bim/table/table-format-sample
 * @see bim/table/table-cell-format.ts — η μηχανή απόδοσης (μία, κοινή με τον ζωγράφο)
 */

import { cellDisplayText } from './table-cell-format';
import { cellKey, resolveTableModel } from './table-model-helpers';
import { tableFormatScopeBounds, type TableFormatScope } from './table-format-scope';
import type { PersistedTableModel, TableCell } from '../../types/table';
import type { TableCellFormat } from '../../types/table-cell-format';

/**
 * Από πού ήρθε το δείγμα — ώστε η επιφάνεια να το **ονομάσει** αντί να το παρουσιάσει σαν
 * περιεχόμενο.
 */
export type TableFormatSampleSource = 'cell' | 'example';

export interface TableFormatSample {
  readonly text: string;
  readonly source: TableFormatSampleSource;
}

/**
 * Το δείγμα για τον τρέχοντα στόχο: η **άγκυρα** της περιοχής, αλλιώς παράδειγμα.
 *
 * ## Γιατί η άγκυρα και όχι «όλα τα κελιά»
 * Ένα δείγμα είναι **ένα**. Σε επιλογή `B2:D9` το Excel δείχνει το κελί που κρατά ο δρομέας,
 * δηλαδή την πάνω-αριστερή γωνία της περιοχής — και όχι επειδή είναι η πρώτη, αλλά επειδή είναι
 * η **μόνη** που ο χρήστης βλέπει φωτισμένη ως ενεργή. Η επιλογή «το πρώτο μη κενό» θα ήταν πιο
 * «χρήσιμη» και θα έδειχνε τιμή από κελί που ο χρήστης δεν κοιτά.
 */
export function tableFormatSample(
  model: PersistedTableModel,
  scope: TableFormatScope,
  format: TableCellFormat,
): TableFormatSample {
  const anchor = anchorCell(model, scope);
  const text = anchor === undefined ? '' : cellDisplayText(anchor, format);
  if (text !== '') return { text, source: 'cell' };
  return { text: cellDisplayText(exampleCell(format), format), source: 'example' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/** Το κελί της πάνω-αριστερής γωνίας του στόχου· `undefined` όταν δεν υπάρχει στον αραιό χάρτη. */
function anchorCell(model: PersistedTableModel, scope: TableFormatScope): TableCell | undefined {
  const bounds = tableFormatScopeBounds(model, scope);
  if (bounds === null) return undefined;
  const resolved = resolveTableModel(model);
  const row = resolved.rows[bounds.firstRow];
  const column = resolved.columns[bounds.firstCol];
  if (!row || !column) return undefined;
  return resolved.cells.get(cellKey(row.id, column.id));
}

/**
 * Ο αριθμός που δείχνει **τι κάνει** η μορφή, όταν το κελί δεν έχει τι να πει.
 *
 * ⚠️ Δύο τιμές και όχι μία: ο σειριακός `46239` είναι `05/08/2026` ως ημερομηνία και
 * `46.239,00` ως νόμισμα — δηλαδή ένα κοινό παράδειγμα θα έδειχνε είτε παράλογη ημερομηνία είτε
 * παράλογο ποσό. Το ποσοστό ζητά **κλάσμα** (`0,25` ⇒ `25%`), γιατί η μορφή πολλαπλασιάζει
 * στην εμφάνιση (δες `TablePercentFormat`).
 *
 * 🔑 Το `kind: 'text'` του **κελιού** δεν έχει σχέση με το `kind: 'text'` της **μορφής**: το
 * πρώτο είναι το `CellKind` («τι έγραψε ο χρήστης», όχι τύπος), το δεύτερο η μορφή εμφάνισης.
 * Ένα δείγμα με `kind: 'formula'` θα ήταν ψέμα — δεν υπάρχει τύπος πίσω του.
 */
function exampleCell(format: TableCellFormat): TableCell {
  return { kind: 'text', value: EXAMPLE_VALUE_BY_KIND[format.kind] };
}

/**
 * Ολικός χάρτης, ποτέ `Partial`: ένα ένατο είδος **δεν μεταγλωττίζεται** χωρίς παράδειγμα, άρα
 * δεν μπορεί να προσγειωθεί κατηγορία που το «Δείγμα» αφήνει σιωπηλά κενή.
 */
const EXAMPLE_VALUE_BY_KIND: Readonly<Record<TableCellFormat['kind'], number>> = {
  general: 1234.5,
  text: 1234.5,
  whole: 1234.5,
  decimal: 1234.5,
  percent: 0.25,
  currency: 1234.5,
  angle: 45.5,
  // Σειριακός Excel (εποχή `1899-12-30`) — δες `formula/excel-serial-date.ts`.
  date: 46239,
};
