/**
 * 🔴 ADR-753 Φ4 — **μορφοποίηση σε ΧΑΡΑΚΤΗΡΕΣ ενός κελιού**: ο **τρίτος** αδελφός των
 * `table-axis-style-ops.ts` (γραμμή/στήλη) και `table-range-style-ops.ts` (ορθογώνιο κελιών).
 *
 * ```
 *   άξονας    →  TableRow / TableColumn.styleOverride     (table-axis-style-ops)
 *   περιοχή   →  Ν × TableCell.styleOverride              (table-range-style-ops)
 *   γράμματα  →  TableCell.runs  ── ΕΔΩ ──                (ADR-753)
 * ```
 *
 * ## Τι ΔΕΝ ζει εδώ, και γιατί
 * Οι **καθαρές πράξεις πάνω σε runs** ζουν ολόκληρες στο `table-cell-run-ops.ts` (ADR-753 Φ1):
 * ξεδίπλωμα, κανονικοποίηση, συγχώνευση ίσων γειτόνων, μετατόπιση δεικτών. Αυτό το αρχείο δεν
 * ξέρει τίποτα από αυτά — κάνει **μόνο** τη μετάφραση που λείπει: από «ταυτότητα κελιού μέσα σε
 * μοντέλο» σε «ο πίνακας runs εκείνου του κελιού», με τις ίδιες τέσσερις εγγυήσεις του γραφέα
 * κελιών. Ίδια ακριβώς διαίρεση με τον αδελφό της περιοχής, που επίσης δανείζεται την
 * ανάγνωσή του από το `table-cell-style-scan.ts`.
 *
 * ## 🔴 Η ΚΛΗΡΟΝΟΜΙΑ ΕΙΝΑΙ ΤΟ ΚΕΛΙ — και γι' αυτό ταξιδεύει ως ΟΡΙΣΜΑ
 * Ένα run δηλώνει **μόνο ό,τι διαφέρει**. Η ερώτηση «είναι έντονα αυτά τα γράμματα;» δεν
 * απαντιέται από τα runs μόνα τους: χωρίς δήλωση, τα γράμματα είναι ό,τι λέει το **επιλυμένο
 * στυλ του κελιού** — που με τη σειρά του κληρονομεί από γραμμή, στήλη και κλάση. Η αλυσίδα
 * αυτή έχει ήδη **έναν** επιλυτή· ξαναρωτημένη εδώ θα ήταν δεύτερη απάντηση στο ίδιο ερώτημα.
 * Γι' αυτό η κατάσταση του κελιού μπαίνει **από έξω** ({@link resolveCellRunState}), αντί να
 * υπολογιστεί μέσα.
 *
 * @module subapps/dxf-viewer/bim/table/table-chars-style-ops
 * @see bim/table/table-cell-run-ops.ts — οι καθαρές πράξεις πάνω στα runs (ADR-753 Φ1)
 * @see bim/table/table-format-scope.ts — ο ΕΝΑΣ δρόμος που διαλέγει ανάμεσα στους τρεις στόχους
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §22
 */

import { cellText, writePersistedCellStyles } from './table-cell-content';
import {
  clearCellRunStyles,
  isTableTextRunStyleKey,
  setCellRunStyleField,
  type TableTextAnchoredRange,
  type TableTextRange,
  type TableTextRunNumericKey,
  type TableTextRunStyleKey,
} from './table-cell-run-ops';
import {
  cellRunNumericRange,
  hasCellRunStyles,
  resolveCellRunFormat,
} from './table-cell-run-state';
import { cellKey, resolveTableModel } from './table-model-helpers';
import type { TableCellRef } from './table-cell-range';
import type {
  TableCellStyleKey,
  TableFormatState,
  TableNumericRange,
} from './table-cell-style-scan';
import type { TableCellStyle } from './table-style';
import type { PersistedTableModel, TableCell, TableTextRunStyle } from '../../types/table';

