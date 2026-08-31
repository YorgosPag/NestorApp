/**
 * ADR-739 Φ.Ζ — **ο adapter**: το συμβόλαιο του §9.2 και η μία διαδρομή «γράψε κελί →
 * ξαναϋπολόγισε». Το αρχείο που θα άλλαζε — **μόνο αυτό** — αν κάποτε μπει εξωτερική
 * βιβλιοθήκη τύπων.
 *
 * ## Η υπογραφή δεν επινοήθηκε εδώ
 * Το `evaluate(model, changed)` είναι **αυτούσιο** από το ADR-739 §9.2, γραμμένο πριν
 * υπάρξει μηχανή. Ο λόγος 1 του §9.2 («αναστρεψιμότητα») το απαιτεί: ό,τι κι αν κάνει από
 * κάτω, ο υπόλοιπος πίνακας ξέρει μόνο αυτή τη γραμμή.
 *
 * ## 🔑 Η εγγύηση ταυτότητας ταξιδεύει μέχρι εδώ
 * Όταν τίποτα δεν άλλαξε, επιστρέφεται **το ίδιο** μοντέλο by-reference. Χωρίς αυτό, κάθε
 * commit που δεν αλλάζει τίποτα θα γεννούσε νέο αντικείμενο, δηλαδή **βήμα undo για το
 * τίποτα** και ακύρωση των `WeakMap` του `resolveTableModel`/`resolveTableLayout` — η ίδια
 * τέταρτη εγγύηση που δίνει ήδη το `setPersistedCellText`, συνεχισμένη αντί για ξαναγραμμένη.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-engine
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9.2
 */

import type {
  CellKey,
  PersistedTableModel,
  TableColumnId,
  TableModel,
  TableRowId,
} from '../../../types/table';
import type { TableFormula } from '../../../types/table-formula';
import type { ScheduleCellValue } from '../../schedule/types';
import type { PendingCellWrites } from '../table-cell-content';
import {
  cellKey,
  getPersistedCellText,
  resolveTableModel,
  setPersistedCellFormula,
  setPersistedCellText,
} from '../table-model-helpers';
import { clipTableCellText } from '../table-ooxml-limits';
import { evaluateTableFormula } from './table-formula-eval';
import { readCellRefValue } from './table-formula-ref-scope';
import { alternateFormulaGrammar, drawingFormulaGrammar } from './table-formula-grammar';
import { isFormulaInput, parseTableFormula } from './table-formula-parse';
import { printTableFormula } from './table-formula-print';
import { evaluateTableFormulas } from './table-formula-recalc';
import type { TableFormulaValue } from './table-formula-value';

/**
 * Το συμβόλαιο του ADR-739 §9.2 — αυτούσιο.
 *
 * Παραμένει **interface** και όχι σκέτη συνάρτηση ώστε ο καταναλωτής να μπορεί να δεχτεί
 * άλλη υλοποίηση (δοκιμαστική διπλή, ή αυριανή βιβλιοθήκη) χωρίς να αλλάξει τύπο.
 */
export interface TableFormulaEngine {
  evaluate(model: TableModel, changed: readonly CellKey[]): ReadonlyMap<CellKey, ScheduleCellValue>;
}

/** Η υλοποίηση της Φ.Ζ: δικός μας αναλυτής, δικός μας γράφος, μηδέν εξάρτηση. */
export const tableFormulaEngine: TableFormulaEngine = {
  evaluate: evaluateTableFormulas,
};

/**
 * **Η ΜΙΑ διακλάδωση `=`**: ό,τι πληκτρολογεί ή επικολλά ο χρήστης περνά από εδώ.
 *
 * - Κείμενο που ξεκινά με `=` **και** αναλύεται ⇒ κελί τύπου.
 * - Κείμενο που ξεκινά με `=` και **δεν** αναλύεται (`'=1+'`) ⇒ μένει **κείμενο**, αυτούσιο.
 *   Ο χρήστης βλέπει ό,τι έγραψε και το διορθώνει· τίποτα δεν χάνεται, καμία κατάσταση
 *   σφάλματος δεν χρειάζεται εξήγηση.
 * - Οτιδήποτε άλλο ⇒ κείμενο, ακριβώς όπως πριν αυτή τη φάση.
 *
 * Η **τιμή** δεν υπολογίζεται εδώ: μπαίνει προσωρινά κενή και τη γράφει ο
 * {@link recalculateTableModel} στο ίδιο commit. Ο λόγος είναι η επικόλληση: είκοσι κελιά
 * γράφονται ένα-ένα και ξαναϋπολογίζονται **μία** φορά, με τη σωστή τοπολογική σειρά — αν
 * υπολόγιζε το καθένα μόνο του, το πρώτο θα διάβαζε κελιά που δεν έχουν γραφτεί ακόμα.
 */
