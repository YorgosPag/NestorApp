'use client';

/**
 * ADR-763 §15 — **ο διάλογος «Ορίσματα συνάρτησης»**: τι λένε τα κουτιά, ποιο είναι ενεργό,
 * και τι επαναφέρει το «Άκυρο».
 *
 * ## 🔴 ΓΙΑΤΙ ΟΙ ΤΙΜΕΣ ΤΩΝ ΚΟΥΤΙΩΝ ΕΙΝΑΙ ΕΔΩ ΚΑΙ ΟΧΙ `useState` ΣΤΟ COMPONENT
 * Σε έναν διάλογο που τα γεμίζει μόνο το πληκτρολόγιο, το `useState` θα ήταν σωστό. Αυτός
 * όμως έχει **δεύτερο γραφέα**: η υπόδειξη κελιού (ADR-754) γράφει στο **ενεργό όρισμα** από
 * έναν χειριστή `mousedown` του καμβά — κώδικα που δεν είναι React και δεν έχει καμία
 * πρόσβαση σε τοπική κατάσταση component. Με `useState`, η μόνη διέξοδος θα ήταν ένα ref σε
 * setter δημοσιευμένο σε module — δηλαδή ένα store, γραμμένο κατά λάθος και χωρίς συνδρομητές.
 *
 * ## 🔴 ΕΝΑΣ ΓΡΑΦΕΑΣ ΠΡΟΣ ΤΟ ΚΕΛΙ, ΚΑΙ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * Κάθε μεταβολή τιμής **οφείλει** να ξαναγράψει το πρόχειρο του κελιού: το Excel ενημερώνει
 * τη γραμμή τύπων σε κάθε πληκτρολόγηση, και ο χρήστης βλέπει τον τύπο να χτίζεται. Η
 * εγγραφή γίνεται **μέσα** στην ίδια πράξη και όχι σε `useEffect` του component, για δύο
 * λόγους που μετρήθηκαν αλλού στο subapp:
 *   1. ένα effect γράφει **ένα καρέ αργότερα** — και ο δεύτερος γραφέας (η υπόδειξη) θα
 *      διάβαζε ενδιάμεσα πρόχειρο που δεν αντιστοιχεί στα κουτιά·
 *   2. δύο πηγές για το «πότε γράφεται» είναι δύο πηγές, όσο κι αν συμφωνούν σήμερα.
 * Η διαδρομή παραμένει **μία**: `setTableCellCursorDraftAt` (ADR-754 §4), ποτέ δεύτερη.
 *
 * ## Το «Άκυρο» επαναφέρει το ΠΡΟ ΤΗΣ ΦΑΣΗΣ 1 πρόχειρο
 * Το στιγμιότυπο επαναφοράς **δεν** παράγεται εδώ: τη στιγμή που ανοίγει αυτός ο διάλογος, το
 * κελί περιέχει ήδη το `=ΟΝΟΜΑ()` που έγραψε η Φάση 1. Το «πριν» υπάρχει μόνο στον καλούντα,
 * και γι' αυτό ταξιδεύει ως παράμετρος του {@link openFunctionArgumentsDialog}.
 *
 * @module subapps/dxf-viewer/state/function-arguments-dialog-store
 * @see bim/table/formula/catalog/formula-call-text.ts — η σύνθεση του κειμένου
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §15
 */

import { createExternalStore } from '../stores/createExternalStore';
import {
  buildFormulaCallDraft,
  type FormulaCallFrame,
} from '../bim/table/formula/catalog/formula-call-text';
import { drawingFormulaGrammar } from '../bim/table/formula/table-formula-grammar';
import {
  cancelTableCellCursorSession,
  restartTableCellCursorSession,
  setTableCellCursorDraftAt,
} from './table-cell-cursor-store';

/**
 * Πού γυρνά το κελί με το «Άκυρο» — και **δεν** είναι πάντα μια συμβολοσειρά.
 *
 * ## 🔴 Η ΠΛΟΗΓΗΣΗ ΔΕΝ ΕΙΝΑΙ «ΚΕΝΟ ΠΡΟΧΕΙΡΟ»
 * Το `fx` πατιέται συνήθως πάνω σε κελί που είναι απλώς **επιλεγμένο**, χωρίς ανοιχτή
 * συνεδρία γραφής. Με ενιαίο σχήμα `{ draft, caretIndex }`, το «πριν» εκείνου του κελιού θα
 * καταγραφόταν ως `draft: ''` — και η επαναφορά θα έγραφε **κενό πρόχειρο** σε κελί που
 * περιείχε «Σκυρόδεμα C20/25», αφήνοντάς το ταυτόχρονα σε ανοιχτή γραφή. Δηλαδή το «Άκυρο»
 * θα κατέστρεφε περιεχόμενο, σιωπηλά, στην πιο συνηθισμένη διαδρομή του διαλόγου.
 *
 * Η διακριτή ένωση κάνει την αδύνατη κατάσταση **μη γραπτή**: δεν υπάρχει «πλοήγηση με
 * πρόχειρο». Και οι δύο κλάδοι επαναφέρουν επίσης το πληκτρολόγιο, με τον δικό τους σωστό
 * τρόπο (δες {@link cancelFunctionArgumentsDialog}).
 */
