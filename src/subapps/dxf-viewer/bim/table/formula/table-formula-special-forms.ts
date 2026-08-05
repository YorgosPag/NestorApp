/**
 * ADR-739 §49 — **οι ειδικές μορφές**: οι έξι συναρτήσεις που **δεν** μπορούν να ζήσουν στο
 * μητρώο, γιατί δεν επιτρέπεται να αξιολογηθούν όλα τα ορίσματά τους πριν την κλήση.
 *
 * ## Δύο διαφορετικοί λόγοι, που μοιάζουν ένας
 * - **Τεμπελιά κλάδου** (`IF`, `IFS`, `CHOOSE`, `SWITCH`): το `=IF(A1=0, 0, 1/A1)` είναι ο πιο
 *   συνηθισμένος τύπος σε πίνακα ποσοτήτων — ο φύλακας διαίρεσης. Αν τα ορίσματα
 *   αξιολογούνταν πρώτα, το `1/A1` θα έδινε `#DIV/0!` και ο φύλακας θα προστάτευε από το
 *   τίποτα.
 * - **Διαφάνεια σφάλματος** (`IFERROR`, `IFNA`): ο αξιολογητής διαδίδει το πρώτο σφάλμα
 *   **πριν** καλέσει τη συνάρτηση. Μια `IFERROR` στο μητρώο δεν θα καλούνταν **ποτέ** πάνω σε
 *   σφάλμα — θα επέστρεφε το σφάλμα που υπάρχει για να πιάσει. Δεν είναι λεπτομέρεια
 *   υλοποίησης: είναι ο λόγος που η συνάρτηση υπάρχει.
 *
 * ## 🔴 Οι `AND` / `OR` **δεν** είναι εδώ — και δεν είναι παράλειψη
 * Το Excel **δεν** κάνει βραχυκύκλωση: το `=AND(FALSE; 1/0>1)` δίνει `#DIV/0!`, όχι `FALSE`.
 * Επαληθεύτηκε ότι το ίδιο κάνει και η βιβλιοθήκη. Άρα ο γενικός κανόνας διάδοσης σφάλματος
 * **είναι ήδη** η σωστή συμπεριφορά τους, και μια «βελτίωση» σε βραχυκύκλωση θα ήταν
 * απόκλιση από το Excel — δηλαδή διαφορετικός αριθμός για τον ίδιο τύπο.
 *
 * ## Δεν εισάγει τον αξιολογητή
 * Δέχεται τη συνάρτηση αξιολόγησης ως **όρισμα**. Έτσι δεν υπάρχει κύκλος: ο αξιολογητής
 * ξέρει από ειδικές μορφές, οι ειδικές μορφές δεν ξέρουν από αξιολογητή — ξέρουν μόνο ότι
 * κάποιος μπορεί να μετατρέψει έναν κόμβο σε τιμή, **όποτε** του το ζητήσουν.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-special-forms
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §49
 */

import type { TableFormulaNode } from '../../../types/table-formula';
import {
  compareValues,
  FORMULA_ERROR,
  isFormulaError,
  isTruthy,
  type TableFormulaValue,
} from './table-formula-value';

/** «Δώσε μου την τιμή αυτού του κόμβου» — **όποτε** και **αν** τη ζητήσει η ειδική μορφή. */
export type TableFormulaNodeEvaluator = (node: TableFormulaNode) => TableFormulaValue;

/** Μια ειδική μορφή: παίρνει τα ορίσματα **ανώτατα**, όχι αξιολογημένα. */
export type TableFormulaSpecialForm = (
  evaluate: TableFormulaNodeEvaluator,
  args: readonly TableFormulaNode[],
) => TableFormulaValue;

/** `IF(συνθήκη, τότε[, αλλιώς])` — αξιολογείται **μόνο** ο κλάδος που ισχύει. */
function conditional(
  evaluate: TableFormulaNodeEvaluator,
  args: readonly TableFormulaNode[],
): TableFormulaValue {
  if (args.length < 2 || args.length > 3) return FORMULA_ERROR.value;

  const condition = evaluate(args[0]);
  if (isFormulaError(condition)) return condition;

  if (isTruthy(condition)) return evaluate(args[1]);
  // Παραλειπόμενος τρίτος κλάδος ⇒ `FALSE`, όπως στο Excel: το κελί δηλώνει ότι η συνθήκη
  // δεν ίσχυσε, αντί να δείχνει κενό που δεν ξεχωρίζει από «δεν υπολογίστηκε».
  return args.length === 3 ? evaluate(args[2]) : false;
}

