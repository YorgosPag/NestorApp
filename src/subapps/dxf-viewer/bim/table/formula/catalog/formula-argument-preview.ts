/**
 * 🔴 ADR-763 Φ2.3 — **η ζωντανή αποτίμηση του διαλόγου**: `= 20` δίπλα σε κάθε όρισμα, και
 * «Αποτέλεσμα =» στο τέλος. Καθαρή συνάρτηση: μοντέλο + κείμενα μέσα, τρία κείμενα έξω.
 *
 * ## Γιατί είναι **η μισή** απόδειξη της υπόδειξης, όχι στολίδι
 * Η Φ2.4 έκανε το κλικ σε κελί να γράφει `A1` στο ενεργό όρισμα. Ο χρήστης όμως δεν βλέπει
 * κελιά — βλέπει **διευθύνσεις**, και μια διεύθυνση δεν λέει αν έδειξε το σωστό πράγμα. Το
 * `= 20` δίπλα της είναι το μόνο που το λέει, και γι' αυτό οι δύο φάσεις παραδίδονται μαζί.
 *
 * ## 🔴 ΔΥΟ αποτιμήσεις, και η διαφορά είναι πραγματική
 * - **`call`** — η κλήση **μόνη της** (`=SUM(A1;B2)`). Απαντά «τι κάνει η συνάρτηση που
 *   φτιάχνω τώρα;».
 * - **`result`** — **ολόκληρο** το πρόχειρο του κελιού (`=B2*SUM(A1;B2)+1`). Απαντά «τι θα
 *   γράψει το κελί όταν πατήσω OK;».
 *
 * Ταυτίζονται στη συνηθισμένη περίπτωση —όπου η κλήση **είναι** ο τύπος— και αποκλίνουν
 * ακριβώς εκεί που ο χρήστης χρειάζεται τη διάκριση: στην **εμφύτευση** (Φ2.5), όπου το `fx`
 * ανοίγει μια εσωτερική κλήση μέσα σε μεγαλύτερη έκφραση. Μία τιμή για τα δύο θα ήταν σωστή
 * σήμερα και **σιωπηλά λάθος** τη μέρα που έρθει η Φ2.5.
 *
 * ## Το κείμενο της κλήσης ΞΑΝΑΧΤΙΖΕΤΑΙ, δεν αποσπάται
 * Η κλήση συντίθεται με τον **ίδιο** {@link buildFormulaCallDraft} που γράφει το κελί — άρα
 * κληρονομεί δωρεάν τον κανόνα «τα κενά **τελευταία** ορίσματα κόβονται, τα **ενδιάμεσα**
 * μένουν». Μια απόσπαση με δείκτες από το πρόχειρο θα ήταν δεύτερη υλοποίηση της ίδιας κοπής,
 * και θα έδινε `=SUM(A1;)` — έγκυρο συντακτικά, με φάντασμα ορίσματος στην αποτίμηση.
 *
 * @module subapps/dxf-viewer/bim/table/formula/catalog/formula-argument-preview
 * @see ../table-formula-engine.ts — ο ΕΝΑΣ δρόμος «κείμενο → τιμή», με την ανεκτική ανάγνωση
 * @see ../table-formula-print.ts — ο ΕΝΑΣ τρόπος να γραφτεί μια τιμή
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §22
 */

import type { TableModel } from '../../../../types/table';
import type { TableFormulaWorkbook } from '../table-formula-workbook';
import { previewFormulaValue } from '../table-formula-engine';
import { FORMULA_PREFIX } from '../table-formula-lex';
import { printFormulaValue } from '../table-formula-print';
import { buildFormulaCallDraft, type FormulaCallFrame } from './formula-call-text';