export type FunctionArgumentsRestorePoint =
  /** Το κελί ήταν σε πλοήγηση: η επαναφορά είναι **ακύρωση της συνεδρίας**, όχι εγγραφή. */
  | { readonly kind: 'navigation' }
  /** Το κελί έγραφε ήδη: η επαναφορά είναι το ακριβές κείμενο και η θέση κέρσορα. */
  | { readonly kind: 'draft'; readonly draft: string; readonly caretIndex: number };

export interface FunctionArgumentsDialogState {
  readonly open: boolean;
  /** Το όνομα με τη γραφή του χρήστη (`CEILING.MATH`), όπως το δίνει ο κατάλογος. */
  readonly functionName: string;
  /** Τα αμετάβλητα άκρα της κλήσης· δες `FormulaCallFrame`. */
  readonly frame: FormulaCallFrame;
  /** Ό,τι έχει γραφτεί σε κάθε κουτί. Μεγαλώνει μαζί με τις σειρές του διαλόγου. */
  readonly values: readonly string[];
  /** Ποιο κουτί έχει την εστίαση — ορίζει την **κάτω** περιγραφή και τον προορισμό της υπόδειξης. */
  readonly activeIndex: number;
  /**
   * 🔴 ADR-763 Φ2.4 — ποιο κουτί κράτησε **μόνιμα** συμπτυγμένη την κάρτα (το `⬆`)· `null` =
   * αναπτυγμένη. Δεν είναι `boolean`, και η διαφορά είναι η προδιαγραφή: συμπτύσσεται **σε ένα
   * όρισμα**, και η λωρίδα που μένει δείχνει εκείνο. Με σκέτη σημαία, η επιλογή «ποιο» θα
   * ζούσε στο `activeIndex`, δηλαδή ένα `Tab` θα άλλαζε **τι σέρνει** ο χρήστης χωρίς να το
   * ζητήσει κανείς.
   */
  readonly collapsedIndex: number | null;
  /**
   * 🔴 ADR-763 Φ2.4 — **βρίσκεται σε εξέλιξη υπόδειξη με το ποντίκι;** Η κάρτα συμπτύσσεται
   * όσο κρατά, και ξανανοίγει μόνη της στο `mouseup` (Excel parity).
   *
   * Ξεχωριστό πεδίο από το {@link collapsedIndex} επίτηδες: το ένα είναι **απόφαση του χρήστη**
   * και επιβιώνει, το άλλο είναι **κατάσταση χειρονομίας** και λήγει. Μια κοινή τιμή θα σήμαινε
   * ότι το τέλος της σύρσης «ανοίγει» μια κάρτα που ο χρήστης είχε συμπτύξει ρητά.
   */
  readonly pointing: boolean;
  readonly restore: FunctionArgumentsRestorePoint;
}

const EMPTY_FRAME: FormulaCallFrame = { prefix: '', suffix: '' };

const CLOSED: FunctionArgumentsDialogState = {
  open: false,
  functionName: '',
  frame: EMPTY_FRAME,
  values: [],
  activeIndex: 0,
  collapsedIndex: null,
  pointing: false,
  restore: { kind: 'navigation' },
};

const store = createExternalStore<FunctionArgumentsDialogState>(CLOSED);

export function getFunctionArgumentsDialogState(): FunctionArgumentsDialogState {
  return store.get();
}

export function subscribeFunctionArgumentsDialog(listener: () => void): () => void {
  return store.subscribe(listener);
}

export interface OpenFunctionArgumentsParams {
  readonly functionName: string;
  readonly frame: FormulaCallFrame;
  readonly restore: FunctionArgumentsRestorePoint;
  /**
   * Ό,τι υπήρχε ήδη μέσα στην κλήση. Κενό όταν η κλήση μόλις γεννήθηκε (Φάση 1)· γεμάτο όταν
   * το `fx` άνοιξε **υπάρχουσα** κλήση (Φάση 2.5).
   */
  readonly values?: readonly string[];
}

