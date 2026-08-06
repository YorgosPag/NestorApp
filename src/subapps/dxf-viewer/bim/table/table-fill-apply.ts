/**
 * 🔴 ADR-754 **Γ4** — **ΤΙ ΓΙΝΕΤΑΙ ΤΟ ΜΟΝΤΕΛΟ ΟΤΑΝ ΑΦΕΘΕΙ Η ΛΑΒΗ.** Καθαρή, αμετάβλητη
 * συνάρτηση: μηδέν React, μηδέν DOM, μηδέν store.
 *
 * ## 🔑 ΤΟ ΜΟΤΙΒΟ ΕΠΑΝΑΛΑΜΒΑΝΕΤΑΙ — δεν αντιγράφεται μόνο το τελευταίο κελί
 * Πηγή δύο κελιών (`10`, `20`) συμπληρωμένη έξι γραμμές κάτω δίνει `10 20 10 20 10 20`. Είναι
 * η συμπεριφορά του Excel και είναι ο λόγος που η πηγή είναι **περιοχή** και όχι κελί: αν
 * αντιγραφόταν μόνο το τελευταίο, μια επιλογή δύο κελιών θα ήταν αδιάκριτη από επιλογή ενός,
 * και ο χρήστης που μάρκαρε δύο θα έπαιρνε σιωπηλά κάτι που δεν ζήτησε.
 *
 * 🔴 **ADR-768 Φ2 — ο κυκλικός δείκτης ΜΕΤΑΚΟΜΙΣΕ** στο {@link tileTableRange}. Ήταν ιδιωτική
 * `fillCells` εδώ μέχρι που το **πινέλο μορφοποίησης** έκανε την ίδια ερώτηση για τον ίδιο
 * λόγο (γραμμές 6/7/8 της προδιαγραφής του Excel). Δεύτερο αντίγραφο θα ήταν sibling clone
 * (CHECK 3.28 / N.18) και δύο σημεία που μπορούν να μάθουν διαφορετικό πρόσημο υπολοίπου.
 * Εδώ μένει ό,τι είναι **του γεμίσματος**: τι κουβαλά ένα κελί και πώς ολισθαίνει ο τύπος του.
 *
 * ⚠️ **Δεν** υλοποιείται η **σειρά** του Excel (`1, 2` ⇒ `3, 4, 5`). Είναι ρητή απόφαση, όχι
 * παράλειψη: η ανίχνευση σειράς είναι ολόκληρη δική της σημασιολογία (αριθμητική πρόοδος,
 * ημερομηνίες, μήνες, προσαρμοσμένες λίστες) και το Excel την κάνει **διαφορετικά** ανάλογα με
 * το αν σέρνεις με το αριστερό ή με το δεξί πλήκτρο. Η επανάληψη μοτίβου είναι το
 * **υποσύνολο που δεν μπορεί να εκπλήξει**: δίνει πάντα δεδομένα που ο χρήστης βλέπει ήδη.
 * Καταγράφεται στο ADR ώστε η μέρα που θα προστεθεί να είναι απόφαση.
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΚΑΛΕΙ ΤΟ `applyTableRangeTransfer`
 * Η πρώτη σκέψη είναι «η συμπλήρωση **είναι** αντιγραφή· φτιάξε σχέδιο μεταφοράς». Δεν είναι,
 * και η διαφορά δεν είναι κοσμητική: το σχέδιο μεταφοράς υπόσχεται **ίδιου σχήματος** πηγή και
 * προορισμό (γι' αυτό ζευγαρώνει τις ακμές του ADR-750 κατά δείκτη). Η συμπλήρωση αλλάζει
 * σχήμα εξ ορισμού — μία γραμμή γίνεται έξι. Ένα σχέδιο με ασύμβατα ορθογώνια θα περνούσε από
 * τον φύλακα `from.length !== to.length` και θα **παρέλειπε σιωπηλά** τις ακμές, δηλαδή θα
 * έκανε κάτι απροσδιόριστο αντί να αρνηθεί.
 *
 * Ό,τι **είναι** κοινό μοιράζεται κανονικά: το «τι κουβαλά ένα αντιγραμμένο κελί»
 * ({@link transferredCell}, ο ένας ορισμός) και η ολίσθηση των τύπων
 * ({@link offsetTableFormula}). Μοιράζεται η **απάντηση**, όχι η μηχανή.
 *
 * @module subapps/dxf-viewer/bim/table/table-fill-apply
 * @see bim/table/table-fill-handle.ts — ΠΟΙΑ κελιά γεμίζουν (γεωμετρία + άξονας)
 * @see bim/table/formula/table-formula-offset.ts — γιατί το `$` μένει και το `A1` ακολουθεί
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §13
 */

