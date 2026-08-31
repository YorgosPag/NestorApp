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

import type {
  TableFormula,
  TableFormulaBinaryOp,
  TableFormulaCellRef,
  TableFormulaNode,
} from '../../../types/table-formula';
import type { TableFormulaGrammar } from '../../../types/table-formula-grammar';
import { tableColumnLetter, tableRowNumber } from '../table-cell-reference';
import { formatAbsoluteReference, isWrittenAddressShape } from './table-formula-absolute';
import {
  gridOfRef,
  sheetIdOfRef,
  type TableFormulaWorkbook,
} from './table-formula-workbook';
import { drawingFormulaGrammar } from './table-formula-grammar';
import { FORMULA_PREFIX, isBareNameLexeme } from './table-formula-lex';
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
  book: TableFormulaWorkbook,
  formula: TableFormula,
  grammar: TableFormulaGrammar = drawingFormulaGrammar(),
): string {
  return FORMULA_PREFIX + printNode(book, formula.root, grammar);
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
  book: TableFormulaWorkbook,
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
      return printRef(book, node.cell);
    case 'range':
      return printRange(book, node.from, node.to);
    case 'unary':
      return node.op + wrap(book, node.operand, UNARY_PRECEDENCE, grammar);
    case 'binary':
      return printBinary(book, node, grammar);
    case 'call':
      return `${node.name}(${node.args
        .map((arg) => printNode(book, arg, grammar))
        .join(grammar.argumentSeparator)})`;
    case 'group':
      return `(${printNode(book, node.inner, grammar)})`;
    case 'error':
      return node.code;
    // 🔴 ADR-765 — **αυτούσιο**, χωρίς κανονικοποίηση. Σε αντίθεση με το `call`, δεν υπάρχει
    // μητρώο με το οποίο να συμφωνήσει η γραφή: κάθε αλλαγή θα ήταν το εργαλείο να ξαναγράφει
    // ό,τι πληκτρολόγησε ο μηχανικός — και μάλιστα σε λέξη που **δεν αναγνώρισε**.
    case 'name':
      return node.name;
    // 🔴 ADR-765 — το παραλειπόμενο όρισμα γράφεται ως **τίποτα**, και έτσι το `=IF(A1;;99)`
    // ξαναδιαβάζεται ταυτόσημο. Ο αναλυτής το παράγει **μόνο** σε θέση ορίσματος κλήσης, οπότε
    // η κενή συμβολοσειρά δεν μπορεί ποτέ να καταπιεί άλλο κείμενο γύρω της.
    case 'blank':
      return '';
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
function printRef(
  book: TableFormulaWorkbook,
  cell: TableFormulaCellRef,
  withSheet = true,
): string {
  // 🔴 ADR-764 — **το ίδιο** κατηγόρημα που ρωτά ο αξιολογητής. Πριν, ο εκτυπωτής έκρινε με
  // δικό του κριτήριο (κενό γράμμα / μηδενικός αριθμός) — σωστό, αλλά **δεύτερος** ορισμός
  // του «υπάρχει». Η μέρα που θα διαφωνούσαν είναι η μέρα που η γραμμή τύπων γράφει `#REF!`
  // ενώ το κελί δείχνει αριθμό.
  if (!isLiveCellRef(book, cell)) return REF_ERROR;
  const model = gridOfRef(book, cell);
  if (model === null) return REF_ERROR;

  const letter = tableColumnLetter(model, cell.colId);
  const number = tableRowNumber(model, cell.rowId);
  const address = formatAbsoluteReference(letter, String(number), cell);
  if (!withSheet) return address;

  // 🔴 ADR-833 Φάση 7 — **το `#REF!` του προθέματος καταπίνει ΟΛΟΚΛΗΡΗ την αναφορά.**
  // Βρέθηκε από μετάλλαξη: η συνένωση έδινε `#REF!A1`, δηλαδή κείμενο που δεν είναι ούτε
  // σφάλμα ούτε διεύθυνση — και ο αναλυτής δεν το ξαναδιαβάζει. Μια αναφορά της οποίας το
  // φύλλο δεν έχει όνομα σε **αυτό** το σύνορο δεν είναι «μισή αναφορά»· είναι άγνωστη.
  const prefix = sheetPrefix(book, cell);
  return prefix === REF_ERROR ? REF_ERROR : prefix + address;
}

/**
 * 🔴 ADR-833 Φάση 7 — **`Φύλλο2!`**, ή κενό όταν η αναφορά ζει στο δικό μας φύλλο.
 *
 * ## Το όνομα ΠΑΡΑΓΕΤΑΙ — δεν αποθηκεύτηκε ποτέ
 * Ο τύπος κρατά **ταυτότητα** (§5.9.1). Το ορατό όνομα το δίνει η ονοματοδοσία **αυτού** του
 * συνόρου, τη στιγμή της ερώτησης — γι' αυτό μια μετονομασία φύλλου αλλάζει ό,τι γράφει η
 * γραμμή τύπων **χωρίς κανείς να πειράξει τύπο**, και γι' αυτό ο ίδιος τύπος γράφεται
 * `=Φύλλο2!A1` σε ελληνικό UI και `=Sheet2!A1` σε αγγλικό. Είναι η **ίδια** πρόταση που
 * γράφει η κεφαλίδα για το `A1`, ένα επίπεδο πιο έξω.
 *
 * ⚠️ Φύλλο που δεν έχει όνομα σε αυτό το σύνορο ⇒ `#REF!` **ολόκληρη η αναφορά**, όχι σκέτη
 * διεύθυνση: μια διεύθυνση χωρίς το φύλλο της θα διαβαζόταν πίσω ως αναφορά στο **δικό μας**
 * φύλλο — σιωπηλά, και με αριθμό. Στην πράξη το φύλλο έχει ήδη κοπεί ή διαγραφεί, οπότε το
 * {@link isLiveCellRef} έχει προλάβει· ο φύλακας μένει γιατί η ονοματοδοσία είναι
 * **παράμετρος** και ένα σύνορο χωρίς λεξιλόγιο (`NO_WORKSHEET_NAMING`) είναι νόμιμο.
 */
function sheetPrefix(book: TableFormulaWorkbook, cell: TableFormulaCellRef): string {
  const id = sheetIdOfRef(book, cell);
  if (id === book.homeId) return '';
  const name = book.naming.nameOf(id);
  return name === null ? REF_ERROR : `${quoteWorksheetName(name)}!`;
}

/**
 * Το όνομα φύλλου όπως μπαίνει σε τύπο: γυμνό όταν γίνεται, σε απόστροφους όταν πρέπει.
 *
 * ## Το κριτήριο ΔΕΝ γράφεται εδώ — το ρωτάμε τον λεξικογράφο
 * «Χωρίς εισαγωγικά» σημαίνει ακριβώς «ο **ίδιος** σαρωτής που θα το ξαναδιαβάσει το βλέπει ως
 * μία μονάδα» ({@link isBareNameLexeme}). Μια χειρόγραφη λίστα χαρακτήρων εδώ θα ήταν δεύτερος
 * ορισμός του «τι είναι όνομα» (N.18) — και ο εκτυπωτής θα παρήγαγε κείμενο που ο αναλυτής
 * απορρίπτει, δηλαδή τύπο που ο χρήστης δεν μπορεί να ξανασώσει.
 *
 * ⚠️ Το **σχήμα διεύθυνσης** (`A1`, `$B$2`) παίρνει εισαγωγικά παρόλο που ο **δικός μας**
 * αναλυτής δεν θα μπερδευόταν (το `!` κρίνεται πριν από κάθε άλλη ερμηνεία). Ο λόγος είναι
 * **έξω** από εμάς: το ίδιο κείμενο γράφεται και στο `.xlsx`, και το Excel εκεί απαιτεί τα
 * εισαγωγικά. Ένα βιβλίο που δεν ανοίγει είναι χειρότερο από δύο περιττούς χαρακτήρες.
 *
 * Η διπλή απόστροφος είναι η σύμβαση διαφυγής του Excel, ίδια με το `""` του κειμένου.
 */
function quoteWorksheetName(name: string): string {
  if (isBareNameLexeme(name) && !isWrittenAddressShape(name)) return name;
  return `'${name.replace(/'/gu, "''")}'`;
}

/**
 * `A1:B5`. Αν **οποιοδήποτε** άκρο έσβησε, ολόκληρο το εύρος γίνεται `#REF!`: ένα εύρος με
 * ένα άκρο άγνωστο δεν είναι «μισό εύρος», είναι άγνωστο εύρος.
 */
function printRange(
  book: TableFormulaWorkbook,
  from: TableFormulaCellRef,
  to: TableFormulaCellRef,
): string {
  const start = printRef(book, from);
  // 🔴 ADR-833 Φάση 7 — **το φύλλο γράφεται ΜΙΑ φορά**, στο αριστερό άκρο: `Φύλλο2!A1:B5`.
  // Έτσι το γράφει το Excel, και έτσι το διαβάζει πίσω ο αναλυτής μας (το δεξί άκρο
  // **κληρονομεί** το φύλλο του αριστερού). Ένα `Φύλλο2!A1:Φύλλο2!B5` θα ήταν αληθές αλλά
  // θορυβώδες — και θα έσπαγε τη συμμετρία εκτυπωτή/αναλυτή που απαιτεί το test round-trip.
  const end = printRef(book, to, false);
  return start === REF_ERROR || end === REF_ERROR ? REF_ERROR : `${start}:${end}`;
}

/** Δυαδικός κόμβος με τις **ελάχιστες** παρενθέσεις που διατηρούν το δέντρο. */
function printBinary(
  book: TableFormulaWorkbook,
  node: Extract<TableFormulaNode, { kind: 'binary' }>,
  grammar: TableFormulaGrammar,
): string {
  const precedence = PRECEDENCE[node.op];
  // Η δύναμη είναι δεξιά-προσεταιριστική, οι υπόλοιποι αριστερά: γι' αυτό η ισοπαλία απαιτεί
  // παρένθεση στο **αντίθετο** σκέλος από τη φορά προσεταιρισμού.
  const tieOnLeft = node.op === '^';
  const left = wrap(book, node.left, precedence, grammar, tieOnLeft);
  const right = wrap(book, node.right, precedence, grammar, !tieOnLeft);
  return `${left}${node.op}${right}`;
}

/**
 * Ένα μέλος, με παρένθεση **μόνο** όταν χρειάζεται: όταν δένει χαλαρότερα από τον γονιό, ή
 * όταν δένει το ίδιο και βρίσκεται στο σκέλος που ο προσεταιρισμός δεν καλύπτει.
 */
function wrap(
  book: TableFormulaWorkbook,
  node: TableFormulaNode,
  parentPrecedence: number,
  grammar: TableFormulaGrammar,
  parenthesizeTie = false,
): string {
  const text = printNode(book, node, grammar);
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
