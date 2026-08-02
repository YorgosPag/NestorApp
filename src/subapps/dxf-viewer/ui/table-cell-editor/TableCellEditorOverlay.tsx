'use client';

/**
 * ADR-739 Φ.Δ βήμα 2 — **ο δρομέας κελιού πίνακα** ως DOM: ένα `<input>` αγκυρωμένο πάνω
 * στο τρέχον κελί, που ζει **και** σε κατάσταση πλοήγησης (αόρατο) **και** σε κατάσταση
 * γραφής (ορατό).
 *
 * ## 🔴 Η ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ: γιατί το input δεν κλείνει ποτέ όσο υπάρχει δρομέας
 *
 * Το πρόβλημα ιδιοκτησίας πλήκτρων ήταν το πραγματικό βάρος αυτού του βήματος: ο viewer
 * έχει **43** window-level keydown listeners, και με `activeTool === 'select'` **κάθε**
 * `[A-Za-z0-9]` ανοίγει τη **γραμμή εντολών** (`useKeyboardShortcuts`, συμπεριφορά
 * AutoCAD). Ένα «τρέχον κελί» που ζούσε μόνο σε store θα έχανε κάθε γράμμα.
 *
 * Η λύση **δεν** είναι ένα `if` στο `useKeyboardShortcuts` (το ίδιο το αρχείο το απαγορεύει
 * ρητά: «ο φύλακας είναι δομικός»), ούτε τέταρτο predicate στο `keyboard-scope.ts`. Είναι
 * ότι το τρέχον κελί **είναι πραγματικά ένα εστιασμένο πεδίο κειμένου**:
 *
 *   `isTextEntryTarget(<input>)` → `true`
 *      ⇒ `consumesTypedCharacters` → `true`   (γράμματα: η γραμμή εντολών παραιτείται)
 *      ⇒ `consumesDirectionalKeys` → `true`   (βέλη/Home/End: το pan ±80px παραιτείται)
 *      ⇒ `shouldGlobalShortcutYield` → `true` για **όλους** τους 43 listeners, δωρεάν.
 *
 * Δηλαδή **μηδέν γραμμές** αλλαγής στο `keyboard-scope.ts` και στο `global-shortcut-listener`
 * — η ιδιοκτησία δηλώνεται με τον μόνο τρόπο που ο υπάρχων φύλακας ήδη εμπιστεύεται. Είναι
 * και η αρχιτεκτονική του **Google Sheets** και του **Excel Online**: πλέγμα σε καμβά,
 * αλλά ένα πραγματικό εστιασμένο πεδίο πίσω του που δέχεται τα πλήκτρα.
 *
 * Το ίδιο ένα πράγμα λύνει και το type-to-replace **και** το IME: ο πρώτος χαρακτήρας
 * μπαίνει με τον φυσικό δρόμο του browser σε **άδειο** πεδίο, άρα «αντικαθιστά» χωρίς
 * καμία λογική αντικατάστασης — και οι ελληνικοί τόνοι / dead keys / IME δουλεύουν, ενώ
 * μια συνθετική επανεκπομπή χαρακτήρα θα τα έσπαγε.
 *
 * ## Γιατί το αόρατο input ΔΕΝ κλέβει το ποντίκι
 * Σε `nav` φέρει `pointer-events-none`: τα κλικ περνούν στον καμβά από κάτω. Και **ποτέ**
 * `display:none` / `visibility:hidden` — και τα δύο αφαιρούν την εστίαση, δηλαδή ακυρώνουν
 * ακριβώς τον λόγο ύπαρξής του. Μόνο `opacity`.
 *
 * ## 🔴 ADR-739 Φ.Δ βήμα 3 — γιατί αυτό το κουτί ΔΕΝ είναι σταθερό σε px οθόνης
 *
 * Μέχρι το βήμα 2 το `<input>` ήταν **140 × 24 px**, με χρώματα του θέματος της εφαρμογής,
 * αγκυρωμένο στην πάνω-αριστερή γωνία του κελιού. Στην οθόνη αυτό είναι ένα **μαύρο
 * κουτάκι μέσα στο κελί** με μικροσκοπικά γράμματα, ενώ από κάτω ο καμβάς εξακολουθεί να
 * ζωγραφίζει το κείμενο σε κανονικό μέγεθος (Giorgio, 2026-08-01). Η αιτιολόγηση ήταν το
 * δόγμα του ADR-344 — «θέση από την προβολή, **μέγεθος σε screen-space**», δανεισμένο από
 * το AutoCAD `MTEXTFIXED = 2`.
 *
 * Το δόγμα είναι **σωστό για ελεύθερο κείμενο και λάθος για κελί**, και η διαφορά είναι
 * ουσιαστική, όχι αισθητική:
 *  - ένα MTEXT μπορεί να είναι μικροσκοπικό, τεράστιο ή ανάποδο· δεν υπάρχει «σωστό» κουτί
 *    να μπεις μέσα του, γι' αυτό το AutoCAD σου δίνει ένα **ευανάγνωστο** κουτί από πάνω·
 *  - ένα **κελί** έχει ήδη ορθογώνιο, γραμματοσειρά, στοίχιση, περιθώρια και χρώματα. Εκεί
 *    το «σταθερό σε px» δεν είναι ουδέτερη επιλογή — είναι ένα **ξένο** κουτί πάνω στο κελί.
 *
 * Το Excel, το Google Sheets και το Glide Data Grid (canvas grid, MIT) κάνουν όλα το ίδιο:
 * ένα πραγματικό εστιασμένο πεδίο **στο ορθογώνιο του κελιού**, με την τυπογραφία του
 * κελιού. Εδώ πάμε ένα βήμα παραπέρα από τα δύο πρώτα: το κουτί ακολουθεί και την
 * **περιστροφή** του πίνακα (κανένα φύλλο υπολογισμού δεν έχει στραμμένο πλέγμα) και
 * ζουμάρει ζωντανά με τον καμβά, χωρίς **κανένα** re-render (ADR-040) — οι τιμές ταξιδεύουν
 * ως CSS custom properties που γράφει επιτακτικά το `TextEditorAnchorLayer`.
 *
 * ## Τι ζωγραφίζει τον δρομέα
 * **Ο καμβάς**, όχι αυτό το κουτί (`stampTableCellCursor`): το πλαίσιο του τρέχοντος κελιού
 * πρέπει να φαίνεται και σε κατάσταση **πλοήγησης**, όπου αυτό το πεδίο είναι διαφανές.
 *
 * ## 🔴 ADR-739 Φ.Δ βήμα 6 — γιατί `<textarea>` και όχι `<input>`
 *
 * Ο επεξεργαστής επεκτείνεται πέρα από το κελί (Excel) και, όταν φτάσει στην άκρη της
 * οθόνης, **αναδιπλώνει σε δεύτερη γραμμή**. Ένα `<input>` δεν έχει δεύτερη γραμμή. Η
 * αλλαγή είναι μικρότερη απ' όσο φαίνεται, και οι τρεις λόγοι γράφονται εδώ γιατί ο επόμενος
 * θα υποψιαστεί ότι κάτι έσπασε:
 *
 *  1. **Η ιδιοκτησία πλήκτρων δεν κουνήθηκε.** Ο δομικός φύλακας ρωτά `isTextEntryTarget`,
 *     που απαντά `true` για `INPUT` **και** `TEXTAREA` στην ίδια γραμμή (`keyboard-scope.ts`).
 *     Και οι 43 window listeners παραιτούνται ακριβώς όπως πριν, με μηδέν αλλαγή.
 *  2. **Η κατακόρυφη γεωμετρία δεν κουνήθηκε.** Το `<textarea>` στοιβάζει από την κορυφή
 *     αντί να κεντράρει — αλλά με `line-height` ίσο με το content box οι δύο τοποθετήσεις
 *     είναι **αριθμητικά ταυτόσημες** (η απόδειξη ζει στο `table-cell-editor-frame.ts`).
 *  3. **Το `Enter` δεν έγινε αλλαγή γραμμής.** Το διεκδικεί ήδη το
 *     {@link resolveTableCellKeyIntent} ως `move`, και ο χειριστής κάνει `preventDefault`
 *     πριν προλάβει ο browser. Το `Alt+Enter` όμως **θα** έμπαινε — γι' αυτό μπλοκάρεται
 *     ρητά εκεί, μαζί με το σκεπτικό.
 *
 * ⚠️ Η επέκταση είναι **αποκλειστικά κατάσταση διεπαφής**: δεν αγγίζει τη διάταξη, δεν
 * αγγίζει το `TableCell.value`. Μετά το commit ο πίνακας ξαναδείχνει κομμένο (βήμα 5).
 *
 * @see ui/table-cell-editor/table-cell-editor-frame.ts — από sheet-mm σε px CSS
 * @see ui/table-cell-editor/table-cell-editor-vars.ts — το συμβόλαιο των custom properties
 * @see ui/table-cell-editor/table-cell-key-intent.ts — ποιο πλήκτρο τι σημαίνει
 * @see state/table-cell-cursor-store.ts — η κατάσταση του δρομέα
 * @see ui/inline-editor/use-inline-editor-keys.ts — ο φρουρός «μία φορά» + ο escape-bus
 */

