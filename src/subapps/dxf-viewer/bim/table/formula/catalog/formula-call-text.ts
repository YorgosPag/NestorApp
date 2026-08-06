/**
 * ADR-763 §14 — **από τα κουτιά του διαλόγου στο κείμενο του κελιού**. Καθαρή συνάρτηση:
 * πλαίσιο κλήσης + τιμές ορισμάτων μέσα, πρόχειρο + θέσεις έξω. Χωρίς DOM, store, React.
 *
 * ## 🔑 ΤΟ ΠΛΑΙΣΙΟ ΕΙΝΑΙ ΔΥΟ ΣΥΜΒΟΛΟΣΕΙΡΕΣ, ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΞΑΝΑΑΝΑΛΥΕΤΑΙ ΤΙΠΟΤΑ
 * Ο διάλογος ξαναγράφει το πρόχειρο σε **κάθε** πληκτρολόγηση (το Excel ενημερώνει τη γραμμή
 * τύπων ζωντανά). Η προφανής υλοποίηση ξαναβρίσκει κάθε φορά «πού είναι οι παρενθέσεις της
 * κλήσης μου» — δηλαδή τρέχει τον αναλυτή πάνω σε κείμενο **που η ίδια μόλις έγραψε**, και
 * κληρονομεί κάθε αμφισημία του: εμφωλευμένες παρενθέσεις μέσα σε όρισμα, κυριολεκτικό
 * κείμενο που περιέχει `)`, μισογραμμένο συντακτικό όσο ο χρήστης πληκτρολογεί.
 *
 * Εδώ το ερώτημα δεν τίθεται ποτέ: ό,τι είναι **αριστερά** των ορισμάτων και ό,τι είναι
 * **δεξιά** τους είναι σταθερά όσο ο διάλογος ζει, και τα κρατάμε αυτούσια. Το πρόχειρο είναι
 * κυριολεκτικά `prefix + <ορίσματα> + suffix`. Δεν υπάρχει περίπτωση να «χαθεί η κλήση»,
 * γιατί κανείς δεν την ψάχνει.
 *
 * Η σύζευξη με τη Φάση 1 είναι ακριβής και δωρεάν: το {@link insertFunctionCall} επιστρέφει
 * ήδη `caretIndex` **μέσα** στις παρενθέσεις, άρα το πλαίσιο είναι το κείμενό του κομμένο
 * ακριβώς εκεί — δες {@link formulaCallFrameFromInsert}.
 *
 * @module subapps/dxf-viewer/bim/table/formula/catalog/formula-call-text
 * @see formula-insert-text.ts — ποιος φτιάχνει το πλαίσιο
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §14
 */

import type { FormulaInsertResult } from './formula-insert-text';

/**
 * Τα δύο αμετάβλητα άκρα της κλήσης που επεξεργάζεται ο διάλογος.
 *
 * `prefix` τελειώνει **μετά** την ανοιχτή παρένθεση (`=SUM(`, ή `=B2*SUM(` σε εμφύτευση) και
 * `suffix` αρχίζει **με** την κλειστή (`)`, ή `)+1` όταν υπήρχε συνέχεια).
 */
export interface FormulaCallFrame {
  readonly prefix: string;
  readonly suffix: string;
}

/**
 * Πού κάθεται ένα όρισμα μέσα στο **πλήρες** πρόχειρο — το σύστημα συντεταγμένων του
 * `selectionStart`, δηλαδή αυτό που καταναλώνει η υπόδειξη κελιού χωρίς μετάφραση.
 */
export interface FormulaArgumentSpan {
  readonly from: number;
  readonly to: number;
}

/** Το πρόχειρο μιας στιγμής, μαζί με τη θέση κάθε ορίσματος μέσα του. */
export interface FormulaCallDraft {
  readonly draft: string;
  /**
   * 🔴 **Πάντα ίδιο μήκος με τις τιμές που δόθηκαν** — και για τα ορίσματα που **κόπηκαν**
   * (δες {@link buildFormulaCallDraft}). Εκείνα παίρνουν εύρος **μηδενικού μήκους** στη θέση
   * όπου θα έμπαιναν, δηλαδή ακριβώς πριν την κλειστή παρένθεση.
   *
   * Η εναλλακτική — κοντύτερος πίνακας — θα φόρτωνε κάθε καταναλωτή με τη μετάφραση
   * «δείκτης κουτιού → δείκτης span», και ο πρώτος που θα την ξεχνούσε θα ρωτούσε για τη
   * θέση του **λάθος** ορίσματος: κανένα σφάλμα, μόνο αναφορά σε άλλο κελί.
   */
  readonly spans: readonly FormulaArgumentSpan[];
}

