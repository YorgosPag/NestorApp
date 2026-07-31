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
 * ## Τι ζωγραφίζει τον δρομέα
 * **Ο καμβάς**, όχι αυτό το κουτί (`stampTableCellCursor`): ο πίνακας μπορεί να είναι
 * περιστραμμένος και το κελί αλλάζει μέγεθος με το zoom, ενώ το αγκυρωμένο DOM κουτί είναι
 * σκόπιμα σταθερό σε px οθόνης (ADR-344: «θέση από την προβολή, μέγεθος σε screen-space»).
 *
 * @see ui/table-cell-editor/table-cell-key-intent.ts — ποιο πλήκτρο τι σημαίνει
 * @see state/table-cell-cursor-store.ts — η κατάσταση του δρομέα
 * @see ui/inline-editor/use-inline-editor-keys.ts — ο φρουρός «μία φορά» + ο escape-bus
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useInlineEditorKeys } from '../inline-editor/use-inline-editor-keys';
import { TextEditorAnchorLayer, type TextEditorAnchor } from '../text-toolbar/TextEditorAnchorLayer';
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
  readonly anchor: TextEditorAnchor;
  /** Γράψε το κείμενο στο μοντέλο (undoable). Καλείται **το πολύ μία φορά** ανά συνεδρία. */
  readonly onCommit: (nextText: string) => void;
  /** Πήγαινε στο κελί που ορίζει η κίνηση· ο καλών κατέχει το μοντέλο. */
  readonly onMove: (move: TableCursorMove) => void;
  /** `Delete` σε κατάσταση πλοήγησης — άδειασμα κελιού (Excel). */
  readonly onClear: () => void;
}

export function TableCellEditorOverlay(props: TableCellEditorOverlayProps): React.ReactElement {
  const { mode, draft, initialText, anchor, onCommit, onMove, onClear } = props;
  const { t } = useTranslation('dxf-viewer');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Είσοδος με διπλό κλικ / F2: κέρσορας στο ΤΕΛΟΣ, όχι επιλογή όλου του κειμένου. Μπήκες
  // για να διορθώσεις, όχι για να ξαναγράψεις — αλλιώς η κατάσταση `edit` θα ήταν
  // λειτουργικά ίδια με την `enter` και το F2 δεν θα σήμαινε τίποτα.
  useEffect(() => {
    if (mode === 'nav') return;
    const el = inputRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
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
        case 'passthrough':
          // Το `Enter` το έχει ήδη διεκδικήσει η περίπτωση `move`, οπότε ο χειριστής του
          // SSoT δεν έχει τι να κάνει εδώ — καλείται παρ' όλα αυτά ώστε μια μελλοντική
          // επέκταση της κοινής σημασιολογίας να φτάσει και σε αυτόν τον καταναλωτή.
          inlineKeyDown(event);
      }
    },
    [mode, initialText, commit, onMove, onClear, inlineKeyDown],
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
        placeholder={t('table.cellEditor.editorPlaceholder')}
        aria-label={t('table.cellEditor.cellAriaLabel')}
        // Το σημάδι που διαβάζει το {@link handleBlur} για να ξεχωρίσει «μετακινήθηκα σε
        // άλλο κελί» από «έφυγα από τον πίνακα». Δεν είναι στυλ — είναι ταυτότητα ρόλου.
        data-table-cell-cursor="true"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          'box-border rounded px-2 outline-none',
          writing
            ? 'border border-primary bg-background text-foreground focus:ring-2 focus:ring-primary'
            // Πλοήγηση: κρατά την ΕΣΤΙΑΣΗ (άρα και τα πλήκτρα), χάνει την όψη και το
            // ποντίκι. Τον δρομέα τον ζωγραφίζει ο καμβάς — δες την κεφαλίδα.
            : 'pointer-events-none border-0 bg-transparent text-transparent opacity-0',
        )}
        style={{ width: anchor.size.width, height: anchor.size.height }}
      />
    </TextEditorAnchorLayer>
  );
}
