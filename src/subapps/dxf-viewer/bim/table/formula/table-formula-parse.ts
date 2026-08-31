/**
 * ADR-739 Φ.Ζ — **ο αναλυτής**: κείμενο τύπου → δέντρο **δεμένο σε ταυτότητες**.
 * Καθαρή συνάρτηση· μηδέν React/DOM/canvas.
 *
 * ## Εδώ γίνεται το δέσιμο — μία φορά, στην πληκτρολόγηση
 * Το `A1` που γράφει ο χρήστης μεταφράζεται **αμέσως** σε `rowId`/`colId` και το κείμενο
 * πετιέται. Αυτό είναι όλη η υπόσχεση του ADR-739 §11 #7: μετά το δέσιμο δεν υπάρχει τίποτα
 * που να μπορεί να «δείξει αλλού» όταν μπει γραμμή στη μέση. Δες `types/table-formula.ts`.
 *
 * Η μετάφραση **δεν** γράφεται εδώ: τη ζητά από το `table-cell-reference.ts`, που είναι το
 * δηλωμένο «μόνο σημείο μετάφρασης» του §9.2 και υπήρχε πριν από αυτή τη φάση.
 *
 * ## Προτεραιότητα τελεστών — του Excel, με το παράξενό της
 * `^` › `* /` › `+ -` › `&` › συγκρίσεις — αλλά το **πρόσημο δένει πιο σφιχτά από τη
 * δύναμη**: στο Excel το `-2^2` δίνει `4`, όχι `-4`. Είναι τεκμηριωμένη ιδιαιτερότητα και
 * την ακολουθούμε: ένας μηχανικός που αντιγράφει τύπο από φύλλο υπολογισμού πρέπει να παίρνει
 * τον **ίδιο** αριθμό, αλλιώς η διαφορά θα βρεθεί σε παραδοτέο και όχι εδώ.
 *
 * ## Δύο είδη αποτυχίας — και γιατί έχουν διαφορετική απάντηση
 * - **Συντακτική** (`=1+`, `=SUM(`): επιστρέφεται `null` και ο καλών αποθηκεύει το κείμενο
 *   **αυτούσιο**. Ο χρήστης βλέπει ό,τι πληκτρολόγησε και το διορθώνει· τίποτα δεν χάνεται
 *   και καμία κατάσταση σφάλματος δεν χρειάζεται εξήγηση.
 * - **Δεσίματος** (`=A99` σε πίνακα πέντε γραμμών): ο τύπος είναι έγκυρος, η αναφορά όχι.
 *   Παγώνει ως κόμβος `error` με `#REF!` — ακριβώς ό,τι δείχνει το Excel όταν σβήνεις κελί
 *   που κάποιος τύπος αναφέρει.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-parse
 * @see bim/table/table-cell-reference.ts — η ΜΙΑ μετάφραση `A1` ⇄ ταυτότητες
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9
 */

import type { TableModel } from '../../../types/table';
import type {
  TableFormula,
  TableFormulaBinaryOp,
  TableFormulaCellRef,
  TableFormulaNode,
} from '../../../types/table-formula';
import type { TableWorksheetId } from '../../../types/table-ids';
import type { TableFormulaGrammar } from '../../../types/table-formula-grammar';
import { createTableModel } from '../table-model-helpers';
import { isWrittenAddressShape, resolveWrittenCellRef } from './table-formula-absolute';
import { drawingFormulaGrammar } from './table-formula-grammar';
import { soleWorksheetBook, type TableFormulaWorkbook } from './table-formula-workbook';
import {
  FORMULA_PREFIX,
  tokenizeFormula,
  type TableFormulaPunct,
  type TableFormulaToken,
} from './table-formula-lex';

/**
 * Μέγιστο βάθος φωλιάσματος. Υπάρχει για να μην μπορεί μια επικολλημένη συμβολοσειρά με
 * χίλιες παρενθέσεις να εξαντλήσει τη στοίβα κλήσεων — αναδρομικός αναλυτής σημαίνει ότι το
 * βάθος του κειμένου **είναι** βάθος στοίβας. Το 64 είναι πάνω από κάθε πραγματικό τύπο
 * πίνακα ποσοτήτων και πολύ κάτω από το όριο του κινητήρα.
 */