import type { PersistedTableModel, TableCell, TableModel } from '../../types/table';
import { writePersistedCells } from './table-cell-content';
import { offsetTableFormula } from './formula/table-formula-offset';
import { commitCellWrites } from './formula/table-formula-engine';
import { getCell, resolveTableModel } from './table-model-helpers';
import { isBlankCell, transferredCell } from './table-range-transfer';
import { tileTableRange, type TableTiledCell } from './table-range-tiling';
import type { TableCellRangeBounds, TableCellRef } from './table-cell-range';
import type { TableFillTarget } from './table-fill-handle';

/**
 * Γεμίζει τα κελιά του στόχου από το μοτίβο της πηγής. Επιστρέφει το **ίδιο** μοντέλο
 * by-reference όταν τίποτα δεν άλλαξε — καμία εντολή, κανένα βήμα undo για το τίποτα.
 *
 * Οι πηγές διαβάζονται **πάντα από το αρχικό μοντέλο**. Δεν είναι λεπτομέρεια: με ανάγνωση από
 * το ενδιάμεσο αποτέλεσμα, ένα γέμισμα προς τα κάτω θα διάβαζε κελιά που μόλις έγραψε το ίδιο
 * — δηλαδή το πρώτο κελί θα αντιγραφόταν σε ολόκληρη τη στήλη και το μοτίβο θα χανόταν, **και
 * μόνο προς τη μία κατεύθυνση**. Ίδιος κανόνας, ίδιος λόγος με το `transferContent`.
 */
export function applyTableFill(
  model: PersistedTableModel,
  source: TableCellRangeBounds,
  target: TableFillTarget,
): PersistedTableModel {
  const before = resolveTableModel(model);
  const cells = tileTableRange(before, source, target.bounds);
  if (cells.length === 0) return model;

  // Ίδιο **τοπικό** κλειδί με τον μαζικό γραφέα: ζει και πεθαίνει μέσα σε αυτή τη συνάρτηση,
  // γι' αυτό δεν περνά από το branded `cellKey()`. Χάρτης και όχι γραμμική αναζήτηση: ένα
  // γέμισμα 500 γραμμών θα ήταν O(εμβαδόν²) — το ακριβές σχήμα που πλήρωσε ο ADR-735.
  const byTarget = new Map<string, TableTiledCell>();
  for (const fill of cells) byTarget.set(refKey(fill.at), fill);

  // 🔴 ADR-739 §50 — ο επαναϋπολογισμός δεν είναι πια χωριστό βήμα που πρέπει να θυμηθεί
  // αυτή η συνάρτηση: ο γραφέας επιστρέφει τα κελιά που **όντως** άλλαξαν και η
  // `commitCellWrites` τα διαδίδει. Η λίστα κλειδιών που υπολογιζόταν εδώ με το χέρι
  // (`cells.map(cellKey)`) ήταν **υπερσύνολο** — περιλάμβανε και τα κελιά όπου το γέμισμα
  // δεν άλλαξε τίποτα, δηλαδή άνοιγε τον γράφο για διαδρομές που δεν είχαν αφορμή.
  return commitCellWrites(
    writePersistedCells(
      model,
      cells.map((fill) => fill.at),
      {
        update: (existing, at) => filled(before, byTarget.get(refKey(at)), existing),
        create: (at) => {
          const next = filled(before, byTarget.get(refKey(at)), undefined);
          // Κενή πηγή σε κενό στόχο: καμία εγγραφή-φάντασμα. Ο αραιός χάρτης σημαίνει ήδη «κενό».
          return next && isBlankCell(next) ? null : next;
        },
      },
    ),
  );
}

/** Ίδιο τοπικό κλειδί με τον μαζικό γραφέα — δες εκεί γιατί δεν περνά από το branded `cellKey()`. */
function refKey(ref: TableCellRef): string {
  return `${ref.rowId} ${ref.colId}`;
}

/**
 * Το τελικό κελί: ό,τι κουβαλά η πηγή ({@link transferredCell}, ο ένας ορισμός) με τον τύπο
 * του **ολισθημένο** κατά τη μετατόπιση που υπολόγισε το {@link tileTableRange}.
 *
 * `null` όταν αυτό το κελί δεν ανήκει στο γέμισμα — αμυντικό, δεν συμβαίνει.
 */
function filled(
  before: TableModel,
  fill: TableTiledCell | undefined,
  existing: TableCell | undefined,
): TableCell | null {
  if (!fill) return null;

  const sourceCell = getCell(before, fill.from.rowId, fill.from.colId);
  const next = transferredCell(sourceCell, existing);
  if (next.formula === undefined) return next;

  const formula = offsetTableFormula(before, next.formula, {
    rows: fill.rows,
    columns: fill.columns,
  });
  return formula === next.formula ? next : { ...next, formula };
}