export function writeCellInput(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
  rawText: string,
): PendingCellWrites {
  // 🔴 ADR-833 Φ5Β — **η ράγα του μήκους μπαίνει ΕΔΩ και πουθενά αλλού.**
  // Μέχρι τη Φάση 5Β **καμία** διαδρομή δεν φράζε το μήκος κειμένου κελιού (μετρημένο
  // 31/08: το `32767` δεν υπήρχε στο `src/`), ενώ η Φάση 6 υποσχέθηκε **εξαγωγή σε
  // `.xlsx`** — και το ίδιο το OOXML περιορίζει την τιμή κελιού στους 32.767 χαρακτήρες.
  // Δηλαδή ένα μακρύτερο κελί δεν είναι «μεγάλο», είναι **μη εξαγώγιμο**.
  //
  // 🔑 Η θέση δεν είναι επιλογή ευκολίας: αυτή η συνάρτηση είναι η **ΜΙΑ διακλάδωση `=`**
  // από την οποία περνά κάθε κείμενο χρήστη — πληκτρολόγηση, πρόχειρο του δρομέα,
  // επικόλληση TSV, εισαγωγή `.xlsx`. Φραγή σε οποιονδήποτε καλούντα θα ήταν φραγή που οι
  // άλλοι τρεις παρακάμπτουν χωρίς να το ξέρουν (ίδιο σκεπτικό με το `resolveShape` του
  // `build-table-entity`).
  //
  // ⚠️ Ο **τύπος** κόβεται κι αυτός, και πρέπει: το πηγαίο κείμενο ενός τύπου γράφεται στο
  // `.xlsx` ως `<f>` και υπόκειται στο ίδιο όριο. Το κόψιμο ενός τύπου τον καθιστά κατά
  // κανόνα μη αναλύσιμο, οπότε πέφτει στον κλάδο «μένει κείμενο, αυτούσιο» — ο χρήστης
  // βλέπει ό,τι έμεινε και το διορθώνει, αντί για σιωπηλά λάθος αποτέλεσμα.
  //
  // ⚠️ **Δηλωμένη ισοδύναμη μετάλλαξη (M39, Φ5Β)**: το `isFormulaInput(rawText)` αντί για
  // `isFormulaInput(text)` μένει πράσινο, και **αποδεικνύεται** ισοδύναμο — το κόψιμο είναι
  // **πρόθεμα**, και το `isFormulaInput` κρίνει από τον **πρώτο χαρακτήρα**. Κείμενο και
  // κομμένο κείμενο δεν μπορούν να διαφωνήσουν. Ρωτιέται το `text` γιατί εκείνο είναι που
  // θα γραφτεί — μια ερώτηση πάνω σε τιμή που δεν αποθηκεύεται είναι πρόσκληση να αποκλίνουν
  // την ημέρα που το κόψιμο πάψει να είναι πρόθεμα.
  const { text } = clipTableCellText(rawText);

  if (!isFormulaInput(text)) return setPersistedCellText(model, rowId, colId, text);

  const formula = parseWithFallback(resolveTableModel(model), text);
  return formula === null
    ? setPersistedCellText(model, rowId, colId, text)
    : setPersistedCellFormula(model, rowId, colId, formula);
}