/**
 * Άνοιγμα. **Δεν** γράφει στο κελί: το πρόχειρο που αντιστοιχεί σε αυτή την κατάσταση το
 * έγραψε ήδη ο καλών (η Φάση 1 μέσω `insertFunctionCall`, ή κανείς όταν η κλήση προϋπήρχε).
 * Μια εγγραφή εδώ θα ήταν η **δεύτερη** για το ίδιο κείμενο — αθώα σήμερα, και ακριβώς το
 * είδος του πλεονασμού που αποκλίνει.
 */
export function openFunctionArgumentsDialog(params: OpenFunctionArgumentsParams): void {
  store.set({
    open: true,
    functionName: params.functionName,
    frame: params.frame,
    values: params.values ?? [],
    activeIndex: 0,
    // Κάθε άνοιγμα ξεκινά **αναπτυγμένο**: η σύμπτυξη είναι απάντηση σε «δεν βλέπω τον πίνακα»,
    // ερώτηση που ο χρήστης δεν έχει κάνει ακόμη. Ίδια στάση με τον καθαρό όρο αναζήτησης της
    // Φάσης 1 — μνήμη κρατά μόνο ό,τι έχει νόημα να θυμάται (η **θέση** της κάρτας).
    collapsedIndex: null,
    pointing: false,
    restore: params.restore,
  });
}

/** Κλείσιμο **χωρίς** επαναφορά — το «OK», όπου ό,τι γράφτηκε μένει γραμμένο. */
export function closeFunctionArgumentsDialog(): void {
  if (!store.get().open) return;
  store.set(CLOSED);
}

/**
 * Το «Άκυρο»: το κελί γυρνά **ακριβώς** εκεί που ήταν πριν πατηθεί το `fx` — και το
 * πληκτρολόγιο επιστρέφει σε αυτό.
 *
 * Η επαναφορά περνά από τους υπάρχοντες γραφείς. Ένα «σβήσε ό,τι πρόσθεσα» υπολογισμένο από
 * το πλαίσιο θα ήταν αντιστρέψιμη πράξη που πρέπει να μένει συγχρονισμένη με την ευθεία — ενώ
 * το «πριν» είναι ήδη γνωστό και δεν χρειάζεται να παραχθεί.
 *
 * ⚠️ **Η ανάκτηση της εστίασης γίνεται ΕΔΩ, και σε μία εγγραφή.** Ο κλάδος πλοήγησης την
 * παίρνει δωρεάν (το `cancelTableCellCursorSession` αυξάνει ήδη το `sessionId`, δηλαδή
 * ξαναστήνει το `<textarea autoFocus>`)· ο κλάδος γραφής τη χρειάζεται ρητά, γιατί το
 * `setTableCellCursorDraftAt` σκοπίμως **δεν** αγγίζει τη συνεδρία. Ένα κοινό
 * `restartTableCellCursorSession()` από τον καλούντα θα ήταν δεύτερο commit πάνω στο πρώτο —
 * δηλαδή δεύτερο render για μηδέν αλλαγή, στην πιο συχνή διαδρομή.
 */
export function cancelFunctionArgumentsDialog(): void {
  const state = store.get();
  if (!state.open) return;
  store.set(CLOSED);

  if (state.restore.kind === 'navigation') {
    cancelTableCellCursorSession();
    return;
  }
  setTableCellCursorDraftAt(state.restore.draft, state.restore.caretIndex);
  restartTableCellCursorSession();
}

/**
 * Γράψε στο κουτί `index` — **και** στο κελί, στην ίδια πράξη. Δες την κεφαλίδα.
 *
 * Ο πίνακας μεγαλώνει μόνος του όταν ο δείκτης ξεπερνά το τρέχον μήκος: οι σειρές του
 * διαλόγου παράγονται από το `signatureRows` και μπορεί να είναι περισσότερες από τις τιμές
 * που έχουν γραφτεί ποτέ. Τα ενδιάμεσα γεμίζουν με `''`, που είναι και η σημασία τους.
 */
export function setFunctionArgumentValue(index: number, text: string): void {
  const state = store.get();
  if (!state.open || index < 0) return;

  const values = [...state.values];
  while (values.length <= index) values.push('');
  values[index] = text;

  store.set({ ...state, values });
  writeDraft({ ...state, values }, index);
}

/** Ποιο κουτί έχει την εστίαση. Καθαρή αλλαγή κατάστασης — το κελί δεν αλλάζει. */
export function setActiveFunctionArgument(index: number): void {
  const state = store.get();
  if (!state.open || index < 0 || index === state.activeIndex) return;
  store.set({ ...state, activeIndex: index });
}

