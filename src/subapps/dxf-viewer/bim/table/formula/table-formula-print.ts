/**
 * ADR-739 Φ.Ζ — **ο εκτυπωτής**: δέντρο → κείμενο `A1`. Η αντίστροφη διαδρομή του αναλυτή,
 * και ο λόγος που ο τύπος μπορεί να αποθηκεύεται δεμένος σε ταυτότητες.
 *
 * ## Το `A1` είναι ΠΑΡΑΓΩΓΟ — εδώ παράγεται
 * Η γραμμή τύπων, ο επεξεργαστής κελιού και (αργότερα) το DXF `FIELD` ρωτούν **αυτό** το
 * αρχείο. Επειδή η απάντηση υπολογίζεται τη στιγμή της ερώτησης, μια εισαγωγή γραμμής αλλάζει
 * ό,τι δείχνει η γραμμή τύπων (`=SUM(A1:A2)` → `=SUM(A2:A3)`) **χωρίς κανείς να πειράξει τον
 * τύπο**. Αυτή είναι η ολόκληρη διαφορά από το AutoCAD, σε μία συνάρτηση.
 *
 * ## Η ταυτότητα που έσβησε τυπώνεται `#REF!`
 * Αν διαγράφηκε η γραμμή που αναφερόταν ένας τύπος, η ταυτότητα δεν λύνεται πια. Δεν είναι
 * περίπτωση προς αποσιώπηση: **έτσι ακριβώς** το δείχνει το Excel, και ένας τύπος που
 * σιωπηλά έδειχνε αλλού θα ήταν λάθος **τιμής** σε παραδοτέο, όχι εμφάνισης (ADR-720).
 *
 * ## Ελάχιστες παρενθέσεις, καμία αλλαγή νοήματος
 * Τυπώνεται παρένθεση **μόνο** όταν η αφαίρεσή της θα άλλαζε το δέντρο κατά την επανανάγνωση.
 * Η προτεραιότητα είναι **η ίδια** με του αναλυτή — γι' αυτό το `printTableFormula` και το
 * `parseTableFormula` είναι αντίστροφα, και το test round-trip το απαιτεί.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-print
 * @see bim/table/formula/table-formula-parse.ts — η ίδια προτεραιότητα, αντίστροφη φορά
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9
 */

import type { TableModel } from '../../../types/table';
import type {
  TableFormula,
  TableFormulaBinaryOp,
  TableFormulaCellRef,
  TableFormulaNode,
} from '../../../types/table-formula';
import type { TableFormulaGrammar } from '../../../types/table-formula-grammar';
import { tableColumnLetter, tableRowNumber } from '../table-cell-reference';
import { formatAbsoluteReference } from './table-formula-absolute';
import { drawingFormulaGrammar } from './table-formula-grammar';
import { FORMULA_PREFIX } from './table-formula-lex';
import { isLiveCellRef } from './table-formula-ref-scope';
import { FORMULA_ERROR, isFormulaError, type TableFormulaValue } from './table-formula-value';

/**
 * Ο κωδικός που τυπώνεται όταν μια ταυτότητα δεν υπάρχει πια στο πλέγμα.
 *
 * 🔴 ADR-764 — ήταν **ιδιωτική σταθερά** `'#REF!'` δίπλα στο υπάρχον `FORMULA_ERROR.reference`:
 * δύο κυριολεκτικά για την ίδια έννοια, σε αρχεία που οφείλουν να συμφωνούν. Πλέον ψευδώνυμο
 * του SSoT — ο εκτυπωτής **διαβάζει**, δεν ξαναδηλώνει.
 */
const REF_ERROR: string = FORMULA_ERROR.reference;

/**
 * Προτεραιότητα ανά τελεστή — **ίδιοι αριθμοί με τα επίπεδα του αναλυτή**. Το πρόσημο (μη
 * τελεστής εδώ) κάθεται **πάνω** από τη δύναμη, γιατί έτσι το διαβάζει και ο αναλυτής:
 * το `-2^2` είναι `(-2)^2`, δηλαδή `4`, όπως στο Excel.
 */
const PRECEDENCE: Readonly<Record<TableFormulaBinaryOp, number>> = {
  '=': 1, '<>': 1, '<': 1, '<=': 1, '>': 1, '>=': 1,
  '&': 2,
  '+': 3, '-': 3,
  '*': 4, '/': 4,
  '^': 6,
};

/** Το πρόσημο και κάθε πρωτεύον μέλος: ποτέ δεν χρειάζονται παρένθεση για να διαβαστούν. */
const UNARY_PRECEDENCE = 7;
const ATOM_PRECEDENCE = Number.POSITIVE_INFINITY;

