/**
 * ADR-754 — **η υπόδειξη κελιού με το ποντίκι, ως ερώτηση προς το κείμενο**.
 *
 * Ο χρήστης γράφει `=` σε ένα κελί και κάνει κλικ σε ένα άλλο· η διεύθυνσή του (`E4`) πρέπει
 * να μπει στη θέση του δρομέα. Το ερώτημα που λύνει αυτό το αρχείο είναι **ένα**: «δεδομένου
 * του κειμένου και της θέσης του δρομέα, τι σημαίνει τώρα ένα κλικ σε κελί;»
 *
 * ## 🔴 Γιατί ΔΕΝ υπάρχει σημαία «είμαι σε υπόδειξη»
 * Η προφανής υλοποίηση είναι μια τέταρτη τιμή στο `TableCellCursorMode` — και είναι λάθος
 * για τον λόγο που το ίδιο το `useTableCellDoubleClickEditor` έχει ήδη γραμμένο στην
 * κεφαλίδα του: **μην αποθηκεύεις ό,τι μπορεί να παραχθεί**. Μια σημαία πρέπει να μπαίνει
 * στο `=`, να βγαίνει σε κάθε ψηφίο, σε κάθε `)`, σε `Escape`, σε `F2`, σε `Enter`, σε
 * αναίρεση, και σε κάθε **μελλοντικό** μονοπάτι που θα αγγίξει το κείμενο. Η πρώτη φορά που
 * θα ξεχαστεί ένα από αυτά, το επόμενο κλικ του χρήστη θα γράψει `E4` **μέσα σε κείμενο που
 * δεν είναι τύπος** — σιωπηλά.
 *
 * Εδώ η κατάσταση **είναι** το κείμενο. Δεν υπάρχει τίποτα να συγχρονιστεί επειδή δεν
 * υπάρχει δεύτερο αντίγραφο: κάθε πληκτρολόγηση αλλάζει το draft, άρα αλλάζει την απάντηση.
 * `Enter`, `Escape`, `F2` και η πληκτρολόγηση **δεν χρειάστηκαν καμία γραμμή** — και αυτό
 * είναι το μέτρο ότι η απόφαση ήταν σωστή, όχι απλώς κομψή.
 *
 * ## Ο λεξικογράφος απαντά, όχι ένα regex
 * Το «τι υπάρχει αριστερά του δρομέα;» είναι **λεξική** ερώτηση, και η γραμματική έχει ήδη
 * έναν ιδιοκτήτη (`table-formula-lex.ts`). Ένα δεύτερο, «ελαφρύ» regex εδώ θα ήταν δεύτερη
 * γραμματική: θα συμφωνούσε σήμερα και θα απέκλινε την πρώτη φορά που η πρώτη δεχτεί νέο
 * χαρακτήρα — δηλαδή θα έδινε **λάθος απάντηση σε σωστό τύπο** (N.18).
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-point-state
 * @see table-formula-reference-edit.ts — τι *κάνει* το κλικ αφού απαντηθεί το «τι σημαίνει»
 * @see ../table-cell-reference.ts — η μοναδική μετάφραση `E4` ⇄ ταυτότητες
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §1
 */

import type { TableModel } from '../../../types/table';
import type { TableFormulaGrammar } from '../../../types/table-formula-grammar';
import { resolveWrittenCellRef } from './table-formula-absolute';
import { drawingFormulaGrammar } from './table-formula-grammar';
import {
  continuesLexeme,
  formulaBodyStart,
  tokenizeFormula,
  type TableFormulaToken,
} from './table-formula-lex';

/**
 * Τι σημαίνει **τώρα** ένα κλικ σε κελί. Οι δείκτες μετρούν πάνω στο **πλήρες** κείμενο του
 * επεξεργαστή (μαζί με το `=` και τυχόν αρχικά κενά) — αυτό είναι το σύστημα συντεταγμένων
 * του `selectionStart`, δηλαδή αυτό που θα χρησιμοποιήσει ο καταναλωτής χωρίς μετάφραση.
 */
export type FormulaPointState =
  /** Το κλικ σημαίνει ό,τι σήμαινε πάντα: δέσμευση και μετακίνηση δρομέα. */
  | { readonly kind: 'off' }
  /** Αναμένεται τελεστέος: το κλικ **εισάγει** αναφορά στη θέση `at`. */
  | { readonly kind: 'armed'; readonly at: number }
  /** Μόλις μπήκε αναφορά και δεν ακολούθησε τελεστής: το κλικ την **αντικαθιστά**. */
  | { readonly kind: 'liveRef'; readonly from: number; readonly to: number };

const OFF: FormulaPointState = { kind: 'off' };

/**
 * Τα σημεία στίξης μετά από τα οποία η γραμματική περιμένει τελεστέο. Το `:` περιλαμβάνεται
 * επίτηδες: μετά το `A1:` το επόμενο κλικ ορίζει το **άλλο άκρο** του εύρους.
 *
 * Ο διαχωριστής έρχεται από τη {@link TableFormulaGrammar} (ADR-761) και **δεν** γράφεται
 * εδώ: μια δική του λίστα θα ήταν πέμπτος ορισμός του «τι χωρίζει ορίσματα», που θα έμενε
 * `,` την ημέρα που η γραμματική γίνει `;` — δηλαδή η υπόδειξη κελιού θα σταματούσε σιωπηλά
 * να οπλίζεται μετά από κάθε διαχωριστή (N.18).
 */