const MAX_DEPTH = 64;

/** Τα επίπεδα προτεραιότητας, από το **χαλαρότερο** προς το σφιχτότερο. */
const PRECEDENCE_LEVELS: readonly (readonly TableFormulaBinaryOp[])[] = [
  ['=', '<>', '<', '<=', '>', '>='],
  ['&'],
  ['+', '-'],
  ['*', '/'],
];

/** True όταν το κείμενο του κελιού είναι **δήλωση τύπου** και όχι σκέτο περιεχόμενο. */
export function isFormulaInput(text: string): boolean {
  return text.trimStart().startsWith(FORMULA_PREFIX);
}

/**
 * Κείμενο (**με** το `=`) → αποθηκεύσιμος τύπος, ή `null` όταν δεν είναι συντακτικά τύπος.
 *
 * Η γραμματική είναι **ρητή παράμετρος** και όχι εσωτερική ανάγνωση: ο μόνος παραγωγικός
 * καλών (`table-formula-engine.ts`) πρέπει να μπορεί να δοκιμάσει **και τη δεύτερη** όταν η
 * πρώτη δεν βγάζει νόημα (ADR-761, ανεκτική εφεδρεία). Απούσα ⇒ η γραμματική του σχεδίου.
 */
export function parseTableFormula(
  book: TableFormulaWorkbook,
  text: string,
  grammar: TableFormulaGrammar = drawingFormulaGrammar(),
): TableFormula | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(FORMULA_PREFIX)) return null;

  const tokens = tokenizeFormula(trimmed.slice(FORMULA_PREFIX.length), grammar);
  if (tokens === null || tokens.length === 0) return null;

  const reader: Reader = { book, tokens, grammar, at: 0, depth: 0 };
  const root = parseBinary(reader, 0);
  if (root === null || reader.at !== tokens.length) return null;
  return { root };
}

/**
 * **Είναι αυτό συντακτικά τύπος;** — χωρίς μοντέλο, επίτηδες.
 *
 * ## 🔑 Γιατί η απάντηση ΔΕΝ εξαρτάται από το μοντέλο
 * Ο αναλυτής επιστρέφει `null` **μόνο** για συντακτική αποτυχία. Μια αναφορά που δεν
 * υπάρχει στο πλέγμα **δεν** είναι αποτυχία: γίνεται κόμβος `error` με `#REF!` (δες
 * {@link parseReference}) και η ανάλυση συνεχίζει κανονικά. Άρα το ίδιο κείμενο δίνει την
 * ίδια απάντηση σε **κάθε** μοντέλο — και ένα κενό πλέγμα είναι έγκυρος μάρτυρας.
 *
 * Υπάρχει ώστε η **διάγνωση** (ADR-761, `table-formula-diagnosis.ts`) να μπορεί να ρωτηθεί
 * από τη γραμμή τύπων, που δεν κρατά μοντέλο. Η εναλλακτική ήταν να διασχίσει το μοντέλο
 * τρία επίπεδα props ως **prop διάγνωσης** — δηλαδή να μάθουν τρία αρχεία μια εξάρτηση που
 * η ερώτηση δεν έχει.
 */
export function isParseableFormula(text: string, grammar: TableFormulaGrammar): boolean {
  return parseTableFormula(GRAMMAR_PROBE_BOOK, text, grammar) !== null;
}

/**
 * Το κενό πλέγμα του {@link isParseableFormula}. Ιδιωτικό και σταθερό: ένα νέο μοντέλο ανά
 * κλήση θα ακύρωνε τα `WeakMap` που κρατούν τα βοηθήματα του πίνακα, σε κάθε πάτημα πλήκτρου.
 */
const GRAMMAR_PROBE_MODEL: TableModel = createTableModel({ columns: [], rows: [], cells: [] });