/**
 * Το πλαίσιο, από το αποτέλεσμα της εισαγωγής της Φάσης 1.
 *
 * Δεν είναι βοηθητικό συντόμευσης: είναι το **ένα** σημείο όπου δηλώνεται ότι το
 * `caretIndex` της εισαγωγής σημαίνει «ανάμεσα στις παρενθέσεις». Η ίδια γνώση γραμμένη στον
 * καταναλωτή θα ήταν δεύτερο αντίγραφο μιας σύμβασης που ζει στο `formula-insert-text.ts`.
 */
export function formulaCallFrameFromInsert(inserted: FormulaInsertResult): FormulaCallFrame {
  return {
    prefix: inserted.draft.slice(0, inserted.caretIndex),
    suffix: inserted.draft.slice(inserted.caretIndex),
  };
}

/**
 * 🔴 **Τα κενά ΤΕΛΕΥΤΑΙΑ ορίσματα δεν γράφονται· τα κενά ΕΝΔΙΑΜΕΣΑ γράφονται.**
 *
 * Η διάκριση δεν είναι κοσμητική. Ο διάλογος δείχνει μία κενή σειρά παραπάνω από όσες
 * γέμισε ο χρήστης (έτσι μεγαλώνει), άρα υπάρχει **πάντα** τουλάχιστον μία κενή στο τέλος:
 * χωρίς την κοπή, κάθε `=CONCATENATE(A1;A2)` θα γραφόταν `=CONCATENATE(A1;A2;)` — έγκυρο
 * συντακτικά, αλλά με ένα φάντασμα ορίσματος που ο χρήστης δεν ζήτησε και θα ξαναδεί την
 * επόμενη φορά που ανοίξει τη συνάρτηση.
 *
 * Το ενδιάμεσο κενό όμως είναι **επιλογή**: το `=IF(A1;;B2)` σημαίνει «τίποτα αν αληθές»,
 * και μια κοπή που στοίβαζε τα υπόλοιπα αριστερά θα άλλαζε τη σημασία του τύπου σιωπηλά —
 * το `B2` θα γινόταν *τιμή αν αληθές*.
 */
function lastFilledIndex(values: readonly string[]): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== '') return index;
  }
  return -1;
}

/**
 * Το πρόχειρο που αντιστοιχεί σε αυτές τις τιμές — και πού κάθεται καθεμιά.
 *
 * ⚠️ Ο `separator` **δίνεται**, δεν μαντεύεται: είναι ο `argumentSeparator` της γραμματικής
 * του σχεδίου (ADR-761), και ένα σταθερό `;` εδώ θα ήταν η επόμενη αυθεντία διαχωριστή —
 * ακριβώς εκείνη που η Φ2.1 έσβησε από τις μεταφράσεις.
 */
export function buildFormulaCallDraft(
  frame: FormulaCallFrame,
  values: readonly string[],
  separator: string,
): FormulaCallDraft {
  const written = lastFilledIndex(values) + 1;
  const spans: FormulaArgumentSpan[] = [];

  let body = '';
  for (let index = 0; index < written; index += 1) {
    if (index > 0) body += separator;
    const from = frame.prefix.length + body.length;
    body += values[index];
    spans.push({ from, to: frame.prefix.length + body.length });
  }

  // Δες το συμβόλαιο του `spans`: τα κομμένα δείχνουν στη θέση όπου θα έμπαιναν.
  const tail = frame.prefix.length + body.length;
  for (let index = written; index < values.length; index += 1) {
    spans.push({ from: tail, to: tail });
  }

  return { draft: `${frame.prefix}${body}${frame.suffix}`, spans };
}

/**
 * Πόσα κουτιά **έχουν περιεχόμενο** — η μία είσοδος που ζητά το `signatureRows` για να
 * αποφασίσει πόσες σειρές δείχνει.
 *
 * Μετρά **μέχρι το τελευταίο γεμάτο**, όχι πόσα είναι μη κενά: ο χρήστης που γέμισε το πρώτο
 * και το τρίτο έχει **τρία** ορίσματα σε χρήση, και η σειρά που μεγαλώνει είναι η τέταρτη.
 * Με ωμή καταμέτρηση θα ήταν η τρίτη — δηλαδή ο διάλογος θα «μάζευε» μια σειρά που ο χρήστης
 * βλέπει γεμάτη.
 */
export function filledArgumentCount(values: readonly string[]): number {
  return lastFilledIndex(values) + 1;
}