/**
 * 🔴 ADR-761 — **η ανεκτική ανάγνωση**: πρώτα η γραμματική του σχεδίου, και **μόνο αν εκείνη
 * δεν βγάζει νόημα**, η άλλη.
 *
 * ## Γιατί αυτό ΔΕΝ είναι μαντεψιά — και γιατί η σειρά είναι όλη η απόδειξη
 * Η εφεδρεία εκτελείται αποκλειστικά στον κλάδο όπου η κύρια επέστρεψε `null`, δηλαδή εκεί
 * που το κείμενο **δεν είχε καμία** ερμηνεία στην κύρια γραμματική. Άρα δεν μπορεί ποτέ να
 * **αλλάξει** νόημα· μπορεί μόνο να **δώσει** νόημα εκεί που δεν υπήρχε κανένα. Η ιδιότητα
 * είναι κατοχυρωμένη με property test πάνω σε corpus (`table-formula-grammar.test.ts`) —
 * χωρίς αυτήν, το `=SUM(1,5)` θα μπορούσε να διαβαστεί «3,5 ή 6 ανάλογα με την τύχη», που
 * σε πίνακα ποσοτήτων είναι **σφάλμα τιμής**.
 *
 * ## Τι κερδίζει, μετρημένα
 * - `=CONCATENATE(A2;" ";A3)` — η γραφή που ξέρει ο Έλληνας χρήστης από το Excel
 * - `=SUM(A1,A2)` και `=SUM(1.5,2)` — ό,τι έχει ήδη γραφτεί, ό,τι αντιγράφεται από
 *   αγγλόφωνο φύλλο ή από τεκμηρίωση, και ό,τι έρχεται από **επικόλληση** (η επικόλληση
 *   περνά από αυτή την ίδια πόρτα — `table-range-clipboard.ts`)
 *
 * Και στις δύο περιπτώσεις ο τύπος αποθηκεύεται ως **δέντρο** και ξαναγράφεται από το
 * {@link cellInputText} στη γραμματική του σχεδίου. Ακριβώς όπως το Excel ξαναγράφει τους
 * τύπους σου όταν αλλάξεις το List Separator των Windows.
 */
function parseWithFallback(model: TableModel, text: string): TableFormula | null {
  const grammar = drawingFormulaGrammar();
  const primary = parseTableFormula(model, text, grammar);
  if (primary !== null) return primary;
  return parseTableFormula(model, text, alternateFormulaGrammar(grammar));
}

/**
 * 🔴 ADR-763 Φ2.3 — **ΤΙ ΘΑ ΕΒΓΑΖΕ ΑΥΤΟ, ΑΝ ΤΟ ΔΕΣΜΕΥΑΜΕ;** — χωρίς να δεσμευτεί τίποτα.
 *
 * Ο διάλογος «Ορίσματα συνάρτησης» δείχνει `= <τιμή>` δίπλα σε **κάθε** κουτί και «Αποτέλεσμα
 * =» στο τέλος, σε κάθε πληκτρολόγηση και σε κάθε κλικ υπόδειξης. Η ερώτηση είναι η ίδια με
 * του {@link writeCellInput}, **μείον** τη γραφή.
 *
 * ## Γιατί ζει εδώ και όχι σε δικό της module
 * Είναι ο **ίδιος** συνδυασμός «ανάγνωση με εφεδρεία → αξιολόγηση» που κάνει ήδη η δέσμευση,
 * και η ανεκτική ανάγνωση ({@link parseWithFallback}) είναι ιδιωτική **επίτηδες**: εκτεθειμένη,
 * θα ξαναγραφόταν λάθος από τον επόμενο καλούντα (μόνο η κύρια γραμματική, ή με αντίστροφη
 * σειρά — που αλλάζει **νόημα**, δες τη δική της τεκμηρίωση). Ένα δεύτερο module θα ήταν ο
 * δεύτερος δρόμος «κείμενο → τιμή», δηλαδή ο διάλογος θα μπορούσε να υπόσχεται αριθμό που η
 * δέσμευση δεν θα παρήγαγε.
 *
 * ## Ο επαναϋπολογισμός ΔΕΝ καλείται — και είναι σωστό
 * Το {@link evaluateTableFormulas} λύνει **γράφο**: τι ξαναϋπολογίζεται και με ποια σειρά.
 * Εδώ δεν υπάρχει γράφος — υπάρχει **ένα** κείμενο που δεν ανήκει ακόμη σε κανένα κελί, και
 * τα κελιά που διαβάζει έχουν ήδη σταθερές τιμές στο μοντέλο. Ένα πέρασμα από τον
 * επαναϋπολογισμό θα ζητούσε να **γραφτεί** πρώτα το κελί, δηλαδή ακριβώς αυτό που η
 * προεπισκόπηση δεν επιτρέπεται να κάνει.
 *
 * ⚠️ **Ένας κύκλος δεν ανιχνεύεται εδώ**: ένα `=A1` γραμμένο **μέσα** στο `A1` διαβάζει την
 * αποθηκευμένη τιμή του και δείχνει αριθμό, ενώ η δέσμευση θα έδινε `#CIRCULAR!`. Είναι
 * συνειδητό όριο **προεπισκόπησης**: η ανίχνευση κύκλου είναι ιδιότητα του γράφου, και ο
 * γράφος αποκτά αυτόν τον κόμβο μόνο όταν δεσμευτεί. Το ίδιο κάνει και το Excel.
 *
 * `null` όταν το κείμενο δεν είναι αναλύσιμος τύπος — που είναι η **κανονική** κατάσταση όσο ο
 * χρήστης πληκτρολογεί, όχι σφάλμα: ο καλών δεν δείχνει τίποτα και ξαναρωτά στον επόμενο
 * χαρακτήρα.
 */