/**
 * Το ίδιο κενό πλέγμα ως **βιβλίο ενός φύλλου**, σταθερό για τον ίδιο λόγο.
 *
 * ⚠️ Χωρίς λεξιλόγιο ονομάτων (`NO_WORKSHEET_NAMING`) — και αυτό **δεν** αλλοιώνει την
 * απάντηση: ένα `=Φύλλο2!A1` παραμένει συντακτικά τύπος και εδώ, γιατί το άγνωστο φύλλο
 * είναι αποτυχία **δεσίματος** (⇒ κόμβος `#REF!`), όχι σύνταξης. Ίδιο σκεπτικό με το
 * `=A99` σε πίνακα πέντε γραμμών, δες την τεκμηρίωση από πάνω.
 */
const GRAMMAR_PROBE_BOOK: TableFormulaWorkbook = soleWorksheetBook(GRAMMAR_PROBE_MODEL);

/** Η θέση της ανάγνωσης. Μεταβλητή επίτηδες: ο αναλυτής είναι ένα πέρασμα, όχι δομή. */
interface Reader {
  /**
   * 🔴 ADR-833 Φάση 7 — ήταν `model` και έγινε **βιβλίο**: η μετάφραση `A1 → ταυτότητες`
   * χρειάζεται το πλέγμα **του φύλλου που ονομάστηκε**, όχι πάντα του δικού μας.
   */
  readonly book: TableFormulaWorkbook;
  readonly tokens: readonly TableFormulaToken[];
  /** Η γραμματική με την οποία σαρώθηκαν οι μονάδες — **η ίδια** που τις διαβάζει πίσω. */
  readonly grammar: TableFormulaGrammar;
  at: number;
  depth: number;
}

const peek = (reader: Reader): TableFormulaToken | undefined => reader.tokens[reader.at];

/**
 * Το σημείο στίξης που ακολουθεί, ή `null`. Υπάρχει ως ξεχωριστός φύλακας ώστε ο έλεγχος
 * «ακολουθεί `(`;» να είναι **στένωση τύπου** και όχι μετατροπή: ένα `as` εδώ θα ήταν η
 * μοναδική θέση του module που παρακάμπτει τον μεταγλωττιστή, ακριβώς εκεί που η διακριτή
 * ένωση υπάρχει για να τον αφήνει να αποφασίζει.
 */
function peekPunct(reader: Reader): TableFormulaPunct | null {
  const token = peek(reader);
  return token?.kind === 'punct' ? token.value : null;
}

/** True όταν η επόμενη μονάδα είναι αυτό ακριβώς το σημείο στίξης — και το καταναλώνει. */
function eatPunct(reader: Reader, value: string): boolean {
  const token = peek(reader);
  if (token?.kind !== 'punct' || token.value !== value) return false;
  reader.at += 1;
  return true;
}

/**
 * Ένα επίπεδο προτεραιότητας, αριστερά-προσεταιριστικό. Το τελευταίο επίπεδο παραδίδει στη
 * **δύναμη**, που είναι δεξιά-προσεταιριστική και ζει χωριστά.
 */
function parseBinary(reader: Reader, level: number): TableFormulaNode | null {
  if (level >= PRECEDENCE_LEVELS.length) return parsePower(reader);

  let left = parseBinary(reader, level + 1);
  if (left === null) return null;

  for (;;) {
    const token = peek(reader);
    if (token?.kind !== 'op' || !PRECEDENCE_LEVELS[level].includes(token.value)) return left;
    reader.at += 1;
    const right = parseBinary(reader, level + 1);
    if (right === null) return null;
    left = { kind: 'binary', op: token.value, left, right };
  }
}

/**
 * `^`, **δεξιά**-προσεταιριστική (`2^3^2` = `2^9`), με αριστερό όρο το **προσημασμένο**
 * μέλος — δες την ιδιαιτερότητα του Excel στην κεφαλίδα.
 */
function parsePower(reader: Reader): TableFormulaNode | null {
  const left = parseUnary(reader);
  if (left === null) return null;

  const token = peek(reader);
  if (token?.kind !== 'op' || token.value !== '^') return left;
  reader.at += 1;
  const right = parsePower(reader);
  return right === null ? null : { kind: 'binary', op: '^', left, right };
}

