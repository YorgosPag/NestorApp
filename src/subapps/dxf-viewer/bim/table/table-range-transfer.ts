/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 2) — **ΟΙ ΤΡΕΙΣ ΠΡΑΞΕΙΣ ΤΗΣ ΜΕΤΑΦΟΡΑΣ ΠΕΡΙΟΧΗΣ**: μετακίνηση,
 * αντιγραφή (`Ctrl`), εισαγωγή-&-ολίσθηση (`Shift`). Καθαρές, αμετάβλητες — μηδέν React, μηδέν
 * DOM, μηδέν store.
 *
 * ## 🔑 ΤΡΕΙΣ ΠΡΑΞΕΙΣ, **ΕΝΑΣ** ΕΦΑΡΜΟΣΤΗΣ
 * Δεν υπάρχουν εδώ τρία σώματα. Το `table-range-transfer-plan.ts` έχει ήδη μεταφράσει και τις
 * τρεις σε **μία** λίστα γεμισμάτων («ποιο κελί παίρνει από πού»), οπότε το μόνο που μένει
 * είναι να εκτελεστεί. Τρεις χωριστές συναρτήσεις θα ήταν τρία αδέλφια-κλώνοι (CHECK 3.28,
 * N.18) και — χειρότερα — τρία σημεία που μπορούν κάποτε να μάθουν διαφορετικό κανόνα για τις
 * ακμές ή για τους τύπους.
 *
 * ## 🔴 ΕΝΑ UNDO ΑΝΑ ΧΕΙΡΟΝΟΜΙΑ — ΗΔΗ ΛΥΜΕΝΟ, ΔΕΝ ΞΑΝΑΛΥΝΕΤΑΙ ΕΔΩ
 * Καμία `CompositeCommand`, κανένα `executeAsAtomicBatch`. Και οι πέντε γραφείς που καλούνται
 * παρακάτω (`writePersistedCells`, `setTableEdges`, το spread των συγχωνεύσεων,
 * `remapTableFormulaRefs`, `recalculateTableModel`) είναι **καθαροί και αμετάβλητοι**: ο καθένας
 * παίρνει μοντέλο και δίνει μοντέλο, οπότε αλυσιδώνονται στη μνήμη και φτάνουν στον καλούντα ως
 * **ένα** τελικό μοντέλο. Η ατομικότητα βγαίνει δωρεάν από την καθαρότητα αντί να χτιστεί από
 * πάνω της — ακριβώς όπως τεκμηριώνει η κεφαλίδα του `table-range-clipboard.ts` και το
 * `buildTableCellEditCommand`.
 *
 * Η **εγγύηση ταυτότητας** ταξιδεύει μαζί: αν κανένα σκέλος δεν αλλάξει τίποτα, επιστρέφεται το
 * **ίδιο** μοντέλο by-reference ⇒ το `buildTableModelCommand` δεν γεννά εντολή ⇒ κανένα βήμα
 * undo για το τίποτα.
 *
 * ## 🔴 ΤΙ ΤΑΞΙΔΕΥΕΙ — Η ΑΠΟΦΑΣΗ, ΚΑΙ Η ΜΕΤΡΗΜΕΝΗ ΑΠΟΚΛΙΣΗ ΤΗΣ
 * Εντολή ιδιοκτήτη (03/08): **κείμενο + μορφοποίηση + ρητές ακμές**. Η μορφοποίηση όμως ζει σε
 * **τρία** επίπεδα (§28.4): κελί ▸ γραμμή ▸ στήλη. Ταξιδεύει **μόνο το επίπεδο 1**, η ρητή
 * παράκαμψη του κελιού.
 *
 * ### Γιατί όχι το «αποτελεσματικό» στυλ, όπως κάνει το Excel
 * Το Excel μεταφέρει το αποτελεσματικό στυλ επειδή **δεν έχει** επίπεδα: κάθε μορφοποίηση εκεί
 * *είναι* μορφοποίηση κελιού. Εμείς έχουμε, και το να «υλοποιήσουμε» την κληρονομιά στη
 * μετακίνηση θα σήμαινε ότι κάθε κελί που κουνήθηκε αποκτά ρητή τιμή σε **κάθε** πεδίο — δηλαδή
 * γίνεται **άτρωτο σε κάθε μελλοντική αλλαγή της γραμμής ή της στήλης του**. Είναι ακριβώς η
 * δοκτρίνα `BYLAYER` του AutoCAD και το «By Category» του Revit: μια οντότητα που αλλάζει
 * επίπεδο **παίρνει την εμφάνιση του νέου της επιπέδου**, και αυτό δεν είναι απώλεια — είναι ο
 * λόγος που υπάρχει η κληρονομιά. Ένα CAD που την υλοποιεί σιωπηλά σε κάθε σύρσιμο δεν έχει
 * κληρονομιά, έχει προεπιλογές.
 *
 * ### 🔴 Η απόκλιση, μετρημένη και δηλωμένη
 * Κελί που έπαιρνε **έντονα από τη γραμμή του** και μετακινείται σε γραμμή χωρίς έντονα, **χάνει
 * τα έντονα**. Στο Excel δεν θα τα έχανε. Αυτό είναι **επιλογή**, όχι παράλειψη, και είναι
 * καρφωμένη με test — ώστε η μέρα που θα αλλάξει να είναι απόφαση, όχι ατύχημα.
 *
 * ### Τι άλλο ταξιδεύει, και τι όχι
 * ```
 *   kind · value · formula        →  ΝΑΙ  (το περιεχόμενο)
 *   styleOverride                 →  ΝΑΙ  (επίπεδο 1 — δες παραπάνω)
 *   diagonal (ADR-750)            →  ΝΑΙ  (ανήκει σε ΕΝΑ κελί, πάντα — §6.3)
 *   ρητές ακμές πλέγματος         →  ΝΑΙ  (οι έξι πλευρές του ορθογωνίου, δες παρακάτω)
 *   locked                        →  ΟΧΙ  (ιδιότητα της ΘΕΣΗΣ σε δεμένο πίνακα, όχι του
 *                                          περιεχομένου: «αυτό το κελί δεν γράφεται πίσω»
 *                                          αφορά τη στήλη-πηγή, όχι το κείμενο που πέρασε)
 * ```
 *
 * @module subapps/dxf-viewer/bim/table/table-range-transfer
 * @see bim/table/table-range-transfer-plan.ts — το σχέδιο (γεωμετρία + άρνηση)
 * @see bim/table/formula/table-formula-remap.ts — οι τύποι ακολουθούν
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import type { CellKey, PersistedTableModel, TableCell } from '../../types/table';
import type { TableBorderSpec, TableEdgeKey } from '../../types/table-edges';
import type { TableCellRef } from './table-cell-range';
import type { TableRangeTransferPlan } from './table-range-transfer-types';
import { writePersistedCells, type PendingCellWrites } from './table-cell-content';
import { buildTableEdgeIndex, setTableEdges } from './table-edge-model';
import { TABLE_BORDER_EVERY_SIDE, tableRangeSideEdges } from './table-range-border-ops';
import { cellKey, getCell, resolveTableModel } from './table-model-helpers';
import { recalculateTableModel } from './formula/table-formula-engine';
import { bookWithHome, type TableFormulaWorkbook } from './formula/table-formula-workbook';