export function previewFormulaValue(model: TableModel, text: string): TableFormulaValue | null {
  if (!isFormulaInput(text)) return null;
  const formula = parseWithFallback(model, text);
  if (formula === null) return null;
  // 🔴 ADR-764 — **ο ίδιος** αναγνώστης με τον επαναϋπολογισμό, όχι ο ίδιος **κανόνας**
  // γραμμένος δεύτερη φορά. Ήταν κυριολεκτικά η ίδια γραμμή σε δύο αρχεία· από τη στιγμή που
  // η μία απέκτησε τη διάκριση «κενό vs δεν υπάρχει», η άλλη θα υποσχόταν στον διάλογο
  // αριθμό εκεί όπου η δέσμευση δίνει `#REF!`.
  return evaluateTableFormula({ model, valueAt: (ref) => readCellRefValue(model, ref) }, formula);
}

/**
 * 🔴 ADR-739 §50 — **ΤΟ ΜΟΝΟ ΞΕΤΥΛΙΓΜΑ** μιας {@link PendingCellWrites} σε μοντέλο.
 *
 * Είναι το «η γραφή και ο επαναϋπολογισμός είναι ΕΝΑΣ μετασχηματισμός» του `Φ.Ζ`, ανυψωμένο
 * από σύμβαση που θυμάται ο καθένας σε **βήμα που δεν παρακάμπτεται**: το μόνο πράγμα που
 * μετατρέπει το αποτέλεσμα ενός γραφέα περιεχομένου σε κάτι που δέχεται ο υπόλοιπος πίνακας.
 *
 * ## Γιατί ζει ΕΔΩ και όχι δίπλα στον γραφέα
 * Ο γραφέας (`table-cell-content.ts`) είναι **κάτω** από τη μηχανή τύπων: το
 * `table-model-helpers` τον επανεξάγει και αυτό το αρχείο εισάγει από εκεί. Ένα
 * `commitCellWrites` γραμμένο εκεί θα χρειαζόταν το `recalculateTableModel`, δηλαδή θα έκλεινε
 * ακριβώς τον **κύκλο εισαγωγών** για τον οποίο προειδοποιεί η κεφαλίδα του — εκείνον που
 * «δούλευε επειδή η ESM ανυψώνει δηλώσεις συναρτήσεων», και γι' αυτό ήταν επικίνδυνος.
 *
 * Κανένα κελί δεν άλλαξε ⇒ **το ίδιο** μοντέλο by-reference: καμία εντολή, κανένα βήμα undo
 * για το τίποτα. Ο γράφος δεν ανοίγεται καν — δεν υπάρχει τίποτα να διαδοθεί.
 */
export function commitCellWrites(pending: PendingCellWrites): PersistedTableModel {
  if (pending.written.length === 0) return pending.model;
  return recalculateTableModel(
    pending.model,
    pending.written.map((target) => cellKey(target.rowId, target.colId)),
  );
}

/**
 * **Η αντίστροφη του {@link writeCellInput}**: τι βλέπει ο χρήστης όταν ανοίγει το κελί.
 *
 * Κελί τύπου ⇒ το **πηγαίο** (`=SUM(A1:A5)`), παραγμένο από το δέντρο τη στιγμή της
 * ερώτησης· οτιδήποτε άλλο ⇒ το κείμενό του. Ένα σημείο, γιατί τη ρωτούν **δύο** καταναλωτές
 * με την ίδια απαίτηση — ο επεξεργαστής μέσα στο κελί και η γραμμή τύπων — και μια δεύτερη
 * απάντηση θα σήμαινε ότι η γραμμή τύπων μπορεί κάποτε να δείχνει άλλο κείμενο από αυτό που
 * επεξεργάζεσαι.
 *
 * Στον **καμβά** εξακολουθεί να φαίνεται το αποτέλεσμα: εκείνος διαβάζει `cellText(value)`
 * και δεν περνά ποτέ από εδώ — όπως ακριβώς σε Excel, Sheets και AutoCAD.
 */