/**
 * Ο αποθηκευμένος τύπος όπως τον βλέπει ο χρήστης — **με** το `=`.
 *
 * 🔴 **Η γραμματική οφείλει να είναι η ΙΔΙΑ που θα τον ξαναδιαβάσει** (ADR-761): εκτύπωση σε
 * μία και ανάγνωση σε άλλη σημαίνει ότι το `writeCellInput(cellInputText(x))` παύει να είναι
 * ταυτότητα — δηλαδή ένας τύπος που ο χρήστης απλώς **άνοιξε και έκλεισε** θα γινόταν
 * κείμενο. Το test round-trip το απαιτεί και στις δύο.
 */
export function printTableFormula(
  model: TableModel,
  formula: TableFormula,
  grammar: TableFormulaGrammar = drawingFormulaGrammar(),
): string {
  return FORMULA_PREFIX + printNode(model, formula.root, grammar);
}

/**
 * 🔴 ADR-763 Φ2.3 — **μια ΤΙΜΗ στη γραφή αυτής της γραμματικής**: `20` · `"κείμενο"` · `TRUE` ·
 * `#DIV/0!`.
 *
 * ## Γιατί ζει εδώ, στον εκτυπωτή, και όχι στον διάλογο που τη ζήτησε
 * Είναι **ακριβώς** η ερώτηση που απαντά ήδη ο εκτυπωτής για τα κυριολεκτικά ενός δέντρου —
 * μαζί με τα δύο μη προφανή: τα εισαγωγικά διπλασιάζονται, και ο δεκαδικός χαρακτήρας είναι
 * **της γραμματικής**, όχι τελεία. Γραμμένη αλλού θα ήταν δεύτερος ορισμός του «πώς γράφεται
 * ένα κυριολεκτικό» (N.18) και θα απέκλινε την ημέρα που η γραμματική αλλάξει υποδιαστολή.
 *
 * ## Γιατί ΟΧΙ το `cellDisplayText`
 * Εκείνο απαντά «πώς **δείχνει** αυτό το κελί» και θέλει τη **μορφή** του (ADR-760: δεκαδικά,
 * ημερομηνία, ποσοστό). Εδώ η ερώτηση είναι «τι **κατάλαβα** από αυτό που έγραψες», και η
 * απάντηση οφείλει να είναι η ωμή τιμή — αλλιώς ο χρήστης που γράφει `A1` σε στήλη με 0
 * δεκαδικά θα έβλεπε `= 21` για την τιμή `20,6` και θα νόμιζε ότι έδειξε λάθος κελί. Το Excel
 * κάνει το ίδιο ακριβώς σε αυτόν τον διάλογο — γι' αυτό δείχνει `""` για κενό κείμενο.
 */
export function printFormulaValue(
  value: TableFormulaValue,
  grammar: TableFormulaGrammar = drawingFormulaGrammar(),
): string {
  if (typeof value === 'number') return printNumber(value, grammar);
  if (typeof value === 'boolean') return printBoolean(value);
  // Ένας κωδικός σφάλματος **δεν** είναι κείμενο σε εισαγωγικά: είναι ό,τι θα έδειχνε το κελί.
  return isFormulaError(value) ? value : printText(value);
}

