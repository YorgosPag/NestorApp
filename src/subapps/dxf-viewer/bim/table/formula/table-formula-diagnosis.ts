/**
 * 🔴 ADR-761 — **ΚΑΝΕΝΑ ΣΙΩΠΗΛΟ ΚΕΙΜΕΝΟ ΠΟΥ ΜΟΙΑΖΕΙ ΜΕ ΤΥΠΟ.**
 * Καθαρή συνάρτηση· μηδέν React, μηδέν i18n (το κείμενο ανήκει στον καταναλωτή).
 *
 * ## Το πρόβλημα που λύνει
 * Ένα `=…` που δεν αναλύεται μένει **αυτούσιο κείμενο** (ADR-739 Φ.Ζ) — και η απόφαση είναι
 * σωστή: τίποτα δεν χάνεται, ο χρήστης βλέπει ό,τι πληκτρολόγησε. Αλλά μένει **σιωπηλά**,
 * και η σιωπή είναι το μισό ελάττωμα: ο ιδιοκτήτης έγραψε `=CONCATENATE(A2;" ";A3)`, είδε
 * το κείμενό του στο κελί, και **δεν είχε τρόπο να μάθει γιατί**. Το Excel δίνει διάλογο,
 * τα Sheets `#ERROR!` με μήνυμα· εδώ δεν υπήρχε τίποτα.
 *
 * ## Τρεις καταστάσεις, και **πότε** επιτρέπεται να φανεί η καθεμία
 * | Κατάσταση | Τι σημαίνει | Πότε δείχνεται |
 * |---|---|---|
 * | `refused-function` | συνάρτηση αποκλεισμένη **επίτηδες** (§49) | **όσο γράφει** |
 * | `other-grammar` | αναλύεται μόνο στην άλλη γραφή ⇒ **θα γίνει δεκτό** | **όσο γράφει** |
 * | `not-a-formula` | δεν αναλύεται πουθενά ⇒ **θα μείνει κείμενο** | **μόνο δεσμευμένο** |
 *
 * 🔑 Το `not-a-formula` **απαγορεύεται** να δείχνεται όσο πληκτρολογεί ο χρήστης: κάθε τύπος
 * περνά αναγκαστικά από ενδιάμεσα άκυρα στάδια (`=`, `=S`, `=SU`, `=SUM(`), οπότε ένα ζωντανό
 * μήνυμα θα ήταν **μονίμως αναμμένο** μέχρι τον τελευταίο χαρακτήρα — δηλαδή θόρυβος που ο
 * χρήστης μαθαίνει να αγνοεί, και επομένως χειρότερος από τη σιωπή. Την ίδια διάκριση κάνει
 * το Excel: ελέγχει στη **δέσμευση**.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-diagnosis
 * @see library/formula-library-hint.ts — η **υπάρχουσα** εξήγηση αποκλεισμού· δεν αντιγράφεται
 * @see docs/centralized-systems/reference/adrs/ADR-761-table-formula-grammar.md
 */

import type { TableFormulaGrammar } from '../../../types/table-formula-grammar';
import { findFormulaRefusal } from './library/formula-library-hint';
import type { FormulaLibraryRejection } from './library/formula-library-taxonomy';
import { alternateFormulaGrammar, drawingFormulaGrammar } from './table-formula-grammar';
import { isFormulaInput, isParseableFormula } from './table-formula-parse';

/** Τι έχει να πει το εργαλείο για το κείμενο ενός κελιού. */
export type FormulaDiagnosis =
  /** Συνάρτηση που υπάρχει στο Excel και **αποκλείστηκε** — ο λόγος είναι απόφαση (§49). */
  | { readonly kind: 'refused-function'; readonly name: string; readonly reason: FormulaLibraryRejection }
  /**
   * Γράφτηκε στην **άλλη** γραμματική. Δεν είναι σφάλμα — η ανεκτική εφεδρεία θα το δεχτεί
   * και η γραμμή τύπων θα το ξαναγράψει. Το μήνυμα **διδάσκει**, δεν τιμωρεί.
   */
  | { readonly kind: 'other-grammar'; readonly separator: string }
  /** Δεν αναλύεται σε **καμία** γραμματική ⇒ αποθηκεύεται ως κείμενο. */
  | { readonly kind: 'not-a-formula'; readonly separator: string };

/**
 * Η διάγνωση ενός κειμένου κελιού, ή `null` όταν δεν χρειάζεται καμία.
 *
 * @param text το πρόχειρο ή το δεσμευμένο κείμενο, **με** το `=`
 * @param committed `true` όταν το κείμενο είναι **δεσμευμένο** (ο χρήστης δεν πληκτρολογεί
 *   πια). Μόνο τότε επιτρέπεται το `not-a-formula` — δες την κεφαλίδα.
 */
export function diagnoseFormulaText(text: string, committed: boolean): FormulaDiagnosis | null {
  if (!isFormulaInput(text)) return null;

  // Η αποκλεισμένη συνάρτηση προηγείται: είναι **συγκεκριμένη** πληροφορία για συγκεκριμένο
  // όνομα, ενώ οι άλλες δύο μιλούν για ολόκληρο το κείμενο. Ένα «δεν αναγνωρίζεται» πάνω από
  // ένα `=TODAY()` θα ήταν αληθές και άχρηστο.
  const refusal = findFormulaRefusal(text);
  if (refusal !== null) {
    return { kind: 'refused-function', name: refusal.name, reason: refusal.reason };
  }

  const grammar = drawingFormulaGrammar();
  if (isParseableFormula(text, grammar)) return null;

  const separator = grammar.argumentSeparator;
  const alternate = alternateFormulaGrammar(grammar);
  if (isParseableFormula(text, alternate)) return { kind: 'other-grammar', separator };

  return committed ? { kind: 'not-a-formula', separator } : null;
}

// ADR-700 §4 (2026-08-24): drawingArgumentSeparator() ΔΙΑΓΡΑΦΗΚΕ — μηδέν καταναλωτές. Κάθε
// πραγματικό σημείο κλήσης (production + tests) διαβάζει ήδη απευθείας
// `drawingFormulaGrammar().argumentSeparator` — το wrapper δεν υιοθετήθηκε ποτέ.