/** Πρόσημο, με φωλιασμένα πρόσημα (`--5`) — ό,τι δέχεται και το Excel. */
function parseUnary(reader: Reader): TableFormulaNode | null {
  const token = peek(reader);
  if (token?.kind === 'op' && (token.value === '+' || token.value === '-')) {
    reader.at += 1;
    const operand = parseUnary(reader);
    return operand === null ? null : { kind: 'unary', op: token.value, operand };
  }
  return parsePrimary(reader);
}

/** Κυριολεκτικό, παρένθεση, κλήση συνάρτησης ή αναφορά. Εδώ ελέγχεται και το βάθος. */
function parsePrimary(reader: Reader): TableFormulaNode | null {
  if (reader.depth >= MAX_DEPTH) return null;
  const token = peek(reader);
  if (token === undefined) return null;

  if (token.kind === 'number') {
    reader.at += 1;
    return { kind: 'number', value: token.value };
  }
  if (token.kind === 'text') {
    reader.at += 1;
    return { kind: 'text', value: token.value };
  }
  if (token.kind === 'name') {
    reader.at += 1;
    return parseAfterName(reader, token.value);
  }
  // 🔴 ADR-833 Φάση 7 — ένα εισαγωγικό όνομα είναι **πάντα** όνομα φύλλου: δεν υπάρχει άλλη
  // θέση στη γραμματική όπου να σημαίνει κάτι. Χωρίς `!` από πίσω είναι συντακτικό σφάλμα,
  // δηλαδή ο τύπος μένει **κείμενο** και ο χρήστης βλέπει ό,τι πληκτρολόγησε.
  if (token.kind === 'quotedName') {
    reader.at += 1;
    return parseSheetQualified(reader, token.value);
  }
  return parseGroup(reader);
}

/**
 * `( έκφραση )` — το μόνο σημείο όπου μεγαλώνει το βάθος μαζί με την ένθεση.
 *
 * Η παρένθεση **κρατιέται** στο δέντρο ({@link TableFormulaNode} `group`) αντί να διαλυθεί:
 * το σχήμα του δέντρου κωδικοποιεί ήδη την προτεραιότητα, αλλά όχι τη **γραφή** του χρήστη.
 * Χωρίς αυτό, το `=(2*5)/2` θα ξαναεμφανιζόταν ως `=2*5/2`.
 */
function parseGroup(reader: Reader): TableFormulaNode | null {
  if (!eatPunct(reader, '(')) return null;
  reader.depth += 1;
  const inner = parseBinary(reader, 0);
  reader.depth -= 1;
  if (inner === null || !eatPunct(reader, ')')) return null;
  return { kind: 'group', inner };
}

/** Τα δύο ονόματα που **δεν** είναι ποτέ διεύθυνση — δες `types/table-formula.ts`. */
const BOOLEAN_LITERALS: Readonly<Record<string, boolean>> = { TRUE: true, FALSE: false };

/**
 * Το όνομα είναι **κλήση** αν ακολουθεί `(`· αλλιώς κυριολεκτικό `TRUE`/`FALSE`, αναφορά, ή
 * — από το ADR-765 — **γυμνό όνομα** που δεν ορίστηκε ποτέ.
 *
 * ## 🔴 Η σειρά ΕΙΝΑΙ η σημασία, και το όνομα μπαίνει ΤΕΛΕΥΤΑΙΟ
 * 1. `(` ⇒ **κλήση**. Το `TRUE()` **με** παρενθέσεις μένει κλήση (υπάρχει στο μητρώο), ενώ
 *    το σκέτο `TRUE` είναι κυριολεκτικό. Και τα δύο δέχεται το Excel.
 * 2. `TRUE`/`FALSE` ⇒ **κυριολεκτικό**.
 * 3. `:` ή **σχήμα διεύθυνσης** ⇒ **αναφορά** (και `#REF!` όταν δείχνει εκτός πλέγματος).
 * 4. οτιδήποτε άλλο ⇒ **όνομα** ⇒ `#NAME?` στον αξιολογητή.
 *
 * Ένα βήμα πιο πάνω και ο κόμβος ονόματος θα κατάπινε **διευθύνσεις**: το `A99` σε πίνακα
 * πέντε γραμμών οφείλει να μένει `#REF!` (ADR-764), γιατί λέει στον μηχανικό ότι έσβησε
 * γραμμή. Το κριτήριο του βήματος 3 είναι επομένως **σχήματος** και όχι ύπαρξης — ζει στον
 * έναν ιδιοκτήτη του, δες {@link isWrittenAddressShape}.
 *
 * Το `:` προηγείται του σχήματος γιατί ο τελεστής εύρους **ορίζει** τα μέλη του ως
 * διευθύνσεις: ένα `X:Y` δεν είναι δύο ονόματα, είναι εύρος που δεν λύνεται ⇒ `#REF!`,
 * ακριβώς όπως πριν από αυτή τη φάση.
 */
