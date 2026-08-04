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
import { tableColumnLetter, tableRowNumber } from '../table-cell-reference';
import { formatAbsoluteReference } from './table-formula-absolute';
import { FORMULA_PREFIX } from './table-formula-lex';

/** Ο κωδικός που τυπώνεται όταν μια ταυτότητα δεν υπάρχει πια στο πλέγμα. */
const REF_ERROR = '#REF!';

/**
 * Ο διαχωριστής ορισμάτων — **κόμμα**, η κανονική μορφή που γράφει το `ACAD_TABLE` στο DXF.
 * Δες την κεφαλίδα του λεξικογράφου για το γιατί δεν είναι ερωτηματικό.
 */
const ARGUMENT_SEPARATOR = ',';

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

/** Ο αποθηκευμένος τύπος όπως τον βλέπει ο χρήστης — **με** το `=`. */
export function printTableFormula(model: TableModel, formula: TableFormula): string {
  return FORMULA_PREFIX + printNode(model, formula.root);
}

/** Ένας κόμβος ως κείμενο, χωρίς περιτύλιγμα. */
function printNode(model: TableModel, node: TableFormulaNode): string {
  switch (node.kind) {
    case 'number':
      return String(node.value);
    case 'text':
      // Διπλασιασμός εισαγωγικών — η σύμβαση που διαβάζει πίσω ο λεξικογράφος.
      return `"${node.value.replace(/"/gu, '""')}"`;
    case 'ref':
      return printRef(model, node.cell);
    case 'range':
      return printRange(model, node.from, node.to);
    case 'unary':
      return node.op + wrap(model, node.operand, UNARY_PRECEDENCE);
    case 'binary':
      return printBinary(model, node);
    case 'call':
      return `${node.name}(${node.args.map((arg) => printNode(model, arg)).join(ARGUMENT_SEPARATOR)})`;
    case 'group':
      return `(${printNode(model, node.inner)})`;
    case 'error':
      return node.code;
  }
}

/**
 * `A1` — ή `$A$1` όταν ο χρήστης κλείδωσε άξονα (ADR-754 Γ2), ή `#REF!` όταν η γραμμή/στήλη
 * δεν υπάρχει πια.
 *
 * Τα δολάρια δεν γράφονται εδώ: τα συνθέτει ο ένας ιδιοκτήτης τους, ώστε η σειρά
 * `$στήλη$γραμμή` να μην υπάρχει ως γνώση σε δύο αρχεία.
 */
function printRef(model: TableModel, cell: TableFormulaCellRef): string {
  const letter = tableColumnLetter(model, cell.colId);
  const number = tableRowNumber(model, cell.rowId);
  if (letter === '' || number === 0) return REF_ERROR;
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
): string {
  const precedence = PRECEDENCE[node.op];
  // Η δύναμη είναι δεξιά-προσεταιριστική, οι υπόλοιποι αριστερά: γι' αυτό η ισοπαλία απαιτεί
  // παρένθεση στο **αντίθετο** σκέλος από τη φορά προσεταιρισμού.
  const tieOnLeft = node.op === '^';
  const left = wrap(model, node.left, precedence, tieOnLeft);
  const right = wrap(model, node.right, precedence, !tieOnLeft);
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
  parenthesizeTie = false,
): string {
  const text = printNode(model, node);
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
