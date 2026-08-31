'use client';

/**
 * ADR-739 Φ.Δ βήμα 7 — **η γραμμή τύπων (fx) + η αναφορά κελιού**.
 *
 * Μια σταθερή θέση, αγκυρωμένη πάνω από τον πίνακα, όπου φαίνεται πάντα (α) **ποιο** κελί
 * είναι το τρέχον και (β) **ολόκληρη** η τιμή του — χωρίς να μπεις μέσα του.
 *
 * ## Τι προσθέτει, αφού το βήμα 6 έδωσε ήδη «βλέπω όλο το κείμενο μέσα στο κελί»
 * Δύο πράγματα που ο in-cell επεξεργαστής **δεν μπορεί** να δώσει, εξ ορισμού:
 *  1. **Ανάγνωση χωρίς γραφή.** Το βήμα 6 δείχνει ολόκληρη την τιμή μόνο αφού μπεις σε
 *     λειτουργία γραφής — δηλαδή αφού αναλάβεις τον κίνδυνο να την αλλάξεις. Εδώ η τιμή
 *     φαίνεται σε **πλοήγηση**, με το πεδίο να δείχνει το δεσμευμένο κείμενο.
 *  2. **Τύπος και αποτέλεσμα ταυτόχρονα.** Είναι η προϋπόθεση του Φ.Δ.11: ένα κελί με
 *     `=SUM(B2:B7)` δείχνει **αριθμό**· ο τύπος πρέπει να φαίνεται κάπου αλλού, αλλιώς
 *     γίνεται αόρατος τη στιγμή που υπολογίζεται. Χωρίς αυτή τη γραμμή, οι τύποι είναι
 *     μη-επεξεργάσιμοι.
 *
 * ## Η θέση — γιατί ΔΕΝ είναι λωρίδα της σελίδας
 * Ο Giorgio το έθεσε ρητά: «ο πίνακας να μην μετακινείται καθόλου κατά το edit». Μια
 * λωρίδα στη **ροή** της διάταξης (κάτω από την κορδέλα) θα κόνταινε τον καμβά και θα
 * μετέθετε το σχέδιο τη στιγμή του διπλού κλικ. Εδώ η γραμμή είναι **αγκυρωμένη στον
 * πίνακα**, ακριβώς πάνω από τη ζώνη γραμμάτων: ίδια μηχανή με τον επεξεργαστή κελιού
 * ({@link TextEditorAnchorLayer}) ⇒ ακολουθεί pan/zoom **χωρίς κανένα re-render** (ADR-040).
 *
 * ⚠️ **Δεν γέρνει με τον πίνακα** (`rotationRad: 0`), σε αντίθεση με τον επεξεργαστή κελιού
 * και τις ζώνες δείκτη. Δεν είναι ασυνέπεια: ο επεξεργαστής **είναι** το κελί και οι ζώνες
 * είναι μέρος του πίνακα· η γραμμή τύπων είναι **εργαλείο**. Ανάποδα γράμματα σε πεδίο που
 * πληκτρολογείς είναι ακριβώς το πρόβλημα που λύνει το `MTEXTFIXED = 2` του AutoCAD (δες
 * την κεφαλίδα του `TextEditorAnchorLayer`) — και όλες οι παλέτες κάθε CAD μένουν ίσιες.
 *
 * ## 🔴 ΕΝΑ πρόχειρο, δύο πεδία — μηδέν συγχρονισμός
 * Το πρόχειρο ζει στον **δρομέα** (`TableCellCursorState.draft`, τεκμηριωμένη απόφαση του
 * βήματος 2). Και τα δύο πεδία διαβάζουν από εκεί και γράφουν εκεί. Δεν υπάρχει δεύτερη
 * κατάσταση, άρα δεν υπάρχει τίποτα να συγχρονιστεί και τίποτα να αποκλίνει.
 *
 * ## 🔴 Η ιδιοκτησία πλήκτρων ΔΕΝ κουνιέται
 * Το πεδίο είναι `<input>`, άρα ο δομικός φύλακας `isTextEntryTarget` απαντά `true` και οι
 * **43** window listeners παραιτούνται όπως πριν. Και φέρει το σημάδι συνεδρίας, ώστε το
 * `handleBlur` του κελιού να δει «μετακίνηση **μέσα** στη συνεδρία» και όχι «έξοδος» — δες
 * `table-cell-session-focus.ts`, όπου ζει το ΕΝΑ κριτήριο.
 *
 * ## Έρευνα (ADR-739 §25.2)
 * - **Excel**: Name Box + fx πάνω από το πλέγμα, μόνιμα. Σε **συγχωνευμένο** δείχνει σκέτη
 *   την άγκυρα (`C7`) ενώ ο τύπος γράφει `C7:D7` — τεκμηριωμένη πηγή σύγχυσης.
 * - **Google Sheets**: ίδια θέση· κλικ στη γραμμή = Edit mode, η εστίαση **μένει** εκεί.
 * - **AutoCAD**: δεν έχει γραμμή τύπων — έχει `TABLEINDICATOR` (γράμματα/αριθμοί γύρω από
 *   τον πίνακα) και Properties palette. Οι τύποι του (`=Sum(A1:A5)`) φαίνονται **μόνο** μέσα
 *   στον in-place επεξεργαστή, δηλαδή μόνο αν μπεις σε γραφή. Αυτό ακριβώς το κενό κλείνει.
 * - **Figma**: inspector panel — πλήρης τιμή του επιλεγμένου, χωρίς είσοδο σε γραφή.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/TableFormulaBar
 * @see bim/table/table-cell-reference.ts — ΠΩΣ ονομάζεται το κελί (SSoT ονοματολογίας)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §25
 */

