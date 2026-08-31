/**
 * ADR-739 Φ.Ζ — **ο αξιολογητής**: δέντρο + πλέγμα → τιμή. Καθαρή συνάρτηση· δεν διαβάζει
 * μοντέλο μόνος του και δεν γράφει πουθενά.
 *
 * ## Δεν ξέρει από «κελιά», ρωτά
 * Η τιμή μιας αναφοράς έρχεται από το {@link TableFormulaScope.valueAt} που δίνει ο καλών.
 * Έτσι ο επαναϋπολογισμός μπορεί να απαντά με **ήδη υπολογισμένα** αποτελέσματα της ίδιας
 * παρτίδας (τοπολογική σειρά) αντί για μπαγιάτικες αποθηκευμένες τιμές — χωρίς αυτό, ένα
 * `=B1*2` πάνω σε `B1==SUM(...)` θα διάβαζε την **προηγούμενη** τιμή του `B1` και ο πίνακας
 * θα χρειαζόταν δεύτερο πέρασμα για να συγκλίνει (το κλασικό ελάττωμα «σωστό μετά από δύο
 * Enter»).
 *
 * ## Η `IF` είναι **ειδική μορφή**, όχι εγγραφή του μητρώου
 * Το `=IF(A1=0, 0, 1/A1)` είναι ο πιο συνηθισμένος τύπος σε πίνακα ποσοτήτων: ο φύλακας
 * διαίρεσης. Αν η `IF` ήταν κανονική συνάρτηση, τα ορίσματα θα αξιολογούνταν **πριν** την
 * κλήση, το `1/A1` θα έδινε `#DIV/0!` και ο φύλακας θα προστάτευε από το τίποτα. Μόνο ο
 * αξιολογητής μπορεί να **μην** αξιολογήσει έναν κλάδο — γι' αυτό η απόφαση γίνεται εδώ, ενώ
 * οι ίδιες οι έξι ειδικές μορφές ζουν στο `table-formula-special-forms.ts` (§49).
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-eval
 * @see bim/table/formula/table-formula-functions.ts — το μητρώο (όλες οι υπόλοιπες)
 * @see bim/table/formula/table-formula-special-forms.ts — οι έξι που δεν χωρούν στο μητρώο
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9
 */

import type {
  TableFormula,
  TableFormulaBinaryOp,
  TableFormulaCellRef,
  TableFormulaNode,
} from '../../../types/table-formula';
import { cellPairIndices } from '../table-cell-order';
import { isLiveCellRef } from './table-formula-ref-scope';
import {
  gridOfRef,
  sameSheetRefs,
  type TableFormulaWorkbook,
} from './table-formula-workbook';
import { TABLE_FORMULA_FUNCTIONS } from './table-formula-functions';
import { TABLE_FORMULA_SPECIAL_FORMS } from './table-formula-special-forms';
import {
  cellValueToNumber,
  compareValues,
  FORMULA_ERROR,
  firstError,
  isComparisonOperator,
  isFormulaError,
  valueToNumber,
  valueToText,
  type TableFormulaArgument,
  type TableFormulaValue,
} from './table-formula-value';

/**
 * Τι χρειάζεται ο αξιολογητής από τον κόσμο έξω από αυτόν.
 *
 * 🔴 ADR-833 Φάση 7 — ήταν `model: TableModel` και έγινε **βιβλίο**. Δεν είναι μετονομασία:
 * ένα `=Φύλλο2!A1` σημαίνει ότι η ίδια αξιολόγηση αγγίζει **δύο** πλέγματα, και ο αξιολογητής
 * δεν επιτρέπεται να μαντέψει ποιο. Το «απόν φύλλο ⇒ το σπίτι μου» το απαντά ο ΕΝΑΣ επιλυτής
 * ({@link gridOfRef}), ποτέ ο κάθε κόμβος μόνος του.
 */
export interface TableFormulaScope {
  readonly book: TableFormulaWorkbook;
  /** Η τιμή ενός κελιού **τώρα** — κενό αλφαριθμητικό για κελί που δεν υπάρχει. */
  readonly valueAt: (cell: TableFormulaCellRef) => TableFormulaValue;
}

/** Το αποτέλεσμα ενός αποθηκευμένου τύπου. */
export function evaluateTableFormula(
  scope: TableFormulaScope,
  formula: TableFormula,
): TableFormulaValue {
  return finalize(evaluateNode(scope, formula.root));
}