import React, { useCallback, useEffect, useRef, type ClipboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useInlineEditorKeys } from '../inline-editor/use-inline-editor-keys';
import { TextEditorAnchorLayer, type TextEditorAnchor } from '../text-toolbar/TextEditorAnchorLayer';
import {
  TABLE_CELL_EDITOR_INPUT_STYLE,
  TABLE_CELL_EDITOR_WRITING_STYLE,
} from './table-cell-editor-vars';
import { useTableCellSessionKeys } from './use-table-cell-session-keys';
import {
  TABLE_CELL_SESSION_MARKER,
  useTableCellSessionBlur,
} from './table-cell-session-focus';
import {
  cancelTableCellCursorSession,
  closeTableCellCursor,
  restartTableCellCursorSession,
  setTableCellCursorDraft,
  setTableCellCursorMode,
  type TableCellCursorMode,
} from '../../state/table-cell-cursor-store';
import type { TableCellSessionHandlers } from './table-cell-session-types';
import type { TableColumnId, TableRowId } from '../../types/table';

export interface TableCellEditorOverlayProps extends TableCellSessionHandlers {
  readonly entityId: string;
  /** Μαζί με το `sessionId` συνθέτουν το `key` του καλούντος — δες το store. */
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  readonly mode: TableCellCursorMode;
  /**
   * Το **πρόχειρο** της συνεδρίας γραφής — ζει στον δρομέα, όχι εδώ. Δες το σχόλιο του
   * `TableCellCursorState.draft`: τοπικό `useState` χανόταν σε ασύγχρονο ξαναστήσιμο.
   */
  readonly draft: string;
  /** Το **δεσμευμένο** κείμενο του κελιού, διαβασμένο από το μοντέλο τη στιγμή της απόδοσης. */
  readonly initialText: string;
  /**
   * ADR-739 Φ.Δ βήμα 3 — ο χαρακτήρας στον οποίο στήνεται ο κέρσορας· `undefined` ⇒ τέλος.
   * Το γεμίζει μόνο το διπλό κλικ (Excel: μπαίνεις εκεί που έδειξες).
   */
  readonly caretIndex?: number;
  readonly anchor: TextEditorAnchor;
  /**
   * ADR-739 Φ.Δ βήμα 8 — τα **φυσικά** συμβάντα προχείρου του browser. Δεν είναι πλήκτρα:
   * δες `use-table-range-actions.ts` για τους τέσσερις λόγους που το `Ctrl+C` **δεν**
   * αναγνωρίζεται ως `keydown`, και `table-cell-session-types.ts` για το γιατί ζουν εδώ
   * και όχι στο κοινό συμβόλαιο των δύο πεδίων.
   */
  readonly onCopy: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onCut: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLElement>) => void;
}