import {
  offsetTableFormula,
  tableFormulaOffsetBetween,
  type TableFormulaOffset,
} from './formula/table-formula-offset';
import { remapTableFormulaRefs, type TableFormulaRefRelocation } from './formula/table-formula-remap';

/**
 * **Εκτελεί ένα σχέδιο μεταφοράς** και δίνει το νέο μοντέλο — ή το ίδιο by-reference όταν τίποτα
 * δεν άλλαξε (κενή περιοχή πάνω σε κενό στόχο).
 *
 * Η σειρά των πέντε σκελών **δεν** είναι αυθαίρετη:
 * 1. **περιεχόμενο** — μετακομίζει πρώτο, ώστε τα επόμενα να δουν τον τελικό πίνακα κελιών·
 * 2. **τύποι** — ξαναγράφονται μετά, γιατί ο κανόνας αφορά τα δέντρα **όπου κι αν κατέληξαν**·
 * 3. **συγχωνεύσεις** — δομή, ανεξάρτητη από το περιεχόμενο·
 * 4. **ακμές** — γεωμετρία, ανεξάρτητη κι αυτή·
 * 5. **επαναϋπολογισμός** — τελευταίος, γιατί διαβάζει ό,τι έγραψαν και τα τέσσερα.
 */
export function applyTableRangeTransfer(
  book: TableFormulaWorkbook,
  model: PersistedTableModel,
  plan: TableRangeTransferPlan,
): PersistedTableModel {
  const withContent = transferContent(model, plan).model;
  const withFormulas = plan.intent.copy
    ? offsetCopiedFormulas(book, withContent, plan).model
    : remapTableFormulaRefs(withContent, relocationOf(plan));
  const withMerges = transferMerges(withFormulas, plan);
  const withEdges = transferEdges(model, withMerges, plan);
  // 🔴 ADR-739 §50 — εδώ **δεν** αρκεί η εκκρεμότητα των δύο γραφέων, και είναι η μόνη
  // διαδρομή όπου δεν αρκεί: το `remapTableFormulaRefs` ξαναγράφει δέντρα τύπων **οπουδήποτε**
  // στον πίνακα (κάθε αναφορά που έδειχνε σε κελί που μετακόμισε), δηλαδή αγγίζει κελιά που
  // κανένας γραφέας κελιών δεν είδε. Το {@link touchedKeys} μένει γι' αυτόν ακριβώς τον λόγο
  // — και είναι ούτως ή άλλως **υπερσύνολο** των δύο εκκρεμοτήτων, αφού και οι δύο γράφουν
  // μόνο μέσα στα `plan.fills`.
  return recalculateTableModel(book, withEdges, touchedKeys(plan));
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Περιεχόμενο
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Το περιεχόμενο κάθε γεμίσματος, σε **ένα** πέρασμα του μαζικού γραφέα.
 *
 * Οι πηγές διαβάζονται **πάντα από το αρχικό μοντέλο**, ποτέ από το ενδιάμεσο αποτέλεσμα. Είναι
 * αυτό που κάνει το **επικαλυπτόμενο** σύρσιμο σωστό: μια περιοχή που σέρνεται πάνω στον εαυτό
 * της κατά ένα κελί διαβάζει παντού την **πριν** εικόνα, οπότε το αποτέλεσμα δεν εξαρτάται από
 * τη σειρά εφαρμογής. Η εναλλακτική — ανάγνωση από το τρέχον — θα έδινε το κλασικό «σβούρισμα»
 * όπου το πρώτο κελί αντιγράφεται σε ολόκληρη τη στήλη, και **μόνο** προς τη μία κατεύθυνση
 * σύρσης.
 */
function transferContent(
  model: PersistedTableModel,
  plan: TableRangeTransferPlan,
): PendingCellWrites {
  const before = resolveTableModel(model);
  const sources = new Map<string, TableCellRef | null>();
  for (const fill of plan.fills) sources.set(refKey(fill.at), fill.from);

  const sourceCellFor = (target: TableCellRef): TableCell | undefined => {
    const from = sources.get(refKey(target));
    return from === null || from === undefined ? undefined : getCell(before, from.rowId, from.colId);
  };

  return writePersistedCells(
    model,
    plan.fills.map((fill) => fill.at),
    {
      update: (existing, target) => {
        const next = transferredCell(sourceCellFor(target), existing);
        return sameTransferredCell(existing, next) ? null : next;
      },
      // Κελί που δεν υπάρχει και δεν παίρνει τίποτα δεν αποκτά εγγραφή-φάντασμα: ο αραιός
      // χάρτης σημαίνει ήδη «κενό» (η τέταρτη εγγύηση του `setPersistedCellText`).
      create: (target) => {
        const next = transferredCell(sourceCellFor(target), undefined);
        return isBlankCell(next) ? null : next;
      },
    },
  );
}

/**
 * 🔴 **Ο ΕΝΑΣ ΟΡΙΣΜΟΣ ΤΟΥ «ΤΙ ΤΑΞΙΔΕΥΕΙ»** — το κελί που προκύπτει: **ό,τι κουβαλά η πηγή**,
 * συν το `locked` του στόχου.
 *
 * Εξάγεται (ADR-754 Γ4) επειδή η **λαβή συμπλήρωσης** κάνει την ίδια ακριβώς ερώτηση: «τι από
 * το κελί-πηγή φτάνει στο κελί-στόχο;». Ένα δεύτερο αντίγραφο αυτού του αντικειμένου θα ήταν
 * το χειρότερο είδος διπλότυπου — δεν σπάει τη μεταγλώττιση όταν αποκλίνει, **χάνει δεδομένα
 * σιωπηλά**: αρκεί το ένα να ξεχάσει τα `runs` (ADR-753) για να ξεβάφεται κάθε συμπλήρωση.
 *
 * Πηγή `undefined` (κενή ή ρητό άδειασμα) ⇒ το κελί γίνεται **πραγματικά** κενό: φεύγουν τύπος,
 * παράκαμψη στυλ και διαγώνιοι. Είναι η σημασιολογία της **μετακίνησης**, όχι του `Delete`: στο
 * Excel, σέρνοντας ένα βαμμένο κελί αλλού, πίσω μένει κελί **χωρίς** το χρώμα. (Το `Delete` πάνω
 * σε περιοχή κάνει άλλο πράγμα και ζει αλλού — `clearTableRange`.)
 *
 * ## 🔴 ADR-753 Φ1 — γιατί τα `runs` ταξιδεύουν **μαζί με το `value`**, πάντα
 * Οι δείκτες τους δείχνουν σε θέσεις **αυτού** του κειμένου. Το κείμενο και η μορφοποίησή του
 * είναι ένα αδιαίρετο ζεύγος: αντιγραμμένο το πρώτο χωρίς το δεύτερο, η μετακίνηση μιας
 * βαμμένης περιοχής θα την ξέβαφε **σιωπηλά** — απώλεια δεδομένων χωρίς μήνυμα.
 */
export function transferredCell(
  source: TableCell | undefined,
  existing: TableCell | undefined,
  parts: TableTransferParts = 'all',
): TableCell {
  const locked = existing?.locked;
  const lockedField = locked === undefined ? {} : { locked };

  // «Μόνο μορφοποίηση»: το περιεχόμενο του **στόχου** επιβιώνει ακέραιο — μαζί με τον δεσμό
  // του, γιατί ένα δεμένο κελί επιτρέπεται να αλλάξει όψη· το βέτο του ADR-767 αφορά την
  // **τιμή**, όχι το χρώμα.
  if (parts === 'format') {
    const bound = existing?.bound;
    return {
      ...contentFields(existing),
      ...formatFields(source),
      ...(bound === undefined ? {} : { bound }),
      ...lockedField,
    };
  }

  // «Χωρίς μορφοποίηση»: ταξιδεύει το περιεχόμενο, ο στόχος κρατά τη δική του όψη.
  const style = parts === 'content' ? existing : source;
  return { ...contentFields(source), ...formatFields(style), ...lockedField };
}

/**
 * 🔴 ADR-828 §5 — **ΤΙ ΤΑΞΙΔΕΥΕΙ.** Το Excel προσφέρει «Συμπλήρωση μόνο μορφοποίησης» και
 * «Συμπλήρωση χωρίς μορφοποίηση»· και οι δύο είναι **αυτή** η ερώτηση, με άλλη απάντηση.
 *
 * ⚠️ Ζει εδώ και όχι στη λαβή επίτηδες. Η προειδοποίηση από πάνω — «κάθε πεδίο του
 * `TableCell` οφείλει να απαριθμείται» — γίνεται **τρεις φορές** επικίνδυνη μόλις οι λίστες
 * πεδίων γίνουν τρεις. Μία συνάρτηση με παράμετρο έχει ένα σημείο να ξεχάσει κανείς κάτι·
 * τρεις συναρτήσεις έχουν τρία, και το ξεχασμένο πεδίο δεν σπάει τη μεταγλώττιση.
 */
export type TableTransferParts = 'all' | 'content' | 'format';

/** Ό,τι **λέει** ένα κελί. Πηγή `undefined` ⇒ πραγματικά κενό, όχι «άφησέ το ως έχει». */
function contentFields(cell: TableCell | undefined): TableCell {
  if (cell === undefined) return { kind: 'text', value: '' };
  return {
    kind: cell.kind,
    value: cell.value,
    ...(cell.formula === undefined ? {} : { formula: cell.formula }),
    ...(cell.runs === undefined ? {} : { runs: cell.runs }),
  };
}

/** Ό,τι **δείχνει** ένα κελί. */
function formatFields(cell: TableCell | undefined): Partial<TableCell> {
  if (cell === undefined) return {};
  return {
    ...(cell.styleOverride === undefined ? {} : { styleOverride: cell.styleOverride }),
    ...(cell.diagonal === undefined ? {} : { diagonal: cell.diagonal }),
  };
}

/**
 * **Ο ΕΝΑΣ ΟΡΙΣΜΟΣ ΤΟΥ «ΚΕΝΟ»** — κελί χωρίς τίποτα να πει, που δεν αξίζει εγγραφή στη σκηνή.
 *
 * Εξάγεται μαζί με το {@link transferredCell} (ADR-754 Γ4) και για τον ίδιο λόγο: η **λαβή
 * συμπλήρωσης** κάνει την ίδια ερώτηση. Ένα αντίγραφό του το χαρακτήρισε το **CHECK 3.28**
 * (jscpd) ως sibling clone με το που γεννήθηκε — και σωστά, γιατί η προειδοποίηση από κάτω
 * ισχύει **δύο φορές** όταν οι λίστες πεδίων είναι δύο.
 *
 * ⚠️ **Κάθε πεδίο του `TableCell` οφείλει να απαριθμείται εδώ.** Ένα ξεχασμένο πεδίο δεν
 * δίνει σφάλμα μεταγλώττισης — δίνει **διαγραφή δεδομένων**: το κελί κρίνεται κενό και η
 * εγγραφή του πετιέται μαζί με ό,τι κουβαλούσε στο πεδίο που κανείς δεν κοίταξε. Η ίδια
 * προειδοποίηση είναι ήδη γραμμένη στο `table-row-column-ops.ts` για τον ίδιο λόγο.
 */
export function isBlankCell(cell: TableCell): boolean {
  return (
    cell.kind === 'text' &&
    cell.value === '' &&
    cell.formula === undefined &&
    cell.styleOverride === undefined &&
    cell.runs === undefined &&
    cell.diagonal === undefined &&
    cell.locked === undefined
  );
}

/**
 * Ίδιο κελί; Η σύγκριση των σύνθετων πεδίων γίνεται με `JSON`, **όπως ακριβώς** το
 * `setPersistedCellFormula` — και για τον ίδιο λόγο: είναι απλά δεδομένα, φτιαγμένα πάντα από
 * τον ίδιο παραγωγό, άρα με ίδια σειρά κλειδιών.
 *
 * ⚠️ Ο έλεγχος `a === b` **πρώτα** δεν είναι μικροβελτίωση: στη συνηθισμένη διαδρομή η
 * παράκαμψη στυλ περνά **by-reference** από την πηγή στον στόχο, οπότε η ταυτότητα απαντά χωρίς
 * να σειριοποιηθεί τίποτα.
 */
export function sameTransferredCell(a: TableCell, b: TableCell): boolean {
  return (
    a.kind === b.kind &&
    a.value === b.value &&
    a.locked === b.locked &&
    sameJson(a.formula, b.formula) &&
    sameJson(a.styleOverride, b.styleOverride) &&
    // ADR-753 Φ1 — ξεχασμένο εδώ, μια περιοχή που διαφέρει **μόνο** στη μορφοποίηση
    // χαρακτήρων θα κρινόταν «ίδια» και η μεταφορά της δεν θα γραφόταν ποτέ.
    sameJson(a.runs, b.runs) &&
    sameJson(a.diagonal, b.diagonal)
  );
}

function sameJson(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Τύποι
// ──────────────────────────────────────────────────────────────────────────────

/**
 * «Ποιο κελί πήγε πού», απευθείας από τα γεμίσματα — **καμία δεύτερη παραγωγή**.
 *
 * Το ίδιο σχέδιο που έγραψε το περιεχόμενο απαντά και στους τύπους, οπότε δεν υπάρχει τρόπος τα
 * δύο να διαφωνήσουν. Τα γεμίσματα που **αδειάζουν** (`from === null`) δεν μπαίνουν: κανένα
 * περιεχόμενο δεν ήρθε από εκεί.
 */
function relocationOf(plan: TableRangeTransferPlan): TableFormulaRefRelocation {
  const moved = new Map<CellKey, TableCellRef>();
  for (const fill of plan.fills) {
    if (fill.from === null) continue;
    moved.set(cellKey(fill.from.rowId, fill.from.colId), fill.at);
  }
  return moved;
}

/**
 * 🔴 ADR-754 Γ1 — **η αντιγραφή ΟΛΙΣΘΑΙΝΕΙ τις σχετικές αναφορές του αντιγράφου.**
 *
 * Αυτή η γραμμή έγραφε μέχρι το ADR-754 σκέτο `withContent`: το αντίγραφο κρατούσε τις ίδιες
 * αναφορές, δηλαδή **κάθε** τύπος συμπεριφερόταν σαν `$A$1`. Ήταν **δηλωμένη απόκλιση** από το
 * Excel (§36, καρφωμένη με test) και ήταν η **μόνη τίμια** επιλογή όσο ο τύπος δεν είχε τρόπο
 * να πει «εγώ είμαι κλειδωμένος»: μια καθολική ολίσθηση θα έσπαγε σιωπηλά την άλλη μισή
 * πρόθεση των χρηστών.
 *
 * Τώρα ο τύπος έχει τρόπο (`absoluteRow`/`absoluteCol`), οπότε η απόκλιση κλείνει — και
 * κλείνει **εδώ** και όχι μόνο στη λαβή συμπλήρωσης, γιατί το `Ctrl+σύρσιμο` είναι η **ίδια**
 * πράξη: «ξαναγράψε αυτόν τον τύπο αλλού». Δύο απαντήσεις στην ίδια ερώτηση θα σήμαιναν ότι το
 * `$` μετράει με τη λαβή και αγνοείται με το `Ctrl` — δηλαδή ότι το ίδιο σύμβολο σημαίνει δύο
 * πράγματα ανάλογα με τη χειρονομία.
 *
 * ⚠️ Η **πηγή** δεν αγγίζεται ποτέ: στην αντιγραφή δεν είναι στόχος κανενός γεμίσματος.
 */
function offsetCopiedFormulas(
  book: TableFormulaWorkbook,
  model: PersistedTableModel,
  plan: TableRangeTransferPlan,
): PendingCellWrites {
  const resolved = resolveTableModel(model);
  // Το σπίτι είναι το πλέγμα στο οποίο προσγειώνονται τα αντίγραφα· οι δια-φυλλικές αναφορές
  // κρατούν το δικό τους φύλλο και ολισθαίνουν πάνω στο **δικό εκείνου** πλέγμα.
  const here = bookWithHome(book, resolved);
  const shifts = new Map<string, TableFormulaOffset>();
  for (const fill of plan.fills) {
    if (fill.from === null) continue;
    const offset = tableFormulaOffsetBetween(resolved, fill.from, fill.at);
    if (offset && (offset.rows !== 0 || offset.columns !== 0)) shifts.set(refKey(fill.at), offset);
  }
  if (shifts.size === 0) return { model, written: [] };

  return writePersistedCells(
    model,
    plan.fills.map((fill) => fill.at),
    {
      update: (existing, target) => {
        const offset = shifts.get(refKey(target));
        if (offset === undefined || existing.formula === undefined) return null;
        const formula = offsetTableFormula(here, existing.formula, offset);
        return formula === existing.formula ? null : { ...existing, formula };
      },
      // Κελί χωρίς εγγραφή δεν έχει τύπο να ολισθήσει. Η **γέννηση** εγγραφών έγινε ήδη
      // ολόκληρη στο σκέλος 1· εδώ μόνο ξαναγράφονται δέντρα που ήδη προσγειώθηκαν.
      create: () => null,
    },
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Συγχωνεύσεις
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι συγχωνεύσεις μετά την πράξη: οι ταξιδεύουσες προσγειώνονται μετατοπισμένες, και στη
 * **μετακίνηση** φεύγουν από την πηγή.
 *
 * Στην **αντιγραφή** μένουν και οι δύο — ένα αντιγραμμένο συγχωνευμένο κελί είναι συγχωνευμένο
 * και στις δύο θέσεις, όπως στο Excel. Η αφαίρεση γίνεται με σύγκριση **ταυτότητας**
 * αντικειμένου (το σχέδιο κράτησε την αρχική αναφορά), όχι με δεύτερη «ίδιο εύρος;».
 */
function transferMerges(
  model: PersistedTableModel,
  plan: TableRangeTransferPlan,
): PersistedTableModel {
  if (plan.mergeMoves.length === 0) return model;

  const departing = new Set(plan.mergeMoves.map((move) => move.from));
  const kept = plan.intent.copy
    ? model.merges
    : model.merges.filter((span) => !departing.has(span));
  return { ...model, merges: [...kept, ...plan.mergeMoves.map((move) => move.to)] };
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Ρητές ακμές (ADR-750)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 **ΟΙ ΑΚΜΕΣ ΤΑΞΙΔΕΥΟΥΝ ΩΣ ΣΥΝΟΛΟ ΕΞΙ ΠΛΕΥΡΩΝ** — καμία νέα μηχανική ακμών.
 *
 * Η πηγή και ο προορισμός είναι **ίδιου σχήματος** ορθογώνια, οπότε η ίδια συνάρτηση
 * ({@link tableRangeSideEdges}, ο SSoT του ADR-750) απαριθμεί για καθένα τις ίδιες πλευρές στην
 * **ίδια σειρά**: η αντιστοίχιση είναι απλό ζευγάρωμα κατά δείκτη. Δεύτερος γραφέας ακμών ή
 * χειροποίητη επαναχαρτογράφηση κλειδιών θα ήταν η «τέταρτη μηχανή πίνακα» με άλλο όνομα.
 *
 * ## Γιατί η πηγή **διαγράφεται** και δεν σβήνεται
 * `null` στο {@link setTableEdges} σημαίνει «ξέχνα ό,τι όρισα εδώ» — επιστροφή στην κληρονομιά
 * του στυλ — ενώ το `HIDDEN_TABLE_EDGE` σημαίνει «εδώ ρητά **δεν** υπάρχει γραμμή» (ADR-750
 * Α14). Η περιοχή **έφυγε**· δεν άφησε πίσω της εντολή αοράτου, άφησε **τίποτα**. Η άλλη επιλογή
 * θα κληροδοτούσε αόρατο πλέγμα σε κάθε μετακίνηση, δηλαδή θα αναπαρήγαγε το παράπονο Π3 του
 * ADR-750 («η γραμμή δεν φεύγει») από την πίσω πόρτα.
 *
 * ## Η σειρά των δύο περασμάτων **είναι** η ορθότητα
 * Πρώτα όλες οι διαγραφές της πηγής, **μετά** όλες οι εγγραφές του προορισμού. Σε επικαλυπτόμενο
 * σύρσιμο τα δύο σύνολα κλειδιών τέμνονται, και ένα μοναδικό αναμεμειγμένο πέρασμα θα άφηνε το
 * αποτέλεσμα να εξαρτάται από τη σειρά των πλευρών — δηλαδή σφάλμα ορατό μόνο σε μία κατεύθυνση.
 *
 * ⚠️ **Μετρημένο όριο**: στην **ολίσθηση** ταξιδεύουν οι ακμές της **περιοχής**, όχι όσων
 * σπρώχτηκαν. Μια ακμή είναι **μοιρασμένη** ανάμεσα σε δύο γειτονικά κελιά (ADR-750 §6), οπότε
 * μια μερική μετάθεση λωρίδας δεν έχει καθορισμένη απάντηση για την κατακόρυφη ακμή της οποίας
 * οι δύο πλευρές κινούνται διαφορετικά. Δηλώνεται εδώ αντί να ανακαλυφθεί στην οθόνη.
 */
function transferEdges(
  source: PersistedTableModel,
  model: PersistedTableModel,
  plan: TableRangeTransferPlan,
): PersistedTableModel {
  const index = buildTableEdgeIndex(source.edges);
  const patches = new Map<TableEdgeKey, TableBorderSpec | null>();

  if (!plan.intent.copy) {
    for (const side of TABLE_BORDER_EVERY_SIDE) {
      for (const key of tableRangeSideEdges(source, plan.source, side)) patches.set(key, null);
    }
  }

  for (const side of TABLE_BORDER_EVERY_SIDE) {
    const from = tableRangeSideEdges(source, plan.source, side);
    const to = tableRangeSideEdges(source, plan.destination, side);
    if (from.length !== to.length) continue; // αμυντικό: μπαγιάτικα όρια — καμία μισή χαρτογράφηση
    for (let i = 0; i < from.length; i++) patches.set(to[i], index.get(from[i]) ?? null);
  }

  return setTableEdges(model, patches);
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Επαναϋπολογισμός
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τα κελιά που άγγιξε η πράξη — η είσοδος του επαναϋπολογισμού.
 *
 * Μόνο οι **στόχοι**: οι πηγές είτε είναι και στόχοι (μετακίνηση), είτε έμειναν αναλλοίωτες
 * (αντιγραφή). Ο γράφος εξαρτήσεων ανοίγει από εκεί και μόνος του — ένας πίνακας 500 γραμμών δεν
 * ξαναϋπολογίζεται επειδή ο χρήστης έσυρε δύο κελιά (`table-formula-recalc.ts`).
 */
function touchedKeys(plan: TableRangeTransferPlan): readonly CellKey[] {
  return plan.fills.map((fill) => cellKey(fill.at.rowId, fill.at.colId));
}

/** Ίδιο τοπικό κλειδί με το σχέδιο — δες εκεί γιατί δεν περνά από το branded `cellKey()`. */
function refKey(ref: TableCellRef): string {
  return `${ref.rowId} ${ref.colId}`;
}
