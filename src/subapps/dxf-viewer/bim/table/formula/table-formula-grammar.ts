/**
 * 🔴 ADR-761 — **ο επιλογέας γραμματικής**: locale του σχεδίου → πώς γράφεται ένας τύπος.
 * Καθαρές συναρτήσεις· μηδέν React/DOM/canvas, μηδέν κατάσταση εκτός ενός μνημονίου `Intl`.
 *
 * ## 🔴 ΤΟ LOCALE ΕΙΝΑΙ ΤΟΥ ΣΧΕΔΙΟΥ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΟΥ ADR-760
 * Δεύτερο locale εδώ θα σήμαινε ότι ένα κελί μπορεί να **δείχνει** `1.200,50` και να
 * **απαιτεί** `1200.50` στην είσοδο — δηλαδή η ακριβής σύγχυση που έφερε αυτό το ADR. Ο
 * επιλογέας διαβάζει το {@link DEFAULT_TABLE_FORMAT_LOCALE}, τη **μία** αυθεντία που όρισε
 * ήδη το ADR-760 §6.3 με δύο δικούς του λόγους (το παραδοτέο δεν αλλάζει με το ποιος το
 * άνοιξε· η διάταξη είναι απομνημονευμένη κατά ταυτότητα μοντέλου).
 *
 * ⚠️ Τη μέρα που το locale γίνει **πεδίο του μοντέλου**, αλλάζει **μόνο** το
 * {@link drawingFormulaGrammar}: παίρνει μοντέλο και ρωτά εκείνο. Κανένας από τους πέντε
 * καταναλωτές της γραμματικής δεν το μαθαίνει ποτέ.
 *
 * ## 🔑 ΓΙΑΤΙ CLDR ΚΑΙ ΟΧΙ ΧΕΙΡΟΓΡΑΦΗ ΛΙΣΤΑ LOCALE
 * Η ερώτηση «είναι το κόμμα η υποδιαστολή αυτής της γλώσσας;» έχει **ήδη** απάντηση μέσα
 * στο `Intl` (δεδομένα CLDR) — την ίδια που χρησιμοποιεί το `table-cell-format.ts` για να
 * τυπώσει τα ψηφία. Μια λίστα `['el-GR', 'de-DE', …]` εδώ θα ήταν **δεύτερη πηγή** για το
 * ίδιο δεδομένο, που αποκλίνει την πρώτη φορά που προστεθεί locale — και θα μπορούσε να
 * δείχνει `1.200,50` ενώ απαιτεί τελεία στην είσοδο, μέσα στο ίδιο κελί.
 *
 * Είναι η ίδια αρχή με το `table-formula-value.ts`: **επαναχρησιμοποιούμε ακριβώς εκεί που
 * η ερώτηση είναι η ίδια**, και γράφουμε δικό μας μόνο εκεί που δεν είναι.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-grammar
 * @see types/table-formula-grammar.ts — ο τύπος και η έρευνα «αποθήκευση ≠ διεπαφή»
 * @see docs/centralized-systems/reference/adrs/ADR-761-table-formula-grammar.md
 */

import {
  CANONICAL_FORMULA_GRAMMAR,
  SEMICOLON_FORMULA_GRAMMAR,
  type TableFormulaGrammar,
} from '../../../types/table-formula-grammar';
import {
  DEFAULT_TABLE_FORMAT_LOCALE,
  type TableFormatLocale,
} from '../../../types/table-cell-format';

/**
 * Μνημόνιο ανά locale. Ο `Intl.NumberFormat` είναι από τα ακριβότερα αντικείμενα του
 * χρόνου εκτέλεσης και η απάντηση δεν αλλάζει ποτέ για το ίδιο locale — ίδιο μοτίβο με τη
 * μνήμη μορφοποιητών του `table-cell-format.ts`.
 */
const GRAMMAR_BY_LOCALE = new Map<string, TableFormulaGrammar>();