/**
 * `IFS(συνθήκη1, τιμή1, συνθήκη2, τιμή2, …)` — η **πρώτη** που ισχύει.
 *
 * Καμία που να ισχύει ⇒ `#N/A`, όπως στο Excel: το κελί λέει «δεν καλύφθηκε αυτή η
 * περίπτωση», που είναι πληροφορία — ένα κενό θα την έκρυβε.
 */
function conditionalChain(
  evaluate: TableFormulaNodeEvaluator,
  args: readonly TableFormulaNode[],
): TableFormulaValue {
  if (args.length < 2 || args.length % 2 !== 0) return FORMULA_ERROR.value;

  for (let at = 0; at < args.length; at += 2) {
    const condition = evaluate(args[at]);
    if (isFormulaError(condition)) return condition;
    if (isTruthy(condition)) return evaluate(args[at + 1]);
  }
  return FORMULA_ERROR.notAvailable;
}

/** `CHOOSE(θέση, τιμή1, τιμή2, …)` — αξιολογείται **μόνο** η επιλεγμένη. */
function choose(
  evaluate: TableFormulaNodeEvaluator,
  args: readonly TableFormulaNode[],
): TableFormulaValue {
  if (args.length < 2) return FORMULA_ERROR.value;

  const index = evaluate(args[0]);
  if (isFormulaError(index)) return index;

  const position = typeof index === 'number' ? Math.trunc(index) : Number.NaN;
  if (!Number.isFinite(position) || position < 1 || position > args.length - 1) {
    return FORMULA_ERROR.value;
  }
  return evaluate(args[position]);
}

/**
 * `SWITCH(έκφραση, υποψήφια1, αποτέλεσμα1, …[, εξ ορισμού])` — ισότητα με την **ίδια**
 * σύγκριση που χρησιμοποιεί ο τελεστής `=`, ώστε να μην μπορούν ποτέ να διαφωνήσουν.
 */
function switchForm(
  evaluate: TableFormulaNodeEvaluator,
  args: readonly TableFormulaNode[],
): TableFormulaValue {
  if (args.length < 3) return FORMULA_ERROR.value;

  const subject = evaluate(args[0]);
  if (isFormulaError(subject)) return subject;

  let at = 1;
  for (; at + 1 < args.length; at += 2) {
    const candidate = evaluate(args[at]);
    if (isFormulaError(candidate)) return candidate;
    if (compareValues('=', subject, candidate)) return evaluate(args[at + 1]);
  }
  // Περίσσεψε ένα όρισμα ⇒ είναι το «εξ ορισμού». Αλλιώς καμία αντιστοιχία ⇒ `#N/A`.
  return at < args.length ? evaluate(args[at]) : FORMULA_ERROR.notAvailable;
}

/** Ο κοινός σκελετός των `IFERROR`/`IFNA`: αλλάζει μόνο **ποιο** σφάλμα πιάνεται. */
function catching(caught: (value: TableFormulaValue) => boolean): TableFormulaSpecialForm {
  return (evaluate, args) => {
    if (args.length !== 2) return FORMULA_ERROR.value;
    const value = evaluate(args[0]);
    // Ο δεύτερος κλάδος αξιολογείται **μόνο** όταν χρειαστεί: το `=IFERROR(A1/B1, 1/B1)` δεν
    // πρέπει να παράγει δεύτερο σφάλμα όταν το πρώτο ήταν εντάξει.
    return caught(value) ? evaluate(args[1]) : value;
  };
}

/**
 * Οι έξι. Τα ονόματα είναι **κεφαλαία**, όπως στο μητρώο — ο αναλυτής κανονικοποιεί.
 *
 * ⚠️ Καμία από αυτές δεν επιτρέπεται να υπάρχει **και** στο μητρώο: δύο υλοποιήσεις της ίδιας
 * συνάρτησης με διαφορετική σημασιολογία αξιολόγησης είναι το χειρότερο δίδυμο που μπορεί να
 * υπάρξει εδώ. Το επιβάλλει δοκιμή, όχι σχόλιο.
 */
export const TABLE_FORMULA_SPECIAL_FORMS: Readonly<Record<string, TableFormulaSpecialForm>> = {
  IF: conditional,
  IFS: conditionalChain,
  CHOOSE: choose,
  SWITCH: switchForm,
  IFERROR: catching(isFormulaError),
  IFNA: catching((value) => value === FORMULA_ERROR.notAvailable),
};