function parseAfterName(reader: Reader, name: string): TableFormulaNode | null {
  if (peekPunct(reader) === '(') return parseCall(reader, name);

  // 🔴 ADR-833 Φάση 7 — **το `!` προηγείται ΚΑΘΕ άλλης ερμηνείας**, και η σειρά είναι η
  // σημασία: ένα φύλλο μπορεί να λέγεται `A1`, `TRUE` ή `SUM`, και σε καθεμία από αυτές τις
  // περιπτώσεις το `!` που ακολουθεί λέει ρητά *«αυτό ήταν όνομα φύλλου»*. Ένα βήμα πιο
  // κάτω, το `=A1!B2` θα διαβαζόταν ως αναφορά στο κελί `A1` ακολουθούμενη από σκουπίδια.
  if (peekPunct(reader) === '!') return parseSheetQualified(reader, name);

  const literal = BOOLEAN_LITERALS[name.toUpperCase()];
  if (literal !== undefined) return { kind: 'boolean', value: literal };

  if (peekPunct(reader) === ':' || isWrittenAddressShape(name)) {
    return parseReference(reader, name, HOME_SHEET);
  }
  return { kind: 'name', name };
}

/**
 * 🔴 ADR-833 Φάση 7 — **`Φύλλο2!A1`**: το όνομα φύλλου λύνεται σε **ταυτότητα** εδώ, μία φορά,
 * και μετά πετιέται — ακριβώς όπως το `A1` γίνεται `rowId`/`colId` δύο γραμμές παρακάτω.
 *
 * ## Άγνωστο φύλλο ⇒ `#REF!`, όχι «δεν είναι τύπος»
 * Είναι αποτυχία **δεσίματος**, όχι σύνταξης — η ίδια κρίση που παίρνει ήδη το `=A99` σε
 * πίνακα πέντε γραμμών (δες την κεφαλίδα του module). Ο τύπος αποθηκεύεται και το κελί δείχνει
 * `#REF!`, που είναι ό,τι ακριβώς δείχνει και το Excel για φύλλο που διαγράφηκε.
 *
 * ⚠️ Οι μονάδες της διεύθυνσης **καταναλώνονται κανονικά** πριν επιστραφεί το σφάλμα. Μια
 * πρόωρη έξοδος θα άφηνε το `A1` πίσω, ο έλεγχος `reader.at !== tokens.length` θα κοκκίνιζε,
 * και το `=Φύλλο9!A1` θα γινόταν **σκέτο κείμενο** αντί για `#REF!` — δύο διαφορετικές
 * απαντήσεις στο ίδιο λάθος, ανάλογα με το αν ο χρήστης έγραψε υπαρκτό φύλλο.
 */
function parseSheetQualified(reader: Reader, sheetName: string): TableFormulaNode | null {
  if (!eatPunct(reader, '!')) return null;
  const address = peek(reader);
  if (address?.kind !== 'name') return null;
  reader.at += 1;

  const id = reader.book.naming.idOf(sheetName);
  return parseReference(reader, address.value, id === null ? UNKNOWN_SHEET : namedSheet(id));
}

/**
 * Το φύλλο μιας **γραμμένης** διεύθυνσης. Διακριτή ένωση και όχι `TableWorksheetId | null`:
 * υπάρχουν **τρεις** καταστάσεις που δεν επιτρέπεται να συγχυστούν — «δεν γράφτηκε φύλλο»,
 * «γράφτηκε και βρέθηκε», «γράφτηκε και **δεν** βρέθηκε» — και η τρίτη είναι η μόνη που
 * παράγει `#REF!`. Με `null` για δύο από αυτές, ένα `=Φύλλο9!A1` θα διαβαζόταν σιωπηλά ως
 * αναφορά στο **δικό μας** φύλλο.
 */