export function cellInputText(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
): string {
  const cell = model.cells.find(([r, c]) => r === rowId && c === colId)?.[2];
  if (cell?.kind === 'formula' && cell.formula !== undefined) {
    return printTableFormula(resolveTableModel(model), cell.formula);
  }
  return getPersistedCellText(model, rowId, colId);
}

/**
 * Ξαναϋπολογίζει ό,τι εξαρτάται από τα αλλαγμένα κελιά και επιστρέφει το **νέο** μοντέλο —
 * ή το ίδιο by-reference όταν καμία τιμή δεν άλλαξε.
 */
export function recalculateTableModel(
  model: PersistedTableModel,
  changed: readonly CellKey[],
): PersistedTableModel {
  const results = tableFormulaEngine.evaluate(resolveTableModel(model), changed);
  if (results.size === 0) return model;

  let touched = false;
  const cells = model.cells.map((entry) => {
    const [rowId, colId, cell] = entry;
    const next = results.get(cellKey(rowId, colId));
    if (next === undefined || next === cell.value) return entry;
    touched = true;
    return [rowId, colId, { ...cell, value: next }] as const;
  });

  return touched ? { ...model, cells } : model;
}

/**
 * 🔴 ADR-764 — **ο επαναϋπολογισμός της ΔΟΜΙΚΗΣ πράξης**: ξαναϋπολογίζει **κάθε** τύπο του
 * πίνακα. Το ίδιο μοντέλο by-reference όταν καμία τιμή δεν άλλαξε.
 *
 * ## Γιατί ΟΛΟΙ οι τύποι, και όχι μια λίστα αλλαγμένων κλειδιών
 * Ο {@link recalculateTableModel} ξαναϋπολογίζει τα **κατάντη** των κλειδιών που του δίνεις.
 * Μετά από διαγραφή γραμμής, τα κελιά που «άλλαξαν» **δεν υπάρχουν πια** — δεν έχουν κλειδί
 * να μπει στη λίστα. Ένα αφελές `changed: []` δίνει `dirty.size === 0`, δηλαδή **καμία
 * δουλειά**: κώδικας που περνά κάθε test και δεν κάνει τίποτα.
 *
 * Και δεν είναι θέμα «ποια κλειδιά ξεχάσαμε». Είναι δομικό:
 *
 * > Μια δομική πράξη δεν αλλάζει **τιμές** — αλλάζει τον **γράφο**. Οι πρόγονοι ενός εύρους
 * > δεν είναι αποθηκευμένοι· **παράγονται** από το ζωντανό πλέγμα (`expandRangeShape`). Άρα
 * > ένα `=SUM(A1:A5)` έχει μετά τη διαγραφή **άλλους** προγόνους από πριν, και καμία διάδοση
 * > με βάση κλειδιά δεν μπορεί να το ανακαλύψει: το κλειδί που θα το ξυπνούσε είναι ακριβώς
 * > εκείνο που έπαψε να είναι πρόγονός του.
 *
 * Το κόστος είναι O(τύποι) **μία φορά ανά εντολή χρήστη**, σε πίνακα με φραγμένο πλήθος
 * γραμμών (`MAX_TABLE_DATA_ROW_COUNT`) — ποτέ ανά καρέ. Η εγγύηση ταυτότητας επιβιώνει
 * ακέραιη: όσα κλειδιά κι αν δοθούν, νέο αντικείμενο γεννιέται **μόνο** αν κάποια τιμή όντως
 * άλλαξε.
 */
export function recalculateAllTableFormulas(model: PersistedTableModel): PersistedTableModel {
  const changed: CellKey[] = [];
  for (const [rowId, colId, cell] of model.cells) {
    if (cell.kind === 'formula' && cell.formula !== undefined) changed.push(cellKey(rowId, colId));
  }
  return changed.length === 0 ? model : recalculateTableModel(model, changed);
}
