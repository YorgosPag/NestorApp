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
 * ## ✅ ADR-828 — Η ΣΕΙΡΑ ΥΛΟΠΟΙΗΘΗΚΕ· εδώ έγραφε «δεν υλοποιείται», και ήταν σωστό ως τότε
 * Η προηγούμενη έκδοση αυτής της κεφαλίδας δήλωνε ρητά ότι η σειρά του Excel (`1, 2` ⇒
 * `3, 4, 5`) **δεν** υλοποιείται, ότι ήταν απόφαση και όχι παράλειψη, και ότι «καταγράφεται
 * στο ADR ώστε η μέρα που θα προστεθεί να είναι **απόφαση**». Αυτή η μέρα ήρθε.
 *
 * Η επανάληψη μοτίβου **δεν έφυγε** — παραμένει η προεπιλογή όπου δεν υπάρχει απόδειξη
 * σειράς, και είναι ολόκληρη η συμπεριφορά με `mode: 'copy'`. Ό,τι προστέθηκε είναι
 * *πρόσθετο*: μια λωρίδα που **δείχνει** διάταξη τη συνεχίζει.
 *
 * Ό,τι δεν είναι της σειράς μένει έξω από τη σειρά, και ο διαχωρισμός είναι ο ίδιος όπως
 * πάντα: **ο τύπος ολισθαίνει, δεν συνεχίζεται** — η «επόμενη τιμή» ενός `=A1*2` είναι το
 * `=A2*2`, ποτέ ένας αριθμός.
 *
 * ## 🔴 ΔΥΟ ΣΙΩΠΗΛΑ ΣΦΑΛΜΑΤΑ ΔΙΟΡΘΩΘΗΚΑΝ ΜΑΖΙ (ADR-828 §4) — δες τα σχόλια στο `update`
 * 1. Η **τέταρτη εγγύηση** («ίδιο μοντέλο by-reference όταν τίποτα δεν άλλαξε») ήταν
 *    **κενή**: κάθε σύρση γεννούσε βήμα undo ακόμη κι όταν δεν άλλαζε χαρακτήρας.
 * 2. Το γέμισμα **κατέστρεφε δεμένα κελιά** (ADR-767) μαζί με τον δεσμό τους.
 * Και τα δύο προϋπήρχαν· η σειρά τα έκανε χειρότερα, οπότε έκλεισαν εδώ.
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
import { cellText, writePersistedCells } from './table-cell-content';
import { offsetTableFormula } from './formula/table-formula-offset';
import { commitCellWrites } from './formula/table-formula-engine';
import { getCell, resolveTableModel } from './table-model-helpers';
import { isBlankCell, sameTransferredCell, transferredCell } from './table-range-transfer';
import { tileTableRange, type TableTiledCell } from './table-range-tiling';
import { remapCellTextRuns } from './table-cell-run-ops';
import { isBoundCellWritable } from './binding/table-binding-state';
import { buildTableFillPlan, type TableFillMode, type TableFillPlan } from './table-fill-plan';
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
  mode: TableFillMode = 'auto',
): PersistedTableModel {
  const before = resolveTableModel(model);
  const cells = tileTableRange(before, source, target.bounds);
  if (cells.length === 0) return model;

  // 🔴 ADR-828 §4 — **ΜΙΑ ΑΝΙΧΝΕΥΣΗ ΑΝΑ ΛΩΡΙΔΑ, ΟΧΙ ΑΝΑ ΚΕΛΙ.** Ένα γέμισμα 500 γραμμών έχει
  // 500 στόχους αλλά **μία** πηγή· ανίχνευση μέσα στο `filled()` θα ήταν O(εμβαδόν × πηγή),
  // δηλαδή το ίδιο σχήμα κόστους που ο χάρτης από κάτω υπάρχει για να αποφύγει.
  const plan = buildTableFillPlan(before, source, target, mode);

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
        update: (existing, at) => {
          // 🔴 ADR-828 §4 / ADR-767 — **ΔΕΜΕΝΟ ΚΕΛΙ ΔΕΝ ΓΡΑΦΕΤΑΙ ΑΠΟ ΓΕΜΙΣΜΑ.** Η τιμή του
          // είναι ό,τι είπε η πηγή για εκείνη τη γραμμή· ένα γέμισμα από πάνω έσβηνε **και
          // τον δεσμό** (η `transferredCell` δεν τον κουβαλά), δηλαδή έχανε την προέλευση
          // χωρίς μήνυμα. Η σειρά το επιδεινώνει: αντί για ορατά δεδομένα θα έγραφε
          // **εφευρεμένα**. Το βέτο αφορά το περιεχόμενο — η «μόνο μορφοποίηση» περνά.
          if (plan.parts !== 'format' && !isBoundCellWritable(existing)) return null;

          const next = filled(before, byTarget.get(refKey(at)), existing, plan);
          // 🔴 ADR-828 §4 — **Η ΤΕΤΑΡΤΗ ΕΓΓΥΗΣΗ, ΠΟΥ ΕΛΕΙΠΕ.** Η κεφαλίδα υπόσχεται «ίδιο
          // μοντέλο by-reference όταν τίποτα δεν άλλαξε», αλλά το `filled()` επιστρέφει
          // **πάντα** φρέσκο αντικείμενο — άρα ο γραφέας έβλεπε πάντα αλλαγή και κάθε σύρση
          // γεννούσε βήμα undo, ακόμη κι όταν δεν άλλαζε χαρακτήρας. Το αδελφό μονοπάτι
          // (`transferContent`) έκανε ήδη αυτόν ακριβώς τον έλεγχο· εδώ είχε ξεχαστεί.
          return next !== null && sameTransferredCell(existing, next) ? null : next;
        },
        create: (at) => {
          const next = filled(before, byTarget.get(refKey(at)), undefined, plan);
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
 * Το τελικό κελί: ό,τι κουβαλά η πηγή ({@link transferredCell}, ο ένας ορισμός), με τον τύπο
 * του **ολισθημένο** ή — όταν υπάρχει σειρά — με την **επόμενη τιμή** της.
 *
 * `null` όταν αυτό το κελί δεν ανήκει στο γέμισμα — αμυντικό, δεν συμβαίνει.
 */
function filled(
  before: TableModel,
  fill: TableTiledCell | undefined,
  existing: TableCell | undefined,
  plan: TableFillPlan,
): TableCell | null {
  if (!fill) return null;

  const sourceCell = getCell(before, fill.from.rowId, fill.from.colId);
  const next = transferredCell(sourceCell, existing, plan.parts);

  // 🔴 **ΟΙ ΤΥΠΟΙ ΠΡΩΤΟΙ ΚΑΙ ΠΑΝΤΑ.** Ένας τύπος δεν είναι ΠΟΤΕ σειρά: η «συνέχειά» του είναι
  // η **ολίσθηση** των αναφορών του (`=A1*2` → `=A2*2`), που είναι ήδη λυμένη και είναι
  // ολόκληρη η σημασιολογία του `$` (ADR-754 Γ1). Μια σειρά από πάνω θα έσβηνε τον τύπο και
  // θα άφηνε αριθμό — απώλεια δεδομένων χωρίς μήνυμα. Ο έλεγχος πάει **πριν** τη σειρά, ώστε
  // να μην εξαρτάται από το αν ο ανιχνευτής θυμήθηκε να απορρίψει τους τύπους.
  if (next.formula === undefined) return withSeriesText(next, sourceCell, plan.textAt(fill));

  const formula = offsetTableFormula(before, next.formula, {
    rows: fill.rows,
    columns: fill.columns,
  });
  return formula === next.formula ? next : { ...next, formula };
}

/**
 * Το κελί με την **επόμενη τιμή της σειράς** — ή αυτούσιο, όταν σειρά δεν υπάρχει.
 *
 * 🔴 **ADR-753 Φ1 — ΤΑ `runs` ΑΝΑΧΑΡΤΟΓΡΑΦΟΥΝΤΑΙ, ΔΕΝ ΚΛΗΡΟΝΟΜΟΥΝΤΑΙ.** Οι δείκτες τους
 * δείχνουν σε θέσεις του **παλιού** κειμένου· αλλάζοντας το `'9'` σε `'10'` βγαίνουν εκτός
 * ορίων **σιωπηλά** — κανένας τύπος δεν το πιάνει και η ζημιά φαίνεται μόνο ως παράξενη
 * μορφοποίηση, αργότερα.
 *
 * Στην πράξη ο κώδικας εδώ δεν προλαβαίνει να χρειαστεί: ο ανιχνευτής **απορρίπτει** ήδη κάθε
 * λωρίδα που κουβαλά `runs`, οπότε σειρά και πλούσιο κείμενο δεν συνυπάρχουν. Μένει επίτηδες:
 * μια σωστή διαδρομή που δεν εκτελείται δεν κοστίζει τίποτα, και τη μέρα που η απόρριψη
 * χαλαρώσει, τα δεδομένα είναι **ήδη** ασφαλή.
 */
function withSeriesText(
  next: TableCell,
  sourceCell: TableCell | undefined,
  text: string | null,
): TableCell {
  if (text === null) return next;

  // Το `remapCellTextRuns` επιστρέφει `undefined` **μόνο** όταν δεν υπήρχαν `runs` εξαρχής,
  // οπότε το προαιρετικό πεδίο δεν μπορεί να κρύψει μπαγιάτικους δείκτες κάτω από το spread.
  const runs = remapCellTextRuns(next.runs, cellText(sourceCell), text);
  return { ...next, kind: 'text', value: text, ...(runs === undefined ? {} : { runs }) };
}