/**
 * 🔴 Η **τελική** μετατροπή — και ο λόγος που γίνεται μόνο στη ρίζα.
 *
 * Το κελί μας κρατά κείμενο: το `10` είναι `'10'`. Ένα σκέτο `=A1` θα αποθήκευε λοιπόν
 * **αλφαριθμητικό**, και η στήλη θα στοιχιζόταν σαν περιγραφή ενώ ο επόμενος τύπος θα το
 * ξαναδιάβαζε ως κείμενο — ο αριθμός θα ήταν αριθμός παντού εκτός από εκεί που φαίνεται.
 *
 * Ενδιάμεσα **δεν** μετατρέπεται, γιατί το κενό είναι διφορούμενο **κατά πρόθεση**: σε
 * αριθμητική πράξη είναι `0`, σε συνένωση είναι `''` (`=A3&"x"` δίνει `x`, όχι `0x`). Η
 * ασάφεια είναι πραγματική και τη λύνει το **περιβάλλον χρήσης** — όπως σε κάθε φύλλο
 * υπολογισμού. Στη ρίζα δεν υπάρχει περιβάλλον, οπότε ισχύει ο κανόνας του Excel: ένας
 * τύπος που δίνει κενό **δείχνει μηδέν**.
 */
function finalize(value: TableFormulaValue): TableFormulaValue {
  if (typeof value !== 'string' || isFormulaError(value)) return value;
  if (value.trim() === '') return 0;
  return cellValueToNumber(value) ?? value;
}

function evaluateNode(scope: TableFormulaScope, node: TableFormulaNode): TableFormulaValue {
  switch (node.kind) {
    case 'number':
    case 'text':
    case 'boolean':
      return node.value;
    case 'error':
      return node.code;
    case 'ref':
      return scope.valueAt(node.cell);
    case 'range':
      // Ένα εύρος δεν είναι τιμή: `=A1:A5+1` δεν σημαίνει τίποτα. Μόνο μια συνάρτηση μπορεί
      // να το δεχτεί, και το κάνει μέσω του `evaluateArgument`.
      return FORMULA_ERROR.value;
    case 'group':
      // Η παρένθεση είναι **γραφή**, όχι πράξη: η προτεραιότητα ζει ήδη στο σχήμα του
      // δέντρου. Δες `types/table-formula.ts` για το γιατί φυλάσσεται παρ' όλα αυτά.
      return evaluateNode(scope, node.inner);
    case 'unary':
      return evaluateUnary(scope, node.op, node.operand);
    case 'binary':
      return evaluateBinary(scope, node);
    case 'call':
      return evaluateCall(scope, node);
    // 🔴 ADR-765 — **εδώ** κρίνεται το γυμνό όνομα, όχι στον αναλυτή. Ο ίδιος κωδικός με την
    // άγνωστη συνάρτηση (γρ. 176): μία έννοια —«αυτό το όνομα δεν ορίστηκε»— ένας κωδικός,
    // ακριβώς όπως σε Excel, Google Sheets και LibreOffice. Το ADR-764 §2 έλυσε την ίδια
    // μορφή ερώτησης για το `#REF!` και κατέληξε στον αξιολογητή, για τον ίδιο λόγο.
    case 'name':
      return FORMULA_ERROR.name;
    // 🔴 ADR-765 — το παραλειπόμενο όρισμα είναι **η ίδια διφορούμενη κενή τιμή** που δίνει
    // ένα άδειο κελί: `0` σε αριθμητική, `''` σε συνένωση. Δες την τεκμηρίωση του
    // {@link finalize} — η ασάφεια είναι κατά πρόθεση και τη λύνει το περιβάλλον χρήσης.
    case 'blank':
      return '';
  }
}

function evaluateUnary(
  scope: TableFormulaScope,
  op: '+' | '-',
  operand: TableFormulaNode,
): TableFormulaValue {
  const value = evaluateNode(scope, operand);
  if (isFormulaError(value)) return value;
  const numeric = valueToNumber(value);
  if (numeric === null) return FORMULA_ERROR.value;
  return op === '-' ? -numeric : numeric;
}

function evaluateBinary(
  scope: TableFormulaScope,
  node: Extract<TableFormulaNode, { kind: 'binary' }>,
): TableFormulaValue {
  const left = evaluateNode(scope, node.left);
  if (isFormulaError(left)) return left;
  const right = evaluateNode(scope, node.right);
  if (isFormulaError(right)) return right;

  if (node.op === '&') return valueToText(left) + valueToText(right);
  if (isComparisonOperator(node.op)) return compareValues(node.op, left, right);
  return arithmetic(node.op, left, right);
}

