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
 * πρέπει να φαίνεται και σε κατάσταση **πλοήγησης**, όπου αυτό το `<input>` είναι διαφανές.
 *
 * @see ui/table-cell-editor/table-cell-editor-frame.ts — από sheet-mm σε px CSS
 * @see ui/table-cell-editor/table-cell-editor-vars.ts — το συμβόλαιο των custom properties
 * @see ui/table-cell-editor/table-cell-key-intent.ts — ποιο πλήκτρο τι σημαίνει
 * @see state/table-cell-cursor-store.ts — η κατάσταση του δρομέα
 * @see ui/inline-editor/use-inline-editor-keys.ts — ο φρουρός «μία φορά» + ο escape-bus
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useInlineEditorKeys } from '../inline-editor/use-inline-editor-keys';
import { TextEditorAnchorLayer, type TextEditorAnchor } from '../text-toolbar/TextEditorAnchorLayer';
import {
  TABLE_CELL_EDITOR_INPUT_STYLE,
  TABLE_CELL_EDITOR_WRITING_STYLE,
} from './table-cell-editor-vars';
import { resolveTableCellKeyIntent } from './table-cell-key-intent';
import {
  cancelTableCellCursorSession,
  closeTableCellCursor,
  setTableCellCursorDraft,
  setTableCellCursorMode,
  type TableCellCursorMode,
} from '../../state/table-cell-cursor-store';
import type { TableCursorMove } from '../../bim/table/table-cell-navigation';
import type { TableColumnId, TableRowId } from '../../types/table';

export interface TableCellEditorOverlayProps {
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
  /** Γράψε το κείμενο στο μοντέλο (undoable). Καλείται **το πολύ μία φορά** ανά συνεδρία. */
  readonly onCommit: (nextText: string) => void;
  /** Πήγαινε στο κελί που ορίζει η κίνηση· ο καλών κατέχει το μοντέλο. */
  readonly onMove: (move: TableCursorMove) => void;
  /** `Delete` σε κατάσταση πλοήγησης — άδειασμα κελιού (Excel). */
  readonly onClear: () => void;
  /**
   * ADR-739 Φ.Δ βήμα 4 — `Ctrl+Z`/`Ctrl+Y` σε **πλοήγηση**. Σε γραφή δεν καλείται ποτέ:
   * εκεί το undo ανήκει στο `<input>` και το κάνει ο browser (δες `table-cell-key-intent`).
   */
  readonly onHistory: (direction: 'undo' | 'redo') => void;
}

export function TableCellEditorOverlay(props: TableCellEditorOverlayProps): React.ReactElement {
  const { mode, draft, initialText, caretIndex, anchor, onCommit, onMove, onClear, onHistory } = props;
  const { t } = useTranslation('dxf-viewer');
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const intent = resolveTableCellKeyIntent(event.key, event, mode);
      switch (intent.kind) {
        case 'move':
          event.preventDefault();
          // Η σειρά είναι το συμβόλαιο: **πρώτα** δεσμεύεται το πρόχειρο (ιδεμποτής, ο
          // φρουρός του SSoT κόβει το δεύτερο commit από το επακόλουθο blur), **μετά**
          // μετακινείται ο δρομέας. Αντίστροφα θα γραφόταν το κείμενο στο νέο κελί.
          commit();
          onMove(intent.move);
          return;
        case 'mode':
          event.preventDefault();
          // `F2` από πλοήγηση: το πρόχειρο γεννιέται ΤΩΡΑ από το δεσμευμένο κείμενο του
          // κελιού· από γραφή αλλάζει μόνο ποιος κατέχει τα βέλη (το «διπλό F2» του Excel).
          setTableCellCursorMode(intent.to, mode === 'nav' ? initialText : undefined);
          return;
        case 'clear':
          event.preventDefault();
          onClear();
          return;
        case 'history':
          // `preventDefault` απαραίτητο: χωρίς αυτό ο browser θα έτρεχε **και** το δικό του
          // undo πάνω στο (κενό, αόρατο) πεδίο πλοήγησης — δύο ενέργειες για ένα πάτημα.
          event.preventDefault();
          onHistory(intent.direction);
          return;
        case 'passthrough':
          // Το `Enter` το έχει ήδη διεκδικήσει η περίπτωση `move`, οπότε ο χειριστής του
          // SSoT δεν έχει τι να κάνει εδώ — καλείται παρ' όλα αυτά ώστε μια μελλοντική
          // επέκταση της κοινής σημασιολογίας να φτάσει και σε αυτόν τον καταναλωτή.
          inlineKeyDown(event);
      }
    },
    [mode, initialText, commit, onMove, onClear, onHistory, inlineKeyDown],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTableCellCursorDraft(event.target.value);
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
   * Το «πιθανή» κρίνεται **ένα καρέ αργότερα** και όχι αμέσως, γιατί η μετακίνηση σε άλλο
   * κελί περνά κι αυτή από blur: το παλιό `<input>` ξεφορτώνεται και το νέο παίρνει την
   * εστίαση στο ίδιο commit του React. Άμεσο κλείσιμο θα σκότωνε **κάθε** `Tab`. Ο
   * έλεγχος του `document.activeElement` μετά το καρέ ξεχωρίζει τα δύο: αν η εστίαση
   * κάθεται σε άλλον δρομέα κελιού, ήταν μετακίνηση· αν πουθενά, ο χρήστης έφυγε.
   * Το ίδιο μοτίβο «focus-within με περίοδο χάριτος» χρησιμοποιεί κάθε επαγγελματικό grid.
   */
  const handleBlur = useCallback(() => {
    commit();
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active.dataset.tableCellCursor !== 'true') {
        closeTableCellCursor();
      }
    });
  }, [commit]);

  const writing = mode !== 'nav';

  return (
    <TextEditorAnchorLayer {...anchor}>
      <input
        ref={inputRef}
        type="text"
        autoFocus
        value={draft}
        // ADR-739 Φ.Δ βήμα 3 — **κανένα placeholder**: το πεδίο ΕΙΝΑΙ πλέον το κελί, και ένα
        // γκρίζο «πληκτρολογήστε…» μέσα σε άδειο κελί είναι κείμενο που δεν υπάρχει στο
        // έγγραφο. Κανένα φύλλο υπολογισμού δεν το κάνει. Ο ρόλος δηλώνεται με `aria-label`,
        // που είναι και ο σωστός φορέας του (δεν ζωγραφίζεται).
        aria-label={t('table.cellEditor.cellAriaLabel')}
        // Το σημάδι που διαβάζει το {@link handleBlur} για να ξεχωρίσει «μετακινήθηκα σε
        // άλλο κελί» από «έφυγα από τον πίνακα». Δεν είναι στυλ — είναι ταυτότητα ρόλου.
        data-table-cell-cursor="true"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        // ΚΑΜΙΑ γωνία, ΚΑΝΕΝΑ περίγραμμα, ΚΑΜΙΑ σκιά εστίασης: το κελί έχει ήδη πλαίσιο —
        // το ζωγραφίζει ο καμβάς (`stampTableCellCursor`), στην περιστροφή του πίνακα. Ένα
        // δεύτερο, ευθυγραμμισμένο στην οθόνη, θα κρεμόταν λοξά πάνω στο πρώτο.
        className={cn(
          'box-border border-0 outline-none',
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