/** Διπλασιασμός εισαγωγικών — η σύμβαση που διαβάζει πίσω ο λεξικογράφος. */
function printText(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

/**
 * Πάντα κεφαλαία, όπως το Excel: ο χρήστης μπορεί να έγραψε `false`, αλλά η κανονική γραφή
 * είναι μία — και ο λεξικογράφος τη διαβάζει πίσω ως το ίδιο κυριολεκτικό.
 */
function printBoolean(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

/** Ένας κόμβος ως κείμενο, χωρίς περιτύλιγμα. */
function printNode(
  model: TableModel,
  node: TableFormulaNode,
  grammar: TableFormulaGrammar,
): string {
  switch (node.kind) {
    case 'number':
      return printNumber(node.value, grammar);
    case 'text':
      return printText(node.value);
    case 'boolean':
      return printBoolean(node.value);
    case 'ref':
      return printRef(model, node.cell);
    case 'range':
      return printRange(model, node.from, node.to);
    case 'unary':
      return node.op + wrap(model, node.operand, UNARY_PRECEDENCE, grammar);
    case 'binary':
      return printBinary(model, node, grammar);
    case 'call':
      return `${node.name}(${node.args
        .map((arg) => printNode(model, arg, grammar))
        .join(grammar.argumentSeparator)})`;
    case 'group':
      return `(${printNode(model, node.inner, grammar)})`;
    case 'error':
      return node.code;
  }
}

/**
 * Ένα αριθμητικό κυριολεκτικό στη γραφή **αυτής** της γραμματικής.
 *
 * ## 🔴 Γιατί ΟΧΙ `Intl.NumberFormat`
 * Εδώ δεν μορφοποιείται τίποτα — **αναπαράγεται πηγαίος κώδικας**. Ο `Intl` θα πρόσθετε
 * ομαδοποίηση χιλιάδων (`1.234,5`), που ο λεξικογράφος **δεν** διαβάζει πίσω μέσα σε τύπο
 * (δες `scanNumber`), και θα στρογγύλευε στα τρία δεκαδικά — δηλαδή ο τύπος του χρήστη θα
 * **έχανε ακρίβεια** κάθε φορά που άνοιγε το κελί. Η μορφοποίηση για το **μάτι** είναι η
 * δουλειά του `cellDisplayText` (ADR-760)· εδώ η δουλειά είναι η **αντιστρεψιμότητα**.
 *
 * Το `String(number)` δίνει πάντα τελεία (ή καθόλου δεκαδικό, ή εκθέτη `1e+21` που δεν έχει
 * τελεία καθόλου), οπότε μία στοχευμένη αντικατάσταση αρκεί και είναι ακριβής.
 */
function printNumber(value: number, grammar: TableFormulaGrammar): string {
  const literal = String(value);
  return grammar.decimalSeparator === '.' ? literal : literal.replace('.', ',');
}

/**
 * `A1` — ή `$A$1` όταν ο χρήστης κλείδωσε άξονα (ADR-754 Γ2), ή `#REF!` όταν η γραμμή/στήλη
 * δεν υπάρχει πια.
 *
 * Τα δολάρια δεν γράφονται εδώ: τα συνθέτει ο ένας ιδιοκτήτης τους, ώστε η σειρά
 * `$στήλη$γραμμή` να μην υπάρχει ως γνώση σε δύο αρχεία.
 */
function printRef(model: TableModel, cell: TableFormulaCellRef): string {
  // 🔴 ADR-764 — **το ίδιο** κατηγόρημα που ρωτά ο αξιολογητής. Πριν, ο εκτυπωτής έκρινε με
  // δικό του κριτήριο (κενό γράμμα / μηδενικός αριθμός) — σωστό, αλλά **δεύτερος** ορισμός
  // του «υπάρχει». Η μέρα που θα διαφωνούσαν είναι η μέρα που η γραμμή τύπων γράφει `#REF!`
  // ενώ το κελί δείχνει αριθμό.
  if (!isLiveCellRef(model, cell)) return REF_ERROR;
  const letter = tableColumnLetter(model, cell.colId);
  const number = tableRowNumber(model, cell.rowId);
  return formatAbsoluteReference(letter, String(number), cell);
}

/**
 * `A1:B5`. Αν **οποιοδήποτε** άκρο έσβησε, ολόκληρο το εύρος γίνεται `#REF!`: ένα εύρος με
 * ένα άκρο άγνωστο δεν είναι «μισό εύρος», είναι άγνωστο εύρος.
 */
function printRange(model: TableModel, from: TableFormulaCellRef, to: TableFormulaCellRef): string {
  const start = printRef(model, from);
  const end = printRef(model, to);
  return start === REF_ERROR || end === REF_ERROR ? REF_ERROR : `${start}:${end}`;
}

/** Δυαδικός κόμβος με τις **ελάχιστες** παρενθέσεις που διατηρούν το δέντρο. */
function printBinary(
  model: TableModel,
  node: Extract<TableFormulaNode, { kind: 'binary' }>,
  grammar: TableFormulaGrammar,
): string {
  const precedence = PRECEDENCE[node.op];
  // Η δύναμη είναι δεξιά-προσεταιριστική, οι υπόλοιποι αριστερά: γι' αυτό η ισοπαλία απαιτεί
  // παρένθεση στο **αντίθετο** σκέλος από τη φορά προσεταιρισμού.
  const tieOnLeft = node.op === '^';
  const left = wrap(model, node.left, precedence, grammar, tieOnLeft);
  const right = wrap(model, node.right, precedence, grammar, !tieOnLeft);
  return `${left}${node.op}${right}`;
}

/**
 * Ένα μέλος, με παρένθεση **μόνο** όταν χρειάζεται: όταν δένει χαλαρότερα από τον γονιό, ή
 * όταν δένει το ίδιο και βρίσκεται στο σκέλος που ο προσεταιρισμός δεν καλύπτει.
 */
function wrap(
  model: TableModel,
  node: TableFormulaNode,
  parentPrecedence: number,
  grammar: TableFormulaGrammar,
  parenthesizeTie = false,
): string {
  const text = printNode(model, node, grammar);
  const own = precedenceOf(node);
  const needs = own < parentPrecedence || (own === parentPrecedence && parenthesizeTie);
  return needs ? `(${text})` : text;
}

/** Πόσο σφιχτά δένει ένας κόμβος. Τα πρωτεύοντα μέλη δεν σπάνε ποτέ. */
function precedenceOf(node: TableFormulaNode): number {
  if (node.kind === 'binary') return PRECEDENCE[node.op];
  if (node.kind === 'unary') return UNARY_PRECEDENCE;
  return ATOM_PRECEDENCE;
}