function expectsOperand(token: TableFormulaToken, grammar: TableFormulaGrammar): boolean {
  if (token.kind === 'op') return true;
  if (token.kind !== 'punct') return false;
  return token.value === '(' || token.value === ':' || token.value === grammar.argumentSeparator;
}

/**
 * True όταν η μονάδα είναι όνομα που ονομάζει υπαρκτό κελί του μοντέλου — **μαζί με τις
 * απόλυτες μορφές** (`$A$1`), γιατί μια κλειδωμένη αναφορά είναι εξίσου ζωντανή: ο χρήστης
 * που πάτησε `F4` και μετά κάνει κλικ αλλού θέλει **αντικατάσταση**, όχι δεύτερη αναφορά.
 */
function isCellName(model: TableModel, token: TableFormulaToken | undefined): boolean {
  return token?.kind === 'name' && resolveWrittenCellRef(model, token.value) !== null;
}

/**
 * Πού **αρχίζει** η ζωντανή αναφορά, ή `null` αν δεν υπάρχει.
 *
 * Ο έλεγχος της προηγούμενης μονάδας δεν είναι διακοσμητικός: χωρίς αυτόν, το `SUM` του
 * `=SUM` θα περνούσε για αναφορά αν υπήρχε στήλη `SUM`… και το κλικ θα έσβηνε το όνομα της
 * συνάρτησης. Μια αναφορά είναι «ζωντανή» μόνο εκεί όπου η γραμματική περίμενε τελεστέο.
 *
 * ## 🔴 Το εύρος αντικαθίσταται ΟΛΟΚΛΗΡΟ
 * Στο `=SUM(A1:B2` η τελευταία μονάδα είναι το `B2` — και η προφανής υλοποίηση αντικαθιστά
 * **μόνο** αυτό, δίνοντας `=SUM(A1:A1:C3`. Ένα εύρος είναι **μία** αναφορά με τρεις μονάδες·
 * ο χρήστης που ξανασύρει δεν διορθώνει το κάτω δεξιά άκρο, διαλέγει **άλλη περιοχή**.
 * *(Το βρήκε το test της αλυσίδας κλικ, όχι η ανάγνωση του κώδικα.)*
 */
function liveReferenceStart(
  model: TableModel,
  tokens: readonly TableFormulaToken[],
  grammar: TableFormulaGrammar,
): number | null {
  const last = tokens[tokens.length - 1];
  if (last === undefined || !isCellName(model, last)) return null;

  const previous = tokens[tokens.length - 2];
  if (previous === undefined) return last.start;

  if (previous.kind === 'punct' && previous.value === ':') {
    const head = tokens[tokens.length - 3];
    if (head === undefined || !isCellName(model, head)) return null;
    const beforeRange = tokens[tokens.length - 4];
    return beforeRange === undefined || expectsOperand(beforeRange, grammar) ? head.start : null;
  }

  return expectsOperand(previous, grammar) ? last.start : null;
}

/**
 * Η μία ερώτηση αυτού του module. Καθαρή: ίδιο κείμενο + ίδιος δρομέας ⇒ ίδια απάντηση.
 *
 * Σαρώνει **μόνο ό,τι είναι αριστερά του δρομέα**. Είναι η ίδια στάση με τον Excel — το
 * κείμενο δεξιά δεν αλλάζει το τι περιμένει η γραμματική **εδώ** — και έχει μια πρακτική
 * συνέπεια: ένας μισογραμμένος τύπος με σκουπίδια στο τέλος δεν ακυρώνει την υπόδειξη στο
 * σημείο που ο χρήστης πραγματικά δουλεύει.
 */
export function resolveFormulaPointState(
  model: TableModel,
  draft: string,
  caretIndex: number,
): FormulaPointState {
  const bodyStart = formulaBodyStart(draft);
  if (bodyStart === null) return OFF;
  if (caretIndex < bodyStart || caretIndex > draft.length) return OFF;

  // 🔑 Η γραμματική **του σχεδίου**, όχι παράμετρος: ο επεξεργαστής δείχνει πάντα ό,τι
  // τυπώνει το `cellInputText`, δηλαδή αυτήν. Η εφεδρική γραμματική (ADR-761) ζει
  // αποκλειστικά στη **δέσμευση** — όσο ο χρήστης γράφει στην άλλη γραφή, η υπόδειξη κελιού
  // απλώς δεν οπλίζεται, που είναι υποβάθμιση και όχι σφάλμα.
  const grammar = drawingFormulaGrammar();
  const body = draft.slice(bodyStart);
  const caretInBody = caretIndex - bodyStart;
  const tokens = tokenizeFormula(body.slice(0, caretInBody), grammar);
  if (tokens === null) return OFF;

  const last = tokens[tokens.length - 1];
  // Ο δρομέας αμέσως μετά το `=` — το πρώτο και συνηθέστερο «οπλισμένο» σημείο.
  if (last === undefined) return { kind: 'armed', at: caretIndex };

  // Ο δρομέας κόβει λέξη που πληκτρολογείται ακόμη (`=A1|2`): το κλικ δεν έχει δικαίωμα.
  if (continuesLexeme(body[caretInBody], grammar)) return OFF;

  if (expectsOperand(last, grammar)) return { kind: 'armed', at: caretIndex };

  const liveStart = liveReferenceStart(model, tokens, grammar);
  if (liveStart !== null) {
    return { kind: 'liveRef', from: bodyStart + liveStart, to: caretIndex };
  }
  return OFF;
}