/** Τα τρία κείμενα που δείχνει ο διάλογος. `''` σημαίνει **«δεν ρωτήθηκε»**, ποτέ «κενό». */
export interface FunctionArgumentsPreview {
  /**
   * 🔴 **Πάντα ίδιο μήκος με τις τιμές που δόθηκαν** — ίδιο συμβόλαιο με τα `spans` του
   * {@link buildFormulaCallDraft}, και για τον ίδιο λόγο: ο καταναλωτής δεικτοδοτεί με τον
   * δείκτη της **σειράς**, και μια μετάφραση «σειρά → θέση» θα έβαζε την τιμή του ενός
   * ορίσματος δίπλα σε **άλλο**. Κανένα σφάλμα· απλώς λάθος αριθμός δίπλα σε λάθος όνομα.
   */
  readonly perArgument: readonly string[];
  readonly call: string;
  readonly result: string;
}

export interface FunctionArgumentsPreviewParams {
  /** `null` όταν ο πίνακας χάθηκε από κάτω (undo, αλλαγή επιπέδου) — τότε όλα είναι `''`. */
  /**
   * 🔴 ADR-833 Φάση 7 — ήταν `model` και έγινε **βιβλίο**: η προεπισκόπηση οφείλει να
   * υπόσχεται **ό,τι ακριβώς** θα έδινε η δέσμευση, και η δέσμευση βλέπει όλα τα φύλλα.
   * Με σκέτο μοντέλο, ένα `=SUM(Φύλλο2!A1:A5)` θα έδειχνε `#REF!` στον διάλογο και
   * σωστό αριθμό στο κελί — δηλαδή η ακριβώς αντίστροφη διαφωνία από εκείνη που έκλεισε
   * ο ADR-764 §8.2 ενοποιώντας τον έναν αναγνώστη.
   */
  readonly book: TableFormulaWorkbook | null;
  readonly functionName: string;
  readonly frame: FormulaCallFrame;
  readonly values: readonly string[];
  /** Ο `argumentSeparator` της γραμματικής του σχεδίου (ADR-761) — **ποτέ** σταθερός εδώ. */
  readonly separator: string;
}

const NOTHING: FunctionArgumentsPreview = { perArgument: [], call: '', result: '' };

export function functionArgumentsPreview(
  params: FunctionArgumentsPreviewParams,
): FunctionArgumentsPreview {
  const { book, functionName, frame, values, separator } = params;
  if (book === null) return { ...NOTHING, perArgument: values.map(() => '') };

  return {
    perArgument: values.map((value) => evaluate(book, FORMULA_PREFIX + value)),
    call: evaluate(book, callText(functionName, values, separator)),
    result: evaluate(book, buildFormulaCallDraft(frame, values, separator).draft),
  };
}

/**
 * Η κλήση **μόνη της**, με τον ίδιο κανόνα κοπής που θα δει και το κελί.
 *
 * Το πλαίσιο κατασκευάζεται εδώ αντί να δανειστεί το πραγματικό: εκείνο κουβαλά ό,τι υπήρχε
 * **γύρω** από την κλήση, που είναι ακριβώς αυτό που η `call` δεν θέλει να μετρήσει.
 */
function callText(functionName: string, values: readonly string[], separator: string): string {
  const frame: FormulaCallFrame = {
    prefix: `${FORMULA_PREFIX}${functionName}(`,
    suffix: ')',
  };
  return buildFormulaCallDraft(frame, values, separator).draft;
}

/**
 * Το κείμενο της τιμής, ή `''` όταν δεν υπάρχει απάντηση.
 *
 * Οι δύο κενές περιπτώσεις είναι **η ίδια** για τον χρήστη —«δεν έχω τι να σου πω ακόμη»— και
 * γι' αυτό δεν διακρίνονται: κενό όρισμα (`=` σκέτο, μη αναλύσιμο) και μισογραμμένος τύπος
 * (`=SUM(A1;`) καταλήγουν και τα δύο στη γκρι οδηγία «τι περιμένω εδώ», που είναι η χρήσιμη
 * πληροφορία εκείνη τη στιγμή.
 */
function evaluate(book: TableFormulaWorkbook, text: string): string {
  const value = previewFormulaValue(book, text);
  return value === null ? '' : printFormulaValue(value);
}