type WrittenSheet =
  | { readonly kind: 'home' }
  | { readonly kind: 'named'; readonly id: TableWorksheetId }
  | { readonly kind: 'unknown' };

const HOME_SHEET: WrittenSheet = { kind: 'home' };
const UNKNOWN_SHEET: WrittenSheet = { kind: 'unknown' };
const namedSheet = (id: TableWorksheetId): WrittenSheet => ({ kind: 'named', id });

/**
 * Λίστα ορισμάτων χωρισμένη με τον διαχωριστή **της γραμματικής**. Καμία συνάρτηση χωρίς
 * παρενθέσεις.
 */
function parseCall(reader: Reader, name: string): TableFormulaNode | null {
  if (!eatPunct(reader, '(')) return null;
  reader.depth += 1;
  const args: TableFormulaNode[] = [];

  if (!eatPunct(reader, ')')) {
    for (;;) {
      const arg = parseArgument(reader);
      if (arg === null) return null;
      args.push(arg);
      if (eatPunct(reader, ')')) break;
      if (!eatPunct(reader, reader.grammar.argumentSeparator)) return null;
    }
  }

  reader.depth -= 1;
  // Κανονικοποίηση σε κεφαλαία: `sum` και `Sum` είναι η **ίδια** συνάρτηση, και το μητρώο
  // δεν πρέπει να μάθει ποτέ δεύτερη γραφή του ίδιου ονόματος.
  return { kind: 'call', name: name.toUpperCase(), args };
}

/**
 * 🔴 ADR-765 — **ένα όρισμα, ή η ρητή απουσία του**: το κενό ανάμεσα στα δύο `;` του
 * `=IF(A1>10;;99)`.
 *
 * ## Γιατί το κενό είναι ΓΛΩΣΣΑ και όχι συντακτικό σφάλμα
 * Ο ίδιος ο διάλογος «Ορίσματα συνάρτησης» **παράγει** αυτή τη γραφή: το
 * `catalog/formula-call-text.ts` τεκμηριώνει ρητά ότι «τα κενά **τελευταία** ορίσματα
 * κόβονται, τα **ενδιάμεσα** γράφονται», γιατί μια κοπή θα στοίβαζε το `99` στη θέση του
 * *τιμή αν αληθές* — δηλαδή θα άλλαζε **σιωπηλά τη σημασία** του τύπου. Ο αναλυτής όμως το
 * απέρριπτε, οπότε το κείμενο που ο διάλογος έγραφε σωστά κατέληγε **ωμό κείμενο στο κελί**
 * (ADR-763 §19.9): μία απόφαση, δύο αρχεία, αντίθετες απαντήσεις.
 *
 * ⚠️ Δεν καταναλώνει τίποτα. Ο βρόχος του {@link parseCall} διαβάζει μετά τον διαχωριστή ή
 * την κλειστή παρένθεση, ακριβώς όπως και για κάθε άλλο όρισμα — γι' αυτό το κενό δεν μπορεί
 * ποτέ να «καταπιεί» το επόμενο όρισμα ούτε να μετατοπίσει τη σειρά τους.
 */
function parseArgument(reader: Reader): TableFormulaNode | null {
  const punct = peekPunct(reader);
  if (punct === ')' || punct === reader.grammar.argumentSeparator) return { kind: 'blank' };
  return parseBinary(reader, 0);
}

/**
 * `A1`, `$A$1` ή `A1:B5` → κόμβος δεμένος σε ταυτότητες· `#REF!` όταν δείχνει εκτός πλέγματος.
 *
 * Το δέσιμο **δεν** γράφεται εδώ: το ζητά από το `table-formula-absolute.ts`, που είναι ο ένας
 * ιδιοκτήτης του «τι σημαίνει μια γραμμένη διεύθυνση» — πεζά, bijective base-26, όρια
 * πλέγματος και, από το ADR-754 Γ2, η αποκόλληση του `$`.
 */
