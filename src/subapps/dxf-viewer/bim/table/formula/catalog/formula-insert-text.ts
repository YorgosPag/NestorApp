/**
 * ADR-763 §5 — **τι γράφεται στο κελί όταν πατηθεί το «OK»**. Καθαρή συνάρτηση: κείμενο και
 * θέση κέρσορα μέσα, κείμενο και θέση κέρσορα έξω. Χωρίς DOM, χωρίς store, χωρίς React.
 *
 * ## 🔴 Οι δύο περιπτώσεις ΔΕΝ είναι η ίδια με παράμετρο
 * - **Το κελί δεν περιέχει τύπο** ⇒ ο διάλογος **ξεκινά** τύπο: το περιεχόμενο αντικαθίσταται
 *   από `=ΟΝΟΜΑ()`. Είναι η συμπεριφορά του Excel και είναι η μόνη συνεπής: το `fx` πάνω σε
 *   κελί με κείμενο «Σκυρόδεμα» δεν μπορεί να παράγει `Σκυρόδεμα=SUM()`, που δεν είναι ούτε
 *   κείμενο ούτε τύπος.
 * - **Το κελί περιέχει ήδη τύπο υπό συγγραφή** ⇒ ο διάλογος **εμφυτεύει** την κλήση στη θέση
 *   του κέρσορα: `=B2*|` + `SUM` ⇒ `=B2*SUM(|)`. Αυτό είναι που κάνει τον διάλογο χρήσιμο
 *   μέσα σε σύνθετη έκφραση αντί για «άνοιγμα καθαρού τύπου» μόνο.
 *
 * ## Ο κέρσορας πάει **ΜΕΣΑ** στις παρενθέσεις, πάντα
 * Χωρίς τον διάλογο ορισμάτων (Φάση 2), αυτό είναι ολόκληρη η υπόσχεση της εντολής: ο χρήστης
 * βρήκε το όνομα, το έγραψε σωστά, και συνεχίζει να πληκτρολογεί **ορίσματα** — όχι να ψάχνει
 * πού είναι η ανοιχτή παρένθεση. Μια θέση στο τέλος θα ακύρωνε το μισό κέρδος.
 *
 * @module subapps/dxf-viewer/bim/table/formula/catalog/formula-insert-text
 * @see bim/table/formula/table-formula-lex.ts — `formulaBodyStart`, ο ΕΝΑΣ ορισμός του «είναι τύπος»
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §5
 */

import { FORMULA_PREFIX, formulaBodyStart } from '../table-formula-lex';

/** Το πρόχειρο μετά την εισαγωγή, μαζί με τη θέση όπου πρέπει να σταθεί ο κέρσορας. */
export interface FormulaInsertResult {
  readonly draft: string;
  /** Δείκτης **μέσα** στις παρενθέσεις της νέας κλήσης. */
  readonly caretIndex: number;
}

export interface FormulaInsertParams {
  /** Το τρέχον πρόχειρο — μπορεί να είναι κενό, κείμενο, ή τύπος υπό συγγραφή. */
  readonly draft: string;
  /**
   * Πού βρισκόταν ο κέρσορας τη στιγμή που άνοιξε ο διάλογος. `undefined` όταν κανένα πεδίο
   * της συνεδρίας δεν είχε την εστίαση ⇒ **τέλος του προχείρου**, που είναι και η μόνη θέση
   * που δεν μπορεί να είναι λάθος.
   */
  readonly caretIndex?: number;
  /** Το όνομα με τη γραφή του Excel (`CEILING.MATH`), όπως το δίνει ο κατάλογος. */
  readonly functionName: string;
}

/**
 * Το κείμενο και η θέση κέρσορα μετά την εισαγωγή της συνάρτησης.
 *
 * ⚠️ Ο δείκτης **περιορίζεται** στα όρια του προχείρου πριν χρησιμοποιηθεί: το πεδίο και το
 * store είναι δύο διαφορετικά αντικείμενα, και ένας δείκτης από παλαιότερο, μακρύτερο κείμενο
 * θα έκοβε τη συμβολοσειρά σε θέση που δεν υπάρχει — δηλαδή θα παρήγαγε σιωπηλά άλλον τύπο
 * από αυτόν που είδε ο χρήστης.
 */
export function insertFunctionCall(params: FormulaInsertParams): FormulaInsertResult {
  const { draft, caretIndex, functionName } = params;
  const call = `${functionName}(`;

  // Δεν είναι τύπος (ούτε καν κενό κελί): ο διάλογος ξεκινά καθαρό τύπο. Ο `FORMULA_PREFIX`
  // διαβάζεται από τον λεξικογράφο και δεν ξαναγράφεται εδώ ως `'='` — ένα σύμβολο, ένας
  // ορισμός, όπως και ο έλεγχος «είναι τύπος;» ακριβώς από πάνω.
  if (formulaBodyStart(draft) === null) {
    const started = `${FORMULA_PREFIX}${call})`;
    return { draft: started, caretIndex: started.length - 1 };
  }

  const at = clamp(caretIndex ?? draft.length, 0, draft.length);
  const next = `${draft.slice(0, at)}${call})${draft.slice(at)}`;
  return { draft: next, caretIndex: at + call.length };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return max;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