import { MAX_TABLE_CELL_CHARACTERS } from '../../bim/table/table-ooxml-limits';
import React, { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  diagnoseFormulaText,
  type FormulaDiagnosis,
} from '../../bim/table/formula/table-formula-diagnosis';
import type { FormulaLibraryRejection } from '../../bim/table/formula/library/formula-library-taxonomy';
import { TextEditorAnchorLayer, type TextEditorAnchor } from '../text-toolbar/TextEditorAnchorLayer';
// 🔴 ADR-739 §69 — το πλαίσιο ονόματος ως **φύλλο** (ADR-040 κανόνας #4) — δες τη θέση χρήσης.
import { TableNameBox } from './TableNameBox';
import { flattenToSingleLine } from './TableCellEditorOverlay';
// 🔴 ADR-754 §4 — η **ίδια** τοποθέτηση κέρσορα με τον επεξεργαστή κελιού.
import { useTableCellCaret } from './use-table-cell-caret';
import { useTableCellSessionKeys } from './use-table-cell-session-keys';
// 🔴 ADR-739 §67 — ο **ΙΔΙΟΣ** χειριστής δεξιού κλικ με τον επεξεργαστή κελιού: τα δύο πεδία της
// συνεδρίας έχουν ακριβώς το ίδιο ελάττωμα (ζουν έξω από το δοχείο του δρομολογητή) και του
// αξίζει **μία** λύση — αλλιώς η επόμενη αλλαγή κανόνα θα εφαρμοστεί στο ένα και θα ξεχαστεί
// στο άλλο, και η απόκλιση θα είναι αόρατη όσο κάθε πλευρά δουλεύει.
import { useTableTextContextMenu } from './use-table-text-context-menu';
import {
  activeTableCellSessionCaret,
  TABLE_CELL_SESSION_MARKER,
  useTableCellSessionBlur,
} from './table-cell-session-focus';
import { keepTableCellKeyboardOwnership } from './table-cell-keyboard-ownership';
import { FORMULA_PREFIX } from '../../bim/table/formula/table-formula-lex';
import { openInsertFunctionDialog } from '../../state/insert-function-dialog-store';
import {
  cancelTableCellCursorSession,
  closeTableCellCursor,
  restartTableCellCursorSession,
  setTableCellCursorDraft,
  setTableCellCursorMode,
  type TableCellCursorMode,
} from '../../state/table-cell-cursor-store';
import type { TableCellReference } from '../../bim/table/table-cell-reference';
import type { TableModel } from '../../types/table';
import type { TableCellSessionHandlers } from './table-cell-session-types';

