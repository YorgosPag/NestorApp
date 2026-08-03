/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 2) — **οι τύποι ακολουθούν τα κελιά που μετακόμισαν**.
 * Καθαρή συνάρτηση: μηδέν React, μηδέν DOM, μηδέν store.
 *
 * ## Ο κανόνας του Excel, σε μία πρόταση — και γιατί ΔΕΝ τον είχαμε δωρεάν
 * Μετρημένο, όχι εικασία (Microsoft Learn, `Range.Cut`): *«όταν μετακινείς μια επιλογή, το
 * Excel ενημερώνει τις αναφορές **προς** αυτήν, ανεξάρτητα από το αν είναι σχετικές ή
 * απόλυτες»* — ενώ *«αν μετακινείς μια επιλογή, το Excel **δεν** ενημερώνει τις αναφορές
 * **μέσα** στη μετακίνηση»*. Δηλαδή **ένας** κανόνας, ομοιόμορφος:
 *
 * > **Κάθε αναφορά που δείχνει σε κελί που μετακόμισε, ακολουθεί.
 * > Κάθε αναφορά σε κελί που έμεινε, μένει.**
 *
 * Το ADR-739 §9 έδωσε **το μισό** δωρεάν: οι αναφορές είναι δεμένες σε **ταυτότητες**
 * (`rowId`/`colId`), οπότε αναφορά σε κελί που δεν κουνήθηκε δεν έχει καν τι να αλλάξει —
 * ούτε λανθασμένη ολίσθηση μπορεί να συμβεί. Το **άλλο μισό** όμως ήταν δωρεάν **λάθος**:
 * στο δικό μας μοντέλο η ταυτότητα **μένει** και το **περιεχόμενο** μετακομίζει, οπότε μια
 * αναφορά στο κελί-πηγή θα έδειχνε, μετά τη μεταφορά, σε **άδειο κελί**. Το Excel σε αυτή
 * ακριβώς την περίπτωση ξαναγράφει τον τύπο.
 *
 * Αυτό το αρχείο είναι το άλλο μισό. Μετά από αυτό, η **μετακίνηση** έχει πλήρες parity —
 * και μάλιστα με μία μόνο απεικόνιση, γιατί ο κανόνας δεν ξεχωρίζει «μέσα» από «έξω»: η
 * απεικόνιση περιέχει **ό,τι μετακόμισε**, όπου κι αν ζούσε ο τύπος που το διαβάζει.
 *
 * ## 🔴 Η ΑΝΤΙΓΡΑΦΗ **ΔΕΝ** ΠΕΡΝΑ ΑΠΟ ΕΔΩ — ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ ΑΠΟΚΛΙΣΗ
 * Στο Excel η **αντιγραφή** ολισθαίνει τις **σχετικές** αναφορές (`=B1` αντιγραμμένο μια
 * γραμμή κάτω γίνεται `=B2`) και αφήνει ακέραιες τις **απόλυτες** (`=$B$1`). Το δικό μας
 * `TableFormulaCellRef` **δεν έχει** τη διάκριση: κάθε αναφορά είναι ταυτότητα, δηλαδή
 * συμπεριφέρεται ως **απόλυτη**. Άρα:
 *
 * - Αντιγραφή τύπου ⇒ **ίδιες** αναφορές. Σωστό για ό,τι θα ήταν `$B$1`, **λάθος** για ό,τι
 *   θα ήταν `B1`.
 * - Η θεραπεία **δεν** είναι να ολισθαίνουμε τα πάντα: αυτό θα έσπαγε την άλλη μισή πρόθεση,
 *   και μάλιστα σιωπηλά. Είναι να αποκτήσει ο τύπος σημαία απολυτότητας ανά άξονα
 *   (`$` στο `table-formula-lex/parse/print`) — **δική της φάση**, όχι λαθρεπιβάτης εδώ.
 *
 * Καταγράφεται ρητά αντί να περάσει ως parity, και **καρφώνεται με test** ώστε η μέρα που θα
 * αλλάξει να είναι απόφαση, όχι ατύχημα.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-remap
 * @see bim/table/table-range-transfer.ts — ο μοναδικός καλών (η μεταφορά περιοχής)
 * @see types/table-formula.ts — γιατί δέντρο και όχι κείμενο
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import type { CellKey, PersistedTableModel, TableCellEntry } from '../../../types/table';
import type { TableFormulaCellRef, TableFormulaNode } from '../../../types/table-formula';
import { cellKey } from '../table-model-helpers';

/**
 * «Ποιο κελί πήγε πού» — κλειδί το κελί **πηγή**, τιμή ο **προορισμός**.
 *
 * `CellKey` στο κλειδί επειδή είναι η δηλωμένη μοναδική νόμιμη σύνθεση ταυτότητας κελιού σε
 * κλειδί χάρτη (`table-model-helpers.ts`)· `TableFormulaCellRef` στην τιμή επειδή αυτό
 * ακριβώς μπαίνει στο δέντρο, χωρίς δεύτερη μετάφραση.
 */
export type TableFormulaRefRelocation = ReadonlyMap<CellKey, TableFormulaCellRef>;