/**
 * 🔴 ADR-763 Φ2.4 — **σε ποιο όρισμα είναι συμπτυγμένη η κάρτα ΤΩΡΑ**· `null` = αναπτυγμένη.
 *
 * Παράγωγο δύο πεδίων και **όχι** τρίτη αποθηκευμένη τιμή: η μόνιμη σύμπτυξη κερδίζει, και
 * όσο σέρνει το ποντίκι συμπτύσσεται εκείνο που ο χρήστης **γεμίζει** (`activeIndex`). Μια
 * αποθηκευμένη «τρέχουσα σύμπτυξη» θα ήταν κατάσταση που κάποιος οφείλει να καθαρίσει σε δύο
 * μονοπάτια — και το δεύτερο είναι πάντα αυτό που ξεχνιέται (ADR-754 §1).
 *
 * Ζει εδώ, δίπλα στα δεδομένα του, ώστε η όψη να μην ξαναγράψει τη διάζευξη: δύο αντίγραφά
 * της (κάρτα + σειρές) θα απέκλιναν στην πρώτη προσθήκη κατάστασης.
 */
export function collapsedFunctionArgumentIndex(
  state: FunctionArgumentsDialogState,
): number | null {
  if (state.collapsedIndex !== null) return state.collapsedIndex;
  return state.pointing ? state.activeIndex : null;
}

/**
 * Το `⬆` / `⬇` της σειράς `index`: **μόνιμη** σύμπτυξη σε αυτό το όρισμα, ή ανάπτυξη.
 *
 * Δύο συνέπειες, και καμία δεν είναι διακοσμητική:
 *  1. **Το όρισμα γίνεται ενεργό.** Η λωρίδα δείχνει ένα κουτί· αν το ενεργό ήταν άλλο, η
 *     επόμενη υπόδειξη θα έγραφε σε όρισμα που **δεν φαίνεται πουθενά** στην οθόνη.
 *  2. **Η χειρονομία λήγει.** Είναι και η ρητή έξοδος διαφυγής: αν μια σύρση δεν τερμάτισε
 *     ποτέ φυσιολογικά (το κουμπί αφέθηκε εκτός παραθύρου και το `mouseup` χάθηκε), το `⬆`
 *     επαναφέρει την κάρτα αντί να την αφήσει κολλημένη σε προσωρινή κατάσταση.
 */
export function toggleFunctionArgumentCollapse(index: number): void {
  const state = store.get();
  if (!state.open || index < 0) return;
  const collapsed = state.collapsedIndex === index ? null : index;
  store.set({ ...state, collapsedIndex: collapsed, activeIndex: index, pointing: false });
}

/**
 * 🔴 ADR-763 Φ2.4 — **η κάρτα μαζεύεται όσο δείχνεις με το ποντίκι** και ξανανοίγει μόνη της.
 *
 * Γράφεται από τον φρουρό της υπόδειξης (`table-point-mode-pointer`) στα δύο άκρα της
 * χειρονομίας. **No-op με κλειστό διάλογο**, και αυτό είναι σημασία, όχι ανοχή: ο φρουρός
 * εξυπηρετεί **δύο** παραλήπτες (κελί και όρισμα) και μόνο ο ένας έχει κάρτα να μαζέψει. Ένας
 * κλάδος `if (διάλογος ανοιχτός)` στον καλούντα θα ήταν δεύτερη γνώση για το ποιος γράφει πού.
 */
export function setFunctionArgumentPointing(active: boolean): void {
  const state = store.get();
  if (!state.open || state.pointing === active) return;
  store.set({ ...state, pointing: active });
}

/**
 * Το πρόχειρο που αντιστοιχεί στην κατάσταση, με τον κέρσορα στο **τέλος του ορίσματος που
 * μόλις άλλαξε**.
 *
 * Η θέση κέρσορα δεν είναι διακοσμητική ακόμη κι όσο ο διάλογος κρατά την εστίαση: είναι η
 * είσοδος του `resolveFormulaPointState`, δηλαδή αυτή που θα κρίνει τι σημαίνει το επόμενο
 * κλικ σε κελί (ADR-754 §1).
 */
function writeDraft(state: FunctionArgumentsDialogState, index: number): void {
  const separator = drawingFormulaGrammar().argumentSeparator;
  const built = buildFormulaCallDraft(state.frame, state.values, separator);
  const span = built.spans[index];
  setTableCellCursorDraftAt(built.draft, span === undefined ? built.draft.length : span.to);
}

/** Test helper — ίδιο μοτίβο με τα υπόλοιπα stores του subapp. */
export function __resetFunctionArgumentsDialogForTests(): void {
  store.set(CLOSED);
}