/**
 * 🔴 **Η ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΑ ΔΥΟ ΛΕΞΙΛΟΓΙΑ ΣΥΜΦΩΝΟΥΝ** — ελεγμένη από τον μεταγλωττιστή.
 *
 * Τα κοινά πεδία κελιού και run περιγράφονται σε **δύο** τύπους ({@link TableCellStyle} και
 * {@link TableTextRunStyle}), γιατί απαντούν σε άλλο επίπεδο: το πρώτο είναι **επιλυμένο**
 * (κάθε πεδίο έχει τιμή), το δεύτερο **δηλωτικό** (μόνο ό,τι διαφέρει, άρα προαιρετικό). Οι
 * τιμές τους όμως οφείλουν να είναι **οι ίδιες**: αλλιώς «έντονα» στο ένα επίπεδο θα σήμαινε
 * κάτι άλλο στο άλλο.
 *
 * Ο τύπος αυτός δεν χρησιμοποιείται πουθενά — και **αυτός είναι ο ρόλος του**: την ημέρα που
 * τα δύο λεξιλόγια αποκλίνουν σε ένα κοινό πεδίο, εδώ γεννιέται `never` και η μεταγλώττιση
 * σπάει. Είναι η ίδια κίνηση με το `RUN_STYLE_KEY_SET`: **καμία χειρόγραφη υπόσχεση που
 * κανείς δεν διασταυρώνει.** Χωρίς αυτόν, οι δύο ρητές μετατροπές παρακάτω θα ήταν ευχή.
 */
type _RunAndCellValuesAgree = {
  [K in TableCellStyleKey & TableTextRunStyleKey]:
  TableTextRunStyle[K] extends TableCellStyle[K] | undefined ? true : never;
};

/** Ό,τι μπορεί να απαντήσει ένα πεδίο του επιλυμένου στυλ — η ένωση, για τις μη γενικές όψεις. */
type TableCellStyleValue = TableCellStyle[TableCellStyleKey];

// ──────────────────────────────────────────────────────────────────────────────
// Εγγραφή
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Θέτει **ένα** πεδίο στους χαρακτήρες ενός εύρους, μέσα σε **ένα** κελί.
 *
 * ## Οι δύο εγγυήσεις που κληρονομεί από τον γραφέα κελιών
 * - **Ταυτότητα by-reference στο no-op**: την κρατά ήδη το {@link setCellRunStyleField} (ίδιος
 *   πίνακας ⇒ ίδιο κελί ⇒ ίδιο μοντέλο), οπότε «Β» πάνω σε ήδη έντονη επιλογή δεν γεννά βήμα
 *   αναίρεσης.
 * - **Καμία εγγραφή-φάντασμα**: κελί που δεν υπάρχει **δεν** αποκτά εγγραφή. Και δεν είναι
 *   επιλογή ρυθμού: κελί που δεν υπάρχει δεν έχει **κείμενο**, άρα δεν έχει χαρακτήρες να
 *   βαφτούν — ένα run πάνω σε κενό κείμενο θα έδειχνε στο πουθενά και θα επιβίωνε στο JSON.
 *
 * ⚠️ Το μήκος διαβάζεται από το **αποθηκευμένο** κείμενο του κελιού και ποτέ από τον καλούντα:
 * το εύρος έρχεται από ένα πεδίο του DOM, και η μόνη άμυνα απέναντι σε μπαγιάτικους δείκτες
 * είναι να τους κόψει η **αλήθεια του μοντέλου** (`clampRange`). Ο συγχρονισμός των δύο
 * κειμένων είναι ευθύνη του καλούντος — δες `ui/table-cell-editor/table-text-draft-sync.ts`.
 *
 * 🔴 ADR-753 §25 — **και επαληθεύεται**: το εύρος είναι {@link TableTextAnchoredRange}, δηλαδή
 * κουβαλά τη βάση του, και ο {@link writeRuns} αρνείται όταν αυτή δεν είναι το κείμενο του
 * κελιού. Το clamp μόνο του **δεν αρκεί**: κόβει δείκτες που ξεφεύγουν, όχι δείκτες που
 * **χωράνε και δείχνουν αλλού**.
 */
export function setCellRunField(
  model: PersistedTableModel,
  ref: TableCellRef,
  range: TableTextAnchoredRange,
  key: TableTextRunStyleKey,
  value: TableTextRunStyle[TableTextRunStyleKey],
): PersistedTableModel {
  return writeRuns(model, ref, range, (cell, textLength) =>
    setCellRunStyleField(cell.runs, textLength, range, key, value));
}

/**
 * Σβήνει **κάθε** ρητή μορφοποίηση των επιλεγμένων χαρακτήρων — η «Απαλοιφή» του Excel,
 * περιορισμένη στα γράμματα.
 *
 * ⚠️ **ΔΕΝ αγγίζει το `styleOverride` του κελιού**, και είναι ο ίδιος κανόνας με τον αδελφό
 * της περιοχής που δεν αγγίζει ποτέ άξονα: ο χρήστης έδειξε **γράμματα**. Ρητή —και
 * αποδεκτή— συνέπεια: μετά την απαλοιφή τα γράμματα μπορεί να φαίνονται ακόμη έντονα, επειδή
 * το λέει το κελί, η γραμμή ή η κλάση της.
 */