export interface TableFormulaBarProps extends TableCellSessionHandlers {
  /** Η ονομασία του τρέχοντος κελιού· `null` όταν η ταυτότητα δεν λύνεται στο μοντέλο. */
  readonly reference: TableCellReference | null;
  /**
   * 🔴 ADR-739 §69 — το **ζωντανό** μοντέλο, για το πλαίσιο ονόματος και μόνο: εκείνο μετρά
   * το μέγεθος της σύρσης και μεταφράζει τη διεύθυνση που πληκτρολογείς. Περνά από εδώ και
   * δεν το ξαναδιαβάζει μόνο του, ώστε ο **ίδιος** απομνημονευμένος δρόμος (WeakMap) να
   * εξυπηρετεί και τα δύο πεδία — αλλιώς δύο αποσειριοποιήσεις ανά πάτημα πλήκτρου.
   */
  readonly model: TableModel;
  /** 🔴 §69 — «πήγαινε σε αυτή τη διεύθυνση»· δες `use-table-name-box-goto` για τη σειρά. */
  readonly onGoTo: (text: string) => boolean;
  readonly mode: TableCellCursorMode;
  readonly draft: string;
  /** Το **δεσμευμένο** κείμενο — αυτό που φαίνεται όσο δεν γράφεις. */
  readonly initialText: string;
  /**
   * 🔴 ADR-754 §4 — ο δείκτης και **η αφορμή** για να μπει ο κέρσορας εκεί.
   *
   * Η υπόδειξη κελιού δουλεύει **και από εδώ**, χωρίς καμία δεύτερη διαδρομή: ο φρουρός του
   * ποντικιού ρωτά «ποιο πεδίο της συνεδρίας έχει την εστίαση και πού είναι ο κέρσοράς του;»
   * — ερώτηση που δεν ξεχωρίζει τα δύο πεδία. Λείπει μόνο αυτό: το ίδιο πεδίο πρέπει να
   * ξέρει να **βάλει** τον κέρσορα εκεί που τον υπολόγισε η υπόδειξη.
   */
  readonly caretIndex?: number;
  readonly caretRevision: number;
  readonly anchor: TextEditorAnchor;
}

/**
 * Αιτία αποκλεισμού → κατάληξη κλειδιού i18n.
 *
 * Ο πίνακας υπάρχει επειδή οι αιτίες γράφονται με παύλα (`graph-opaque`) ενώ τα κλειδιά της
 * εφαρμογής είναι camelCase. Είναι `Record` πάνω στην ένωση **επίτηδες**: μια ένατη αιτία
 * σπάει τη μεταγλώττιση εδώ, αντί να εμφανιστεί ωμό κλειδί στην οθόνη (N.11).
 *
 * Λείπουν οι `native`, `special-form`, `duplicate` και `not-a-function`: εκείνες **δεν**
 * φτάνουν ποτέ ως εξήγηση — δες `EXPLAINED_REFUSAL_BY_EXCEL_NAME`.
 */
const REFUSAL_KEYS: Partial<Record<FormulaLibraryRejection, string>> = {
  volatile: 'volatile',
  'graph-opaque': 'graphOpaque',
  'array-result': 'arrayResult',
  'locale-unsafe': 'localeUnsafe',
};

/**
 * 🔴 ADR-761 — **η διάγνωση ως κλειδί i18n + παράμετροι**, σε ένα σημείο.
 *
 * Η μετάφραση της διακριτής ένωσης σε κείμενο γίνεται εδώ και όχι μέσα στο JSX, ώστε το
 * `switch` να είναι **εξαντλητικό** για τον μεταγλωττιστή: μια τέταρτη κατάσταση αύριο δεν
 * μπορεί να ξεχαστεί σιωπηλά και να εμφανιστεί ως κενό πλαίσιο.
 */