/**
 * Ξαναγράφει **κάθε** τύπο του πίνακα ώστε οι αναφορές του να ακολουθήσουν τα κελιά που
 * μετακόμισαν. Επιστρέφει το **ίδιο** μοντέλο by-reference όταν κανένα δέντρο δεν άλλαξε.
 *
 * Η εγγύηση ταυτότητας δεν είναι βελτιστοποίηση: η αλυσίδα `PersistedTableModel →
 * RESOLVED_MODEL_CACHE → TableModel → LAYOUT_CACHE` κλειδώνει σε ταυτότητα αντικειμένου, και
 * ένα νέο αντικείμενο χωρίς λόγο σημαίνει ακυρωμένη μνήμη **και** βήμα undo που δεν αναιρεί
 * τίποτα. Την ίδια εγγύηση δίνουν ήδη `setPersistedCellText`, `setTableEdges` και
 * `recalculateTableModel` — εδώ συνεχίζεται, δεν εφευρίσκεται.
 */
export function remapTableFormulaRefs(
  model: PersistedTableModel,
  moved: TableFormulaRefRelocation,
): PersistedTableModel {
  if (moved.size === 0) return model;

  let changed = false;
  const cells: readonly TableCellEntry[] = model.cells.map((entry) => {
    const [rowId, colId, cell] = entry;
    if (cell.kind !== 'formula' || cell.formula === undefined) return entry;
    const root = remapNode(cell.formula.root, moved);
    if (root === cell.formula.root) return entry;
    changed = true;
    return [rowId, colId, { ...cell, formula: { ...cell.formula, root } }] as TableCellEntry;
  });

  return changed ? { ...model, cells } : model;
}

/**
 * Ο κόμβος με τις αναφορές του ενημερωμένες — **το ίδιο αντικείμενο** όταν τίποτα από κάτω
 * δεν άλλαξε, ώστε η εγγύηση ταυτότητας να ανεβαίνει από τα φύλλα ως τη ρίζα.
 *
 * Ο `switch` είναι **εξαντλητικός** πάνω στη διακριτή ένωση επίτηδες: ένας νέος τύπος κόμβου
 * αύριο σπάει τη μεταγλώττιση εδώ αντί να ξεχαστεί και να αφήσει αναφορές που δεν ακολουθούν
 * — ακριβώς ο λόγος που το `types/table-formula.ts` επέλεξε διακριτή ένωση.
 */
function remapNode(node: TableFormulaNode, moved: TableFormulaRefRelocation): TableFormulaNode {
  switch (node.kind) {
    case 'ref': {
      const next = moved.get(cellKey(node.cell.rowId, node.cell.colId));
      return next === undefined ? node : { kind: 'ref', cell: next };
    }
    case 'range':
      return remapRange(node, moved);
    case 'group': {
      const inner = remapNode(node.inner, moved);
      return inner === node.inner ? node : { kind: 'group', inner };
    }
    case 'unary': {
      const operand = remapNode(node.operand, moved);
      return operand === node.operand ? node : { ...node, operand };
    }
    case 'binary': {
      const left = remapNode(node.left, moved);
      const right = remapNode(node.right, moved);
      return left === node.left && right === node.right ? node : { ...node, left, right };
    }
    case 'call': {
      const args = node.args.map((arg) => remapNode(arg, moved));
      return args.every((arg, i) => arg === node.args[i]) ? node : { ...node, args };
    }
    default:
      return node;
  }
}

/**
 * 🔑 **Το εύρος ακολουθεί ΜΟΝΟ αν μετακόμισαν ΚΑΙ ΤΑ ΔΥΟ άκρα του** — και αυτό είναι Excel
 * parity, όχι συντηρητισμός.
 *
 * `=SUM(A1:A5)` όταν μετακινείς **μόνο** το `A3`: το Excel αφήνει το εύρος ακέραιο (και το
 * `A3` αδειάζει, οπότε το άθροισμα πέφτει). Αν ακολουθούσε το ένα άκρο, το εύρος θα
 * **παραμορφωνόταν** σε κάτι που κανείς δεν έγραψε — ένα `A1:D3` από ένα `A1:A5`, δηλαδή
 * αριθμός που μοιάζει σωστός και δεν είναι (ADR-720).
 *
 * Επειδή ο προορισμός είναι **σταθερή μετατόπιση** της πηγής, «και τα δύο άκρα μέσα στην
 * απεικόνιση» συνεπάγεται ότι το εύρος μετατοπίζεται **αυτούσιο**: ίδιο σχήμα, νέα θέση.
 * Τα άκρα **δεν** κανονικοποιούνται εδώ (δες `types/table-formula.ts`) — ό,τι έγραψε ο
 * χρήστης ως `B5:A1` παραμένει `B5:A1` μετακινημένο, όχι σιωπηλά αναποδογυρισμένο.
 */
function remapRange(
  node: Extract<TableFormulaNode, { kind: 'range' }>,
  moved: TableFormulaRefRelocation,
): TableFormulaNode {
  const from = moved.get(cellKey(node.from.rowId, node.from.colId));
  const to = moved.get(cellKey(node.to.rowId, node.to.colId));
  if (from === undefined || to === undefined) return node;
  return { kind: 'range', from, to };
}