/**
 * **Η γραμματική μιας γλώσσας** — κρίνεται από το τι λέει το CLDR για την υποδιαστολή.
 *
 * Κόμμα υποδιαστολή ⇒ ερωτηματικό διαχωριστής. Οποιαδήποτε άλλη υποδιαστολή (τελεία, και
 * θεωρητικά αραβικό `٫`) ⇒ κανονική γραμματική: το κόμμα είναι ελεύθερο, άρα χρησιμεύει ως
 * διαχωριστής.
 *
 * ⚠️ Το `1.1` δεν είναι τυχαίο δείγμα: είναι ο **μικρότερος** αριθμός που έχει σίγουρα
 * ακέραιο **και** δεκαδικό μέρος σε κάθε locale, άρα το `decimal` part υπάρχει πάντα. Με
 * ακέραιο δείγμα το `formatToParts` δεν θα επέστρεφε καθόλου `decimal` και η απάντηση θα
 * έπεφτε σιωπηλά στην προεπιλογή.
 */
export function formulaGrammarForLocale(locale: TableFormatLocale): TableFormulaGrammar {
  const cached = GRAMMAR_BY_LOCALE.get(locale);
  if (cached !== undefined) return cached;

  const decimal = new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find((part) => part.type === 'decimal')?.value;
  const grammar = decimal === ',' ? SEMICOLON_FORMULA_GRAMMAR : CANONICAL_FORMULA_GRAMMAR;

  GRAMMAR_BY_LOCALE.set(locale, grammar);
  return grammar;
}

/**
 * **Η γραμματική αυτού του σχεδίου** — η μία ερώτηση που κάνουν οι πόρτες του
 * `table-formula-engine.ts`.
 *
 * Σήμερα απαντά από τη σταθερά του σχεδίου· αύριο, από πεδίο του μοντέλου. Υπάρχει ως
 * ξεχωριστή συνάρτηση **ακριβώς** για να είναι εκείνη η μέρα μία αλλαγή σε ένα σημείο,
 * αντί για αναζήτηση σε πέντε αρχεία.
 */
export function drawingFormulaGrammar(): TableFormulaGrammar {
  return formulaGrammarForLocale(DEFAULT_TABLE_FORMAT_LOCALE);
}

/**
 * **Η άλλη γραμματική** — αυτή που δοκιμάζεται όταν η κύρια δεν βγάζει νόημα.
 *
 * ## 🔑 Γιατί αυτό ΔΕΝ είναι μαντεψιά
 * Η εφεδρεία τρέχει **μόνο** εκεί όπου η κύρια ανάλυση **απέτυχε** — δηλαδή εκεί όπου το
 * κείμενο **δεν είχε** νόημα στην κύρια γραμματική. Άρα δεν μπορεί ποτέ να **αλλάξει** ένα
 * νόημα· μπορεί μόνο να **δώσει** νόημα εκεί που δεν υπήρχε κανένα. Η ιδιότητα
 * κατοχυρώνεται με property test πάνω σε corpus (`table-formula-grammar.test.ts`).
 *
 * Το Excel σε τιμωρεί με διάλογο· τα Google Sheets κάνουν **αντικατάσταση συμβολοσειράς**,
 * που η ίδια τους η τεκμηρίωση παραδέχεται ότι αποτυγχάνει σε ένθετες κλήσεις και πίνακες.
 * Εμείς **αναλύουμε** — άρα το αποτέλεσμα είναι ντετερμινιστικό ή ανύπαρκτο, ποτέ κατά
 * προσέγγιση.
 */
export function alternateFormulaGrammar(grammar: TableFormulaGrammar): TableFormulaGrammar {
  // Κρίνεται από την **τιμή** και όχι από την ταυτότητα αντικειμένου: ένας καλών που έφτιαξε
  // ισοδύναμο κυριολεκτικό (τυπικά σε test) θα έπαιρνε αλλιώς τη ΔΙΚΗ του γραμματική πίσω ως
  // «άλλη», και η εφεδρεία θα ήταν σιωπηλά ανενεργή.
  return grammar.argumentSeparator === ';' ? CANONICAL_FORMULA_GRAMMAR : SEMICOLON_FORMULA_GRAMMAR;
}