export function clearCellRunRange(
  model: PersistedTableModel,
  ref: TableCellRef,
  range: TableTextAnchoredRange,
): PersistedTableModel {
  return writeRuns(model, ref, range, (cell, textLength) =>
    clearCellRunStyles(cell.runs, textLength, range));
}

// ──────────────────────────────────────────────────────────────────────────────
// Ανάγνωση
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Δηλώνουν οι επιλεγμένοι χαρακτήρες **οτιδήποτε** ρητά; — η ερώτηση της «Απαλοιφής».
 *
 * `some`, όχι `every`, για τον **ίδιο** λόγο με το `hasAnyRangeStyleOverride`: η ερώτηση είναι
 * «υπάρχει τι να επαναφερθεί;», και με ένα βαμμένο γράμμα στα είκοσι η απάντηση είναι ναι.
 */
export function hasCellRunRangeStyles(
  model: PersistedTableModel,
  ref: TableCellRef,
  range: TableTextRange,
): boolean {
  const cell = cellAt(model, ref);
  return cell === undefined
    ? false
    : hasCellRunStyles(cell.runs, cellText(cell).length, range);
}

/**
 * 🔴 Τι δείχνει ένα χειριστήριο για **αυτά τα γράμματα** — με την κατάσταση του κελιού ως βάση.
 *
 * ## Γιατί είναι ΟΛΙΚΗ και δέχεται κάθε πεδίο
 * Το `align` και το `fillColorHex` **δεν έχουν** νόημα ανά χαρακτήρα (δες
 * {@link isTableTextRunStyleKey}: η τομή είναι ο ΕΝΑΣ ορισμός του «ποια πεδία είναι πεδία
 * run»). Για αυτά η σωστή απάντηση δεν είναι «τίποτα» — είναι **η απάντηση του κελιού**,
 * αυτούσια: το γέμισμα ενός κελιού είναι το γέμισμα του κελιού, όποια γράμματα κι αν δείχνει ο
 * χρήστης. Είναι και η συμπεριφορά του Excel, μετρημένη: σε λειτουργία επεξεργασίας με
 * μαρκαρισμένα γράμματα, το χρώμα γραμματοσειράς βάφει **τα γράμματα** και το κουβαδάκι
 * βάφει **το κελί**.
 *
 * Ένας φρουρός στον καλούντα («ρώτα με μόνο για πεδία run») θα ήταν προϋπόθεση που κάθε νέα
 * επιφάνεια οφείλει να θυμάται — δηλαδή η πρώτη που θα την ξεχνούσε θα έπαιρνε σιωπηλά
 * «κληρονομιά» για κάτι που υπάρχει.
 */
export function resolveCellRunState(
  model: PersistedTableModel,
  ref: TableCellRef,
  range: TableTextRange,
  key: TableCellStyleKey,
  inherited: TableFormatState<TableCellStyleValue>,
): TableFormatState<TableCellStyleValue> {
  if (!isTableTextRunStyleKey(key)) return inherited;
  const cell = cellAt(model, ref);
  if (cell === undefined) return inherited;

  // 🔴 Η κληρονομιά είναι **η κοινή τιμή του κελιού**, και σε μεικτή περίπτωση δεν υπάρχει —
  // αλλά ο στόχος εδώ είναι **ένα** κελί, οπότε το `mixed` του δεν μπορεί να είναι αληθές.
  // Η μετατροπή είναι ασφαλής επειδή τα δύο λεξιλόγια συμφωνούν στην τιμή κάθε κοινού πεδίου
  // ({@link _RunAndCellValuesAgree}) — και **μόνο** γι' αυτόν τον λόγο.
  return resolveCellRunFormat(
    cell.runs,
    cellText(cell).length,
    range,
    key,
    inherited.value as TableTextRunStyle[TableTextRunStyleKey],
  ) as TableFormatState<TableCellStyleValue>;
}

/**
 * Τα άκρα μιας **αριθμητικής** ιδιότητας πάνω στους επιλεγμένους χαρακτήρες — ό,τι χρειάζεται
 * το βήμα μεγέθους για να ξέρει *από πού* ξεκινά.
 *
 * `null` όταν το κελί δεν υπάρχει ή κανένας χαρακτήρας δεν κοιτάχτηκε: ο καλών **δεν γράφει**,
 * ποτέ δεν μαντεύει αφετηρία.
 */