function diagnosisMessage(
  diagnosis: FormulaDiagnosis,
): { readonly key: string; readonly values: Record<string, string> } | null {
  switch (diagnosis.kind) {
    case 'refused-function': {
      const suffix = REFUSAL_KEYS[diagnosis.reason];
      return suffix === undefined
        ? null
        : { key: `table.formulaBar.refusal.${suffix}`, values: { name: diagnosis.name } };
    }
    case 'other-grammar':
      return {
        key: 'table.formulaBar.diagnosis.otherGrammar',
        values: { separator: diagnosis.separator },
      };
    case 'not-a-formula':
      return {
        key: 'table.formulaBar.diagnosis.notAFormula',
        values: { separator: diagnosis.separator },
      };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 🔴 ADR-763 §10 — **η εστίαση ΔΕΝ φεύγει από το πεδίο όταν πατιέται ένα από τα τρία κουμπιά.**
//
// ## Το πρόβλημα, δομικά
// Τα κουμπιά κάθονται **μέσα** στη γραμμή τύπων, δηλαδή δίπλα στο πεδίο που κρατά την εστίαση.
// Ένα `mousedown` πάνω τους μεταφέρει την εστίαση ως **προεπιλεγμένη ενέργεια** — και ο
// παραλήπτης διαφέρει ανά μηχανή: Chrome εστιάζει το `<button>`, Safari και Firefox ιστορικά
// **δεν** το εστιάζουν, οπότε το `relatedTarget` του `blur` είναι `null`. Με `null`, ο φύλακας
// του `useTableCellSessionBlur` δεν μπορεί να απαντήσει «μέλος της συνεδρίας;» και ακολουθεί
// τον δρόμο της εξόδου: **δέσμευση και κλείσιμο δρομέα** — δηλαδή το κουμπί «Άκυρο» θα
// δέσμευε, ένα καρέ πριν προλάβει να ακυρώσει.
//
// ## 🔴 ADR-753 §25.6 — ΕΦΥΓΕ ΑΠΟ ΕΔΩ· ζούσε σε ΕΝΑ αρχείο και το χρειάζονταν ΔΥΟ
// Ο ορισμός ήταν τοπικός (`keepFocusInField`) και σωστός — και ακριβώς γι' αυτό το mini
// toolbar, που έχει το **ίδιο ακριβώς** πρόβλημα με τα ίδια ακριβώς λόγια, δεν τον είχε: το
// «Έντονα» έπαιρνε το πληκτρολόγιο και το `Enter` ξαναπατούσε το κουμπί. Δύο επιφάνειες πάνω
// από τον **ίδιο** επεξεργαστή δεν επιτρέπεται να απαντούν διαφορετικά στο «ποιος κατέχει το
// πληκτρολόγιο;». Ο ορισμός είναι πλέον **ένας**, στο
// {@link keepTableCellKeyboardOwnership} — και εκεί έγινε **υπό όρο**, που είναι γνήσια
// βελτίωση και για τα τρία κουμπιά εδώ: όταν κανένα πεδίο δεν κρατά το πληκτρολόγιο, δεν
// υπάρχει `blur` να προκληθεί ούτε εστίαση να διατηρηθεί, και το κουμπί οφείλει να μπορεί να
// εστιαστεί κανονικά (WAI-ARIA APG).
//
// ⚠️ Belt-and-suspenders (N.7.2 #4): τα κουμπιά φέρουν **επίσης** το
// {@link TABLE_CELL_SESSION_MARKER}. Αν κάποια μηχανή μεταφέρει την εστίαση παρά το
// `preventDefault`, ο φύλακας θα δει μέλος της συνεδρίας και πάλι δεν θα κλείσει.
//
// 🔴 ADR-739 §70 — και ο τοπικός **αλίας** `keepFocusInField` έφυγε κι αυτός: ήταν δεύτερο
// ΟΝΟΜΑ για το ίδιο πράγμα — ακριβώς το σχήμα που περιγράφει η παράγραφος από πάνω, ένα
// επίπεδο πιο ψηλά. Τα τρία κουμπιά καλούν πλέον τον κανονικό ορισμό με το κανονικό του όνομα.
// ──────────────────────────────────────────────────────────────────────────

export function TableFormulaBar(props: TableFormulaBarProps): React.ReactElement {
  const {
    reference, model, onGoTo, mode, draft, initialText, caretIndex, caretRevision, anchor,
    onCommit, onMove, onClear, onHistory, onExtend, onSelectAll, onToggleAbsoluteRef,
  } = props;
  const { t } = useTranslation('dxf-viewer');
  const inputRef = useRef<HTMLInputElement | null>(null);
  useTableCellCaret(inputRef, caretIndex, caretRevision, mode !== 'nav');

  /**
   * Σε **πλοήγηση** το πεδίο δείχνει το δεσμευμένο κείμενο· σε **γραφή** το πρόχειρο.
   *
   * Είναι η συμπεριφορά του Excel και είναι και η μόνη συνεπής: σε πλοήγηση δεν υπάρχει
   * πρόχειρο (είναι `''` εξ ορισμού — δες το store), οπότε η εναλλακτική θα ήταν να δείχνει
   * η γραμμή τύπων **κενό** πάνω σε γεμάτο κελί.
   */
  const value = mode === 'nav' ? initialText : draft;

  /**
   * Η εξήγηση για συνάρτηση που αποκλείστηκε επίτηδες — δες `formula-library-hint.ts`.
   *
   * Εμφανίζεται **όσο γράφει** ο χρήστης, δηλαδή πριν δεσμεύσει και δει `#NAME?`: η στιγμή
   * που η πληροφορία έχει αξία είναι πριν αποθηκευτεί το λάθος, όχι μετά.
   */
  const message = useMemo(() => {
    // 🔴 ADR-761 — `committed` όταν ο χρήστης **δεν** πληκτρολογεί: μόνο τότε ένα `=…` που
    // δεν αναλύεται είναι όντως αποθηκευμένο ως κείμενο. Όσο γράφει, κάθε τύπος περνά από
    // ενδιάμεσα άκυρα στάδια (`=`, `=S`, `=SUM(`) και το μήνυμα θα ήταν μονίμως αναμμένο.
    const diagnosis = diagnoseFormulaText(value, mode === 'nav');
    return diagnosis === null ? null : diagnosisMessage(diagnosis);
  }, [mode, value]);

  const handleCommit = useCallback(() => {
    // Ίδιος φύλακας με τον επεξεργαστή κελιού: σε πλοήγηση δεν υπάρχει πρόχειρο, και ένα
    // «γράψε το άδειο πρόχειρο» θα **έσβηνε το κελί** χωρίς ο χρήστης να γράψει τίποτα.
    if (mode === 'nav') return;
    onCommit(draft);
  }, [mode, draft, onCommit]);

  /**
   * Κλικ μέσα στη γραμμή = **μπαίνω σε γραφή** πάνω στο τρέχον κείμενο (Excel / Sheets).
   *
   * Το πρόχειρο σπέρνεται από το δεσμευμένο κείμενο, ακριβώς όπως κάνει το `F2`: μπήκες για
   * να **διορθώσεις**, όχι για να ξαναγράψεις από την αρχή. Χωρίς αυτό, ο πρώτος χαρακτήρας
   * θα έσβηνε ολόκληρη την τιμή.
   */
  const handleFocus = useCallback(() => {
    if (mode === 'nav') setTableCellCursorMode('edit', initialText);
  }, [mode, initialText]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // Ο ίδιος φύλακας μονής γραμμής με το κελί: το `TableCell.value` είναι απλό `string`,
    // και μια **επικόλληση** πολυγραμμικού κειμένου δεν επιτρέπεται να βάλει χαρακτήρα
    // ελέγχου μέσα σε κελί που θα γραφτεί σε DXF. Ίδια συνάρτηση, όχι δεύτερη.
    setTableCellCursorDraft(flattenToSingleLine(event.target.value));
  }, []);

  // Η ΙΔΙΑ σημασιολογία πλήκτρων με το κελί, από την ίδια καλωδίωση. Χωρίς `onPassthrough`:
  // η γραμμή τύπων δεν έχει δικό της κύκλο δέσμευσης — το `Escape` το δρομολογεί ο
  // escape-bus από τον **έναν** χειριστή του επεξεργαστή κελιού, που ισχύει για ολόκληρη
  // τη συνεδρία ανεξάρτητα από το ποιο πεδίο κρατά την εστίαση.
  const handleKeyDown = useTableCellSessionKeys({
    mode,
    initialText,
    commit: handleCommit,
    onMove,
    onClear,
    onHistory,
    onExtend,
    onSelectAll,
    onToggleAbsoluteRef,
  });

  /**
   * 🔴 ADR-763 §10 — **το `fx`**: γράφει `=` αν δεν γράφεται ήδη τύπος, και ανοίγει τον κατάλογο.
   *
   * Το «γράφει `=` αμέσως» είναι παρατηρημένη συμπεριφορά του Excel και **όχι** διακόσμηση: ο
   * διάλογος επιστρέφει ένα **όνομα**, και ένα όνομα χωρίς `=` μπροστά είναι απλό κείμενο. Αν
   * το πρόθεμα έμπαινε μόνο στο «OK», τότε η **ακύρωση** θα άφηνε το κελί σε κατάσταση που ο
   * χρήστης δεν ζήτησε ποτέ. Έτσι όπως είναι, η ακύρωση αφήνει έναν άδειο τύπο — ακριβώς ό,τι
   * αφήνει και το Excel, και ακριβώς ό,τι αφήνει και το να πληκτρολογήσεις `=` με το χέρι.
   *
   * Ο κέρσορας διαβάζεται **τη στιγμή του κλικ** (ADR-754 §3), γιατί ένα καρέ αργότερα την
   * εστίαση την έχει το πεδίο αναζήτησης του διαλόγου και η ερώτηση δεν έχει πια απάντηση.
   */
  const handleInsertFunction = useCallback(() => {
    if (mode === 'nav') {
      // `enter` και όχι `edit`: ο χρήστης **ξεκινά** τύπο, δεν διορθώνει τον υπάρχοντα — ο
      // κανόνας type-to-replace του Excel, ο ίδιος που ισχύει όταν πληκτρολογεί `=`.
      setTableCellCursorMode('enter', FORMULA_PREFIX);
      openInsertFunctionDialog(FORMULA_PREFIX.length);
      return;
    }
    openInsertFunctionDialog(activeTableCellSessionCaret() ?? undefined);
  }, [mode]);

  // ADR-739 §26.15 — κλικ από τη γραμμή τύπων πάνω σε κελί του **ίδιου** πίνακα: η συνεδρία
  // δεν φεύγει, μετακομίζει. Το πληκτρολόγιο επιστρέφει στο πλέγμα (Excel), από τον ένα
  // δρόμο ανάκτησης — τον ίδιο που περνά και ο επεξεργαστής κελιού.
  const handleBlur = useTableCellSessionBlur(
    handleCommit,
    closeTableCellCursor,
    restartTableCellCursorSession,
  );

  /**
   * 🔴 ADR-739 §67 — το δεξί κλικ μέσα στη γραμμή τύπων.
   *
   * ⚠️ Σε **πλοήγηση** το μενού ανοίγει κι εδώ, αλλά οι δύο εντολές που **γράφουν** (αποκοπή,
   * επικόλληση) μένουν γκρίζες: το πεδίο δείχνει τότε το **δεσμευμένο** κείμενο και δεν υπάρχει
   * πρόχειρο να αλλάξει. Η αντιγραφή δουλεύει, γιατί τα γράμματα που μαρκάρει ο χρήστης είναι
   * μπροστά του — ακριβώς αυτό που ζητά η γραμμή τύπων: **ανάγνωση χωρίς γραφή**.
   */
  const handleContextMenu = useTableTextContextMenu();

  return (
    <TextEditorAnchorLayer {...anchor}>
      <section
        className="flex h-full w-full items-stretch overflow-hidden rounded-sm border border-border bg-background/95 text-xs shadow-sm backdrop-blur-sm"
        aria-label={t('table.formulaBar.ariaLabel')}
      >
        {/* 🔴 ADR-739 §69 — το «πλαίσιο ονόματος». Ήταν `<span>` εδώ· έγινε **φύλλο** επειδή
            είναι το μόνο κομμάτι αυτής της γραμμής που αλλάζει σε κάθε κελί που διασχίζει το
            χέρι μέσα σε μια σύρση (`2R x 2C`), και ο ADR-040 κανόνας #4 απαιτεί ο συνδρομητής
            υψηλόσυχνης κατάστασης να μην είναι ο ξενιστής του πεδίου γραφής. Δες την κεφαλίδα
            του `TableNameBox` — εκεί ζει και το γιατί το πεδίο έγινε επεξεργάσιμο. */}
        <TableNameBox model={model} reference={reference} onGoTo={onGoTo} />
        {/* 🔴 ADR-763 §10 — τα τρία χειριστήρια του Excel, με τη σειρά του Excel.
            Το `fx` ήταν μέχρι σήμερα `<span aria-hidden>`: **σύμβολο, όχι κουμπί**. */}
        <nav className="flex shrink-0 items-stretch border-r border-border">
          <button
            type="button"
            className="dxf-formula-bar-button dxf-formula-bar-button-reject"
            aria-label={t('table.insertFunction.rejectAriaLabel')}
            disabled={mode === 'nav'}
            {...TABLE_CELL_SESSION_MARKER}
            onMouseDown={keepTableCellKeyboardOwnership}
            onClick={cancelTableCellCursorSession}
          >
            ✕
          </button>
          <button
            type="button"
            className="dxf-formula-bar-button dxf-formula-bar-button-accept"
            aria-label={t('table.insertFunction.acceptAriaLabel')}
            disabled={mode === 'nav'}
            {...TABLE_CELL_SESSION_MARKER}
            onMouseDown={keepTableCellKeyboardOwnership}
            onClick={handleCommit}
          >
            ✓
          </button>
          <button
            type="button"
            className="dxf-formula-bar-button dxf-formula-bar-button-insert"
            aria-label={t('table.insertFunction.openAriaLabel')}
            {...TABLE_CELL_SESSION_MARKER}
            onMouseDown={keepTableCellKeyboardOwnership}
            onClick={handleInsertFunction}
          >
            {t('table.formulaBar.symbol')}
          </button>
        </nav>
        <input
          ref={inputRef}
          type="text"
          spellCheck={false}
          // 🔴 ADR-833 Φ5Β — η ράγα του OOXML (32.767 χαρακτήρες/κελί), εδώ **δωρεάν**: το
          // πεδίο είναι πραγματικό `<input>`, οπότε ο browser σταματά να δέχεται μόνος του.
          // Το κελί δεν μπορεί να το κάνει έτσι (είναι `contenteditable`) και το πληρώνει με
          // ρητό φρουρό `beforeinput` — ίδια συμπεριφορά, δύο μηχανισμοί, γιατί δύο διαφορετικά
          // πεδία. Ό,τι δεν μπήκε ποτέ δεν χάθηκε ποτέ: δεν χρειάζεται μήνυμα.
          maxLength={MAX_TABLE_CELL_CHARACTERS}
          value={value}
          className="min-w-0 flex-1 bg-transparent px-2 text-foreground outline-none"
          aria-label={t('table.formulaBar.valueAriaLabel')}
          // Δες `table-cell-session-focus.ts`: αυτό είναι που εμποδίζει τη γραμμή τύπων να
          // κλείσει τον δρομέα τη στιγμή που την πατάς.
          {...TABLE_CELL_SESSION_MARKER}
          onFocus={handleFocus}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          // 🔴 ADR-739 §67 — Excel parity, ο ίδιος χειριστής με το κελί (δες παραπάνω).
          onContextMenu={handleContextMenu}
        />
        {message === null ? null : (
          <output
            className="flex max-w-96 shrink items-center truncate border-l border-border px-2 text-[10px] text-muted-foreground"
            aria-label={t('table.formulaBar.diagnosis.ariaLabel')}
          >
            {t(message.key, message.values)}
          </output>
        )}
      </section>
    </TextEditorAnchorLayer>
  );
}