/**
 * Κάθε αλλαγή γραμμής γίνεται **ένα κενό** — ποτέ δεν χάνεται λέξη.
 *
 * Το `\r\n` πιάνεται ως ένα, αλλιώς κείμενο από Windows θα άφηνε διπλά κενά. Οι διαδοχικές
 * αλλαγές γραμμής επίσης συμπτύσσονται: μια κενή γραμμή στο πρωτότυπο δεν είναι περιεχόμενο.
 */
export function flattenToSingleLine(value: string): string {
  return value.replace(/[\r\n]+/gu, ' ');
}

export function TableCellEditorOverlay(props: TableCellEditorOverlayProps): React.ReactElement {
  const {
    mode, draft, initialText, caretIndex, anchor,
    onCommit, onMove, onClear, onHistory, onExtend, onSelectAll, onCopy, onCut, onPaste,
  } = props;
  const { t } = useTranslation('dxf-viewer');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Είσοδος με διπλό κλικ / F2: **ποτέ** επιλογή όλου του κειμένου — μπήκες για να
  // διορθώσεις, όχι για να ξαναγράψεις (αλλιώς η κατάσταση `edit` θα ήταν λειτουργικά ίδια
  // με την `enter` και το F2 δεν θα σήμαινε τίποτα).
  //
  // ADR-739 Φ.Δ βήμα 3 — **πού** ακριβώς: στο γράμμα που έδειξε το διπλό κλικ, όπως στο
  // Excel. `F2` και `Tab` δεν έχουν σημείο, άρα πέφτουν στο τέλος. Το `Math.min` δεν είναι
  // παράνοια: ο δείκτης υπολογίστηκε πάνω στο **δεσμευμένο** κείμενο, ενώ εδώ διαβάζεται
  // το πρόχειρο — μια ασύγχρονη ενημέρωση σκηνής ανάμεσα στα δύο θα έδινε δείκτη εκτός ορίων.
  useEffect(() => {
    if (mode === 'nav') return;
    const el = inputRef.current;
    if (!el) return;
    const at = caretIndex === undefined ? el.value.length : Math.min(caretIndex, el.value.length);
    el.setSelectionRange(at, at);
    // Μόνο στο στήσιμο της συνεδρίας: μεταγενέστερες πληκτρολογήσεις δεν μετακινούν κέρσορα.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCommit = useCallback(() => {
    // Σε πλοήγηση δεν υπάρχει πρόχειρο: το `onBlur={commit}` πυροδοτεί και όταν απλώς
    // μετακινείσαι, και ένα «γράψε το άδειο πρόχειρο» θα **έσβηνε το κελί** περνώντας από
    // πάνω του. Η σιωπή εδώ δεν είναι παράλειψη — είναι η προστασία των δεδομένων.
    if (mode === 'nav') return;
    onCommit(draft);
  }, [mode, draft, onCommit]);

  /**
   * `Escape`: σε γραφή ακυρώνει τη **συνεδρία** και μένει στο κελί (Excel / WAI-ARIA APG)·
   * σε πλοήγηση κλείνει τον δρομέα και επιστρέφει στην επιλογή οντότητας (AutoCAD).
   * Δρομολογείται από τον escape-bus μέσα στο `useInlineEditorKeys` — ποτέ inline σύγκριση.
   */
  const handleCancel = useCallback(() => {
    if (mode === 'nav') closeTableCellCursor();
    else cancelTableCellCursorSession();
  }, [mode]);

  const { commit, onKeyDown: inlineKeyDown } = useInlineEditorKeys({
    id: 'table-cell-editor/table-cell-cursor',
    onCommit: handleCommit,
    onCancel: handleCancel,
  });

  // ADR-739 Φ.Δ βήμα 7 — η εκτέλεση της σημασιολογίας μετακόμισε στο
  // `useTableCellSessionKeys`, ώστε το **δεύτερο** πεδίο της συνεδρίας (η γραμμή τύπων) να
  // μη γεννήσει αντίγραφο του ίδιου `switch`. Το `onPassthrough` παραμένει ο χειριστής του
  // SSoT: το `Enter` το έχει ήδη διεκδικήσει η περίπτωση `move`, αλλά μια μελλοντική
  // επέκταση της κοινής σημασιολογίας πρέπει να φτάσει και εδώ.
  const handleKeyDown = useTableCellSessionKeys({
    mode,
    initialText,
    commit,
    onMove,
    onClear,
    onHistory,
    onExtend,
    onSelectAll,
    onPassthrough: inlineKeyDown,
  });

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      // 🔴 ADR-739 Φ.Δ βήμα 6 — **ο φύλακας της μονής γραμμής.**
      //
      // Το `<input>` πετούσε τις αλλαγές γραμμής μόνο του: μια **επικόλληση** πολυγραμμικού
      // κειμένου έμπαινε ισοπεδωμένη, δωρεάν. Το `<textarea>` τις κρατά — και θα έφταναν
      // στο `TableCell.value`, που είναι **απλό `string`** (τεκμηριωμένη απόφαση, ADR-739
      // Φ.Α): η διάταξη θα μετρούσε έναν χαρακτήρα ελέγχου σαν γράμμα και το DXF θα έγραφε
      // κελί που κανένα άλλο πρόγραμμα δεν διαβάζει σωστά.
      //
      // Η ισοπέδωση γίνεται **εδώ και όχι στο commit**: ο χρήστης πρέπει να δει αμέσως τι
      // μπήκε στο κελί του. Ένα «καθάρισμα» τη στιγμή της δέσμευσης θα άλλαζε το κείμενο
      // κάτω από τα μάτια του, αφού το είχε ήδη εγκρίνει.
      setTableCellCursorDraft(flattenToSingleLine(event.target.value));
      // Ο πρώτος χαρακτήρας πάνω σε επιλεγμένο κελί ανοίγει τη συνεδρία γραφής. Γίνεται
      // εδώ και όχι στο `keydown` επίτηδες: το `change` πυροδοτεί **μόνο** όταν όντως
      // μπήκε κείμενο, άρα καλύπτει IME/dead keys χωρίς λίστα «εκτυπώσιμων» πλήκτρων.
      if (mode === 'nav') setTableCellCursorMode('enter');
    },
    [mode],
  );

  /**
   * Απώλεια εστίασης = δέσμευση, **και** πιθανή έξοδος από τον πίνακα.
   *
   * ADR-739 Φ.Δ βήμα 7 — η απόφαση μετακόμισε στο {@link useTableCellSessionBlur}, γιατί
   * από αυτό το βήμα η συνεδρία έχει **δύο** πεδία κειμένου (κελί + γραμμή τύπων) και το
   * κριτήριο «έφυγα ή απλώς μετακινήθηκα;» οφείλει να είναι **ένα**. Διάβασε εκεί γιατί η
   * μετακίνηση **μέσα** στη συνεδρία δεν κάνει commit.
   *
   * ADR-739 §26.15 — η **τρίτη** έκβαση: κλικ μέσα στον ίδιο πίνακα ⇒ ανάκτηση του
   * πληκτρολογίου. Ο ίδιος δρόμος που χρησιμοποιεί και το μενού κεφαλίδων στο κλείσιμό του
   * (βήμα 9) — καμία δεύτερη μηχανική επαναφοράς εστίασης.
   */
  const handleBlur = useTableCellSessionBlur(
    commit,
    closeTableCellCursor,
    restartTableCellCursorSession,
  );

  const writing = mode !== 'nav';

  return (
    // 🔴 ADR-739 §26.15 — σε **πλοήγηση** ολόκληρος ο επεξεργαστής είναι διάφανος στο ποντίκι,
    // όχι μόνο το πεδίο: το κέλυφος αγκύρωσης είναι `position: fixed` πάνω από τον καμβά και,
    // χωρίς αυτό, **σκεπάζει ακριβώς το κελί στο οποίο βρίσκεσαι** — μετρημένο ζωντανά, ο
    // στόχος του `mousedown` γινόταν `DIV` αντί για `CANVAS` και ο ακροατής του πίνακα δεν
    // έβλεπε ποτέ το πάτημα. Σε γραφή το κουτί **πρέπει** να δέχεται κλικ (τοποθέτηση κέρσορα).
    <TextEditorAnchorLayer {...anchor} transparentToPointer={!writing}>
      <textarea
        ref={inputRef}
        autoFocus
        // Το ύψος το ορίζει **το κουτί** (custom properties, ένα tick): ένα `rows` εδώ θα ήταν
        // δεύτερη πηγή αλήθειας για το ίδιο νούμερο, και θα κέρδιζε στο πρώτο καρέ πριν
        // προλάβει ο scheduler. Το `1` δηλώνει μόνο ότι το φυσικό ελάχιστο είναι μία γραμμή.
        rows={1}
        // Ο πίνακας είναι σχέδιο, όχι κείμενο πρόζας: κόκκινες κυματιστές γραμμές κάτω από
        // κωδικούς υλικών είναι θόρυβος. Ίδια επιλογή με κάθε φύλλο υπολογισμού.
        spellCheck={false}
        value={draft}
        // ADR-739 Φ.Δ βήμα 3 — **κανένα placeholder**: το πεδίο ΕΙΝΑΙ πλέον το κελί, και ένα
        // γκρίζο «πληκτρολογήστε…» μέσα σε άδειο κελί είναι κείμενο που δεν υπάρχει στο
        // έγγραφο. Κανένα φύλλο υπολογισμού δεν το κάνει. Ο ρόλος δηλώνεται με `aria-label`,
        // που είναι και ο σωστός φορέας του (δεν ζωγραφίζεται).
        aria-label={t('table.cellEditor.cellAriaLabel')}
        // Το σημάδι που διαβάζει το {@link useTableCellSessionBlur} για να ξεχωρίσει
        // «μετακινήθηκα μέσα στη συνεδρία» από «έφυγα από τον πίνακα». Δεν είναι στυλ —
        // είναι ταυτότητα ρόλου, και ο ορισμός του ζει σε **ένα** σημείο.
        {...TABLE_CELL_SESSION_MARKER}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        // 🔴 ADR-739 Φ.Δ βήμα 8 — τα **φυσικά** συμβάντα προχείρου του browser, όχι
        // πλήκτρα. Σε πλοήγηση τα αναλαμβάνει η **περιοχή** (TSV)· σε γραφή τα αφήνουν
        // αυτούσια στον browser, που αντιγράφει κείμενο **μέσα** στο κελί σωστά και
        // δωρεάν — μαζί με IME και ελληνικούς τόνους. Η απόφαση ζει στο
        // `tableClipboardScope`, όχι εδώ.
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        // ΚΑΜΙΑ γωνία, ΚΑΝΕΝΑ περίγραμμα, ΚΑΜΙΑ σκιά εστίασης **όσο το κουτί είναι το κελί**:
        // το κελί έχει ήδη πλαίσιο — το ζωγραφίζει ο καμβάς (`stampTableCellCursor`), στην
        // περιστροφή του πίνακα. Ένα δεύτερο, ευθυγραμμισμένο στην οθόνη, θα κρεμόταν λοξά.
        //
        // ADR-739 Φ.Δ βήμα 6 — μόλις το κουτί **ξεπεράσει** το κελί, το περίγραμμα γίνεται
        // απαραίτητο και εμφανίζεται ως `outline` μηδενικού πάχους→1px μέσω custom property
        // (δες `table-cell-editor-vars.ts`). Γι' αυτό φεύγει το `outline-none` του Tailwind:
        // θα κέρδιζε σε ειδικότητα και η ένδειξη δεν θα ζωγραφιζόταν ποτέ.
        className={cn(
          'box-border border-0',
          writing
            ? 'bg-clip-padding'
            // Πλοήγηση: κρατά την ΕΣΤΙΑΣΗ (άρα και τα πλήκτρα), χάνει την όψη και το
            // ποντίκι. Τον δρομέα τον ζωγραφίζει ο καμβάς — δες την κεφαλίδα.
            : 'pointer-events-none bg-transparent text-transparent opacity-0',
        )}
        style={
          writing
            ? { ...TABLE_CELL_EDITOR_INPUT_STYLE, ...TABLE_CELL_EDITOR_WRITING_STYLE }
            : TABLE_CELL_EDITOR_INPUT_STYLE
        }
      />
    </TextEditorAnchorLayer>
  );
}