/** Οι τέσσερις πράξεις και η δύναμη, με τα δύο σφάλματα που μπορούν να προκύψουν. */
function arithmetic(
  op: TableFormulaBinaryOp,
  left: TableFormulaValue,
  right: TableFormulaValue,
): TableFormulaValue {
  const a = valueToNumber(left);
  const b = valueToNumber(right);
  if (a === null || b === null) return FORMULA_ERROR.value;

  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? FORMULA_ERROR.divideByZero : a / b;
    case '^': {
      const power = a ** b;
      return Number.isFinite(power) ? power : FORMULA_ERROR.number;
    }
    default: return FORMULA_ERROR.value;
  }
}

/**
 * Κλήση συνάρτησης — με τις **ειδικές μορφές** να κόβονται πριν αξιολογηθεί οτιδήποτε.
 *
 * Οι δύο φύλακες που ακολουθούν δεν είναι ίδιοι:
 * - Η **ειδική μορφή** παίρνει τα ορίσματα **ανώτατα** και αποφασίζει η ίδια τι θα αξιολογήσει.
 * - Η **διαφανής στα σφάλματα** παίρνει αξιολογημένα ορίσματα, αλλά χωρίς την αυτόματη
 *   διάδοση: αλλιώς η `ISERROR` δεν θα καλούνταν ποτέ πάνω σε σφάλμα.
 */
function evaluateCall(
  scope: TableFormulaScope,
  node: Extract<TableFormulaNode, { kind: 'call' }>,
): TableFormulaValue {
  const special = TABLE_FORMULA_SPECIAL_FORMS[node.name];
  if (special !== undefined) return special((child) => evaluateNode(scope, child), node.args);

  const entry = TABLE_FORMULA_FUNCTIONS[node.name];
  if (entry === undefined) return FORMULA_ERROR.name;

  const args = node.args.map((arg) => evaluateArgument(scope, arg));
  if (entry.errorTransparent === true) return entry.call(args);
  return firstError(args) ?? entry.call(args);
}

/**
 * Ένα όρισμα: το εύρος γίνεται **λίστα**, όλα τα άλλα μία τιμή.
 *
 * Οι παρενθέσεις ξεφλουδίζονται πρώτα: το `=SUM((A1:A3))` είναι το ίδιο εύρος με το
 * `=SUM(A1:A3)`, και χωρίς αυτό ο κόμβος γραφής θα άλλαζε **αποτέλεσμα** — ακριβώς αυτό που
 * υπόσχεται να μην κάνει.
 */
function evaluateArgument(scope: TableFormulaScope, node: TableFormulaNode): TableFormulaArgument {
  const bare = unwrapGroups(node);
  if (bare.kind !== 'range') return { kind: 'value', value: evaluateNode(scope, bare) };

  // 🔴 ADR-764 — **άκρο που έσβησε ⇒ `#REF!`, όχι κενό εύρος.** Ο εκτυπωτής το λέει ήδη έτσι
  // («ένα εύρος με ένα άκρο άγνωστο δεν είναι μισό εύρος, είναι άγνωστο εύρος»), αλλά ο
  // αξιολογητής έπαιρνε κενή λίστα και το `=SUM(A2:A3)` πάνω σε σβησμένες γραμμές έδινε
  // **`0`** — αριθμός που κανείς δεν μέτρησε (ADR-720), τη στιγμή που η γραμμή τύπων δίπλα
  // του έγραφε `#REF!`. Η κανονική συρρίκνωση του Excel έχει ήδη γίνει πριν φτάσουμε εδώ
  // (`table-formula-structural-heal.ts`): ό,τι μένει νεκρό, είναι πράγματι νεκρό.
  //
  // 🔴 ADR-833 Φάση 7 — και **τρίτος** τρόπος να είναι νεκρό ένα άκρο: το φύλλο του να μην
  // υπάρχει πια. Το `isLiveCellRef` τον καλύπτει ήδη (η ίδια ραφή, ADR-764 §2), οπότε εδώ
  // δεν προστέθηκε **καμία** γραμμή γι' αυτόν.
  if (!isLiveCellRef(scope.book, bare.from) || !isLiveCellRef(scope.book, bare.to)) {
    return { kind: 'value', value: FORMULA_ERROR.reference };
  }

  const { cells, rows, cols } = expandRangeShape(scope.book, bare.from, bare.to);
  return { kind: 'list', values: cells.map((cell) => scope.valueAt(cell)), rows, cols };
}

/** Ό,τι μένει όταν αφαιρεθούν οι ρητές παρενθέσεις. */
function unwrapGroups(node: TableFormulaNode): TableFormulaNode {
  let current = node;
  while (current.kind === 'group') current = current.inner;
  return current;
}