export function cellRunNumericRangeAt(
  model: PersistedTableModel,
  ref: TableCellRef,
  range: TableTextRange,
  /**
   * ⚠️ Το πεδίο **περνά ως όρισμα** και δεν γράφεται εδώ ως `'textHeightMm'`: σήμερα η τομή
   * «αριθμητικό πεδίο κελιού» × «πεδίο run» έχει **ένα** μέλος, αλλά ένα καρφωμένο όνομα θα
   * ήταν σιωπηλά λάθος τη μέρα που αποκτήσει δεύτερο — και ο μεταγλωττιστής δεν θα το έλεγε.
   */
  key: TableTextRunNumericKey,
  inherited: number,
): TableNumericRange | null {
  const cell = cellAt(model, ref);
  if (cell === undefined) return null;
  return cellRunNumericRange(cell.runs, cellText(cell).length, range, key, inherited);
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/** Το αποθηκευμένο κελί, μέσα από τον **επιλυμένο** χάρτη· `undefined` όταν είναι κενό. */
function cellAt(model: PersistedTableModel, ref: TableCellRef): TableCell | undefined {
  return resolveTableModel(model).cells.get(cellKey(ref.rowId, ref.colId));
}

/**
 * Ο κοινός σκελετός κάθε εγγραφής: **επαλήθευσε τη βάση**, πάρε τα runs, άφησε τον καλούντα να
 * τα μετασχηματίσει, γράψε **μόνο** αν άλλαξαν.
 *
 * ## 🔴 ADR-753 §25 — Η ΕΠΑΛΗΘΕΥΣΗ ΤΗΣ ΒΑΣΗΣ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΕΔΩ
 * Αυτό είναι το **ένα** σημείο όπου η ερώτηση «σε ποιο κείμενο δείχνουν αυτοί οι δείκτες;»
 * αποκτά απάντηση από το μοντέλο ({@link cellText}). Άρα είναι και το μόνο σημείο που μπορεί
 * να τη **συγκρίνει** με τη βάση που δήλωσε ο καλών. Ο έλεγχος γραμμένος στον καλούντα θα
 * ήταν προϋπόθεση που κάθε νέα επιφάνεια οφείλει να θυμάται — και η πρώτη που θα την ξεχνούσε
 * θα έβαφε σιωπηλά **άλλα γράμματα**, μία κίνηση μακριά από την αιτία (§25).
 *
 * ⚠️ **Άρνηση, όχι εξαίρεση, και όχι «κάνε ό,τι μπορείς».** Δείκτες πάνω σε άλλο κείμενο δεν
 * είναι «σχεδόν σωστοί»· δείχνουν αλλού — η ίδια σύμβαση με το `isStaleTableTextSelection`
 * («μπαγιάτικο ⇒ σιωπή»). Το `clampRange` **δεν** καλύπτει αυτό: κόβει δείκτες που **ξεφεύγουν**
 * από το μήκος, ενώ εδώ το πρόβλημα είναι δείκτες που **χωράνε** και δείχνουν σε λάθος γράμματα.
 *
 * ⚠️ Ο κανόνας ισχύει **μόνο για τις εγγραφές**. Οι αναγνώσεις (τι δείχνει το κουμπί) μένουν
 * σκόπιμα με σκέτο clamp: εκεί μια μικρή απόκλιση —π.χ. ένας χαρακτήρας που προστέθηκε στο
 * **τέλος** του προχείρου— αφήνει τους δείκτες να δείχνουν στα ίδια γράμματα, και μια άρνηση θα
 * αντικαθιστούσε μια **σωστή** ένδειξη με την κληρονομιά του κελιού.
 *
 * ⚠️ Το `runs` **αφαιρείται** αντί να τεθεί `undefined` όταν δεν έμεινε τίποτα — η ίδια
 * απόφαση με το `asTextCell` της Φ.Ζ: ένα πεδίο με τιμή `undefined` επιβιώνει σε
 * `Object.keys` και σε diff, και θα εμφανιζόταν σε κάθε αποθηκευμένη σκηνή ως αλλαγή που
 * κανείς δεν έκανε.
 */
function writeRuns(
  model: PersistedTableModel,
  ref: TableCellRef,
  range: TableTextAnchoredRange,
  next: (cell: TableCell, textLength: number) => TableCell['runs'],
): PersistedTableModel {
  return writePersistedCellStyles(model, [{ rowId: ref.rowId, colId: ref.colId }], {
    update: (existing) => {
      const text = cellText(existing);
      if (text !== range.text) return null;
      const runs = next(existing, text.length);
      if (runs === existing.runs) return null;
      const { runs: _dropped, ...rest } = existing;
      return runs === undefined ? rest : { ...rest, runs };
    },
    // Δες την κεφαλίδα του {@link setCellRunField}: κελί χωρίς κείμενο δεν έχει χαρακτήρες.
    create: () => null,
  });
}