function parseReference(reader: Reader, name: string, sheet: WrittenSheet): TableFormulaNode {
  const from = resolveAddress(reader, name, sheet);

  if (peekPunct(reader) === ':') {
    const next = reader.tokens[reader.at + 1];
    if (next?.kind !== 'name') return { kind: 'error', code: '#REF!' };
    reader.at += 2;
    // 🔴 ADR-833 Φάση 7 — **το άκρο κληρονομεί το φύλλο του πρώτου**, όπως στο Excel: το
    // `Φύλλο2!A1:B5` σημαίνει `Φύλλο2!A1:Φύλλο2!B5`. Ένα εύρος με άκρα σε δύο φύλλα δεν είναι
    // ορθογώνιο — δες `sameSheetRefs` — και η κληρονομιά το κάνει **αδύνατο να εκφραστεί** από
    // αυτή τη διαδρομή, αντί να το απορρίπτει παρακάτω.
    const to = resolveAddress(reader, next.value, sheet);
    if (from === null || to === null) return { kind: 'error', code: '#REF!' };
    return { kind: 'range', from, to };
  }

  return from === null ? { kind: 'error', code: '#REF!' } : { kind: 'ref', cell: from };
}

/**
 * Μια γραμμένη διεύθυνση → ταυτότητες, **στο πλέγμα του φύλλου της**.
 *
 * ⚠️ Το `worksheetId` μπαίνει **μόνο** όταν γράφτηκε ρητά. Ένα άνευ όρων πεδίο θα υλοποιούσε
 * το σπίτι σε κάθε αναφορά κάθε τύπου — δηλαδή θα άλλαζε το JSON **κάθε υπάρχοντος πίνακα**
 * χωρίς να προσθέτει πληροφορία, και θα κατέστρεφε την εγγύηση «σχέδιο που μόνο διαβάστηκε
 * μένει byte-identical» (ADR-833 §5.2).
 */
function resolveAddress(
  reader: Reader,
  name: string,
  sheet: WrittenSheet,
): TableFormulaCellRef | null {
  if (sheet.kind === 'unknown') return null;
  const sheetId = sheet.kind === 'named' ? sheet.id : reader.book.homeId;
  const model = reader.book.sheets.get(sheetId);
  if (model === undefined) return null;

  const ref = resolveWrittenCellRef(model, name);
  if (ref === null) return null;

  // 🔴 ADR-833 Φάση 7 — **ΤΟ ΔΙΚΟ ΜΑΣ ΦΥΛΛΟ ΓΡΑΜΜΕΝΟ ΡΗΤΑ ΚΑΝΟΝΙΚΟΠΟΙΕΙΤΑΙ ΣΕ ΑΠΟΥΣΙΑ.**
  // Το `=Φύλλο1!A1` πληκτρολογημένο **μέσα** στο Φύλλο1 σημαίνει ό,τι και το `=A1`. Το Excel
  // κάνει ακριβώς την ίδια κανονικοποίηση, και εδώ κερδίζει τρία πράγματα ταυτόχρονα:
  //
  //  1. **Το JSON μένει byte-identical** για κάθε τύπο που δεν βγαίνει από το φύλλο του.
  //  2. Η γραμμή τύπων δεν αποκτά πρόθεμα που ο χρήστης δεν χρειάζεται να δει.
  //  3. 🔑 **`worksheetId` παρόν ⟺ ΞΕΝΟ φύλλο** — και αυτό το κάνει κατηγόρημα που μπορεί να
  //     ρωτηθεί **χωρίς βιβλίο**. Πάνω του στηρίζονται η μετακόμιση (`table-formula-remap`)
  //     και η δομική θεραπεία, που είναι πράξεις **ενός** πλέγματος και οφείλουν να αφήνουν
  //     τις ξένες αναφορές άθικτες. Χωρίς την κανονικοποίηση, ένα `=Φύλλο1!A1` γραμμένο στο
  //     Φύλλο1 θα ήταν «ξένο» για εκείνες και θα **έπαυε σιωπηλά** να ακολουθεί τις γραμμές του.
  if (sheet.kind !== 'named' || sheet.id === reader.book.homeId) return ref;
  return { ...ref, worksheetId: sheet.id };
}