/**
 * Τα κελιά ενός εύρους, σε σειρά γραμμή × στήλη. Τα άκρα **κανονικοποιούνται**: το `B5:A1`
 * είναι το ίδιο ορθογώνιο με το `A1:B5`, όπως σε κάθε φύλλο υπολογισμού.
 *
 * Άκρο που δεν υπάρχει πια (διαγραμμένη γραμμή) ⇒ **κενό** εύρος, όχι μισό: το `#REF!` το
 * έχει ήδη πει ο εκτυπωτής και θα το πει η αποθηκευμένη τιμή· εδώ σημασία έχει να μην
 * επινοηθεί ορθογώνιο που κανείς δεν ζήτησε.
 */
export function expandRange(
  book: TableFormulaWorkbook,
  from: TableFormulaCellRef,
  to: TableFormulaCellRef,
): readonly TableFormulaCellRef[] {
  return expandRangeShape(book, from, to).cells;
}

/** Το ορθογώνιο **με τις διαστάσεις του** — δες {@link TableFormulaArgument.rows}. */
export interface ExpandedRange {
  readonly cells: readonly TableFormulaCellRef[];
  readonly rows: number;
  readonly cols: number;
}

/**
 * Η μία επέκταση εύρους. Ο {@link expandRange} είναι η προβολή της που αγνοεί το σχήμα —
 * δύο ερωτήσεις, **ένας** υπολογισμός: μια δεύτερη διπλή επανάληψη «γραμμή × στήλη» θα ήταν
 * ακριβώς το είδος του διδύμου που πληρώνει το N.18, και θα απέκλινε την πρώτη φορά που
 * αλλάξει η κανονικοποίηση των άκρων.
 */
export function expandRangeShape(
  book: TableFormulaWorkbook,
  from: TableFormulaCellRef,
  to: TableFormulaCellRef,
): ExpandedRange {
  // 🔴 ADR-833 Φάση 7 — **ένα εύρος ζει σε ΕΝΑ φύλλο.** Το `Φύλλο2!A1:Φύλλο3!B5` δεν είναι
  // ορθογώνιο· είναι δύο διευθύνσεις με `:` ανάμεσα, και το Excel το απορρίπτει κι εκείνο.
  // Ο αναλυτής δεν το παράγει, αλλά ο φύλακας μένει εδώ γιατί εδώ **παράγεται** το ορθογώνιο:
  // χωρίς αυτόν, μια μελλοντική διαδρομή (επικόλληση, μετατόπιση) που έφτιαχνε ασύμφωνα άκρα
  // θα ζωγράφιζε ορθογώνιο του **λάθος** φύλλου, σιωπηλά.
  const model = gridOfRef(book, from);
  if (model === null || !sameSheetRefs(book, from, to)) return { cells: [], rows: 0, cols: 0 };

  // 🔴 ADR-764 / N.18 — **το ΤΕΤΑΡΤΟ δίδυμο**, επιτέλους μετακομισμένο. Οι έξι γραμμές
  // «`indexById` × 2, τέσσερα `get`, δύο φρουροί» είχαν εξαχθεί στο {@link cellPairIndices}
  // ακριβώς επειδή είχαν ήδη γεννηθεί τρεις φορές — αυτή εδώ έμεινε πίσω και το `jscpd` δεν
  // την είδε ποτέ, γιατί τα δύο αρχεία δεν είχαν σταλεί ποτέ **μαζί** στο `--diff`.
  const pair = cellPairIndices(model, from, to);
  if (pair === null) return { cells: [], rows: 0, cols: 0 };

  const firstRow = Math.min(pair.fromRow, pair.toRow);
  const lastRow = Math.max(pair.fromRow, pair.toRow);
  const firstCol = Math.min(pair.fromCol, pair.toCol);
  const lastCol = Math.max(pair.fromCol, pair.toCol);

  // ⚠️ Το φύλλο μπαίνει στα παραγόμενα κελιά **μόνο όταν γράφτηκε ρητά**, με την ίδια σύμβαση
  // παράλειψης που έχει η διεύθυνση (`απόν ⇒ το σπίτι μου`). Ένα άνευ όρων `worksheetId: …`
  // θα υλοποιούσε το σπίτι σε **κάθε** κελί κάθε ενδοφυλλικού εύρους — δηλαδή θα φούσκωνε τον
  // αραιό χάρτη κλειδιών του γράφου χωρίς να προσθέτει καμία πληροφορία.
  const sheet = from.worksheetId === undefined ? {} : { worksheetId: from.worksheetId };

  const cells: TableFormulaCellRef[] = [];
  for (let r = firstRow; r <= lastRow; r += 1) {
    for (let c = firstCol; c <= lastCol; c += 1) {
      cells.push({ ...sheet, rowId: model.rows[r].id, colId: model.columns[c].id });
    }
  }
  return { cells, rows: lastRow - firstRow + 1, cols: lastCol - firstCol + 1 };
}
