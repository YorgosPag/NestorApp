'use client';

/**
 * 🔴 ADR-739 §54 — **ΤΟ ΠΡΟΧΕΙΡΟ ΧΩΡΙΣ ΣΥΜΒΑΝ**: αποκοπή / αντιγραφή / επικόλληση από το μενού
 * δεξιού κλικ, όπου δεν υπάρχει `ClipboardEvent` να ρωτηθεί.
 *
 * ## Γιατί ΔΕΝ γίνεται με τους υπάρχοντες χειριστές
 * Οι `onCopy`/`onCut`/`onPaste` του `use-table-range-actions.ts` δέχονται **`ClipboardEvent`** —
 * και η κεφαλίδα εκείνου εξηγεί γιατί αυτό είναι το **σωστό** μονοπάτι για το πληκτρολόγιο:
 * καμία άδεια, καμία χειρονομία, κάθε διάταξη πλήκτρων, ό,τι έχει όντως το πρόχειρο. Τίποτα
 * από αυτά δεν αλλάζει. Απλώς ένα item μενού **δεν παράγει** τέτοιο συμβάν: το `click` πάνω σε
 * `role="menuitem"` δεν είναι χειρονομία προχείρου του browser.
 *
 * ## Γιατί async Clipboard API και ΟΧΙ `document.execCommand`
 * Το `execCommand('copy'|'paste')` είναι **deprecated** και, στην περίπτωση της επικόλλησης,
 * απορρίπτεται από κάθε σύγχρονο browser έξω από extension. Το `navigator.clipboard` είναι ο
 * ένας υποστηριζόμενος δρόμος — με το τίμημα ότι **μπορεί να απορριφθεί** (άδεια, ανασφαλές
 * περιβάλλον, μη υποστήριξη).
 *
 * ## 🔴 Η ΑΡΝΗΣΗ ΛΕΓΕΤΑΙ, ΠΟΤΕ ΔΕΝ ΣΙΩΠΑ
 * Κάθε κλήση προχείρου ζει μέσα σε `try` και επιστρέφει **τιμή**, όχι εξαίρεση: μια `Promise`
 * που απορρίπτεται μέσα σε χειριστή μενού καταλήγει σε `unhandledrejection` — δηλαδή σε
 * «πάτησα Επικόλληση και δεν έγινε τίποτα», η χειρότερη δυνατή έκβαση για εντολή δεδομένων.
 *
 * ## Καμία δεύτερη διαδρομή εγγραφής, καμία δεύτερη σειριοποίηση
 * Το κείμενο παράγεται και διαβάζεται από τις **καθαρές** συναρτήσεις του
 * `table-range-clipboard.ts` (τις ίδιες με το πληκτρολόγιο), και η εγγραφή περνά από το
 * `useLiveTableMutation` / `useTableModelCommit`: ένα `UpdateEntityCommand`, ένα `Ctrl+Z` (§6.6).
 *
 * ## 🔴 ADR-739 §57 — ΔΥΟ ΠΡΟΧΕΙΡΑ ΓΡΑΦΟΝΤΑΙ ΜΑΖΙ, ΠΑΝΤΑ
 * Η αντιγραφή γεμίζει **και** το πρόχειρο του λειτουργικού (TSV, ώστε το Excel να διαβάζει)
 * **και** τη μνήμη της εφαρμογής (τύποι + μορφή, που το TSV δεν χωρά). Οι δύο εγγραφές ζουν στην
 * **ίδια** συνάρτηση ({@link writeRange}) και όχι σε δύο βήματα του καλούντος: αλλιώς κάποια
 * διαδρομή θα έγραφε το ένα και θα ξεχνούσε το άλλο, και το αποτύπωμα —που είναι όλη η
 * ταυτοποίηση— θα έδειχνε σε φορτίο που δεν υπάρχει ή σε φορτίο μπαγιάτικο.
 *
 * ## 🔴 ADR-739 §67.10 — ΓΙΑΤΙ ΟΙ ΤΡΕΙΣ ΚΛΗΣΕΙΣ ΠΡΟΧΕΙΡΟΥ ΞΑΝΑΓΥΡΙΣΑΝ ΕΔΩ, ΙΔΙΩΤΙΚΕΣ
 * Το §67 τις εξήγαγε σε δικό τους module «τη στιγμή του δεύτερου καταναλωτή» — του μενού
 * κειμένου. Το §67.10 **διέγραψε** εκείνο το μενού (το Excel δείχνει μόνο mini toolbar σε
 * κατάσταση Επεξεργασίας), οπότε ο δεύτερος καταναλωτής έπαψε να υπάρχει. Ένα module με έναν
 * καλούντα και κεφαλίδα που επικαλείται δεύτερο **λέει ψέματα**· η εξαγωγή αναιρέθηκε.
 *
 * ⚠️ Δεν είναι παλινδρόμηση: ο κανόνας ήταν πάντα «εξαγωγή **όταν** εμφανιστεί ο δεύτερος», και
 * ισχύει ακέραιος και προς τις δύο κατευθύνσεις.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-menu-clipboard
 * @see ui/table-cell-editor/use-table-range-actions.ts — η διαδρομή του πληκτρολογίου
 * @see bim/table/table-range-clipboard.ts — οι καθαρές πράξεις (κοινές με εκείνη)
 * @see bim/table/table-clipboard-resolve.ts — ο ΕΝΑΣ κανόνας «από πού έρχεται η επικόλληση»
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  clearTableRange,
  tableRangeToClipboardText,
} from '../../bim/table/table-range-clipboard';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { tableRangeCellRefs, type TableCellRangeBounds } from '../../bim/table/table-cell-range';
// 🔴 ADR-739 §48 — τα «μυρμήγκια» της αντιγραμμένης περιοχής, **μόνο** στην αντιγραφή· δες
// τον λόγο στο `use-table-range-actions.ts` (η αποκοπή δεν υπόσχεται περιοχή που άδειασε).
import { setTableCopyMarquee } from '../../state/table-copy-marquee-store';
// 🔴 ADR-739 §57 — το εσωτερικό πρόχειρο: τι κρατιέται, πού, και πότε ισχύει.
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import { captureTableClipboard } from '../../bim/table/table-clipboard-payload';
import { resolveTablePasteSource } from '../../bim/table/table-clipboard-resolve';
import { FULL_TABLE_PASTE, type TablePasteRequest } from '../../bim/table/table-clipboard-paste';
import { getTableClipboard, setTableClipboard } from '../../state/table-clipboard-store';
import { useLiveTableMutation } from './use-table-model-commit';
import { useTablePasteApply } from './use-table-paste-apply';
import type { TableEntity } from '../../types/table-entity';
import type { ICommand } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

export interface UseTableMenuClipboardParams {
  readonly levelManager: LevelManagerLike;
  readonly execute: (command: ICommand) => void;
  /** Ο πίνακας **τη στιγμή της κλήσης** — ποτέ στιγμιότυπο απόδοσης (ADR-040 κανόνας #2). */
  readonly liveTable: () => TableEntity | null;
}

export interface TableMenuClipboardActions {
  /**
   * Έχει νόημα να προσφερθεί «Επικόλληση»;
   *
   * Συνάρτηση και όχι σταθερά: η απάντηση διαβάζεται τη στιγμή που **ανοίγει** το μενού, μαζί
   * με κάθε άλλη σημαία του στόχου. Λέει «μπορεί να **επιχειρηθεί**», όχι «υπάρχει κάτι στο
   * πρόχειρο **του συστήματος**» — το δεύτερο απαιτεί ασύγχρονη ανάγνωση με άδεια, δηλαδή θα
   * ζητούσε άδεια προχείρου κάθε φορά που ο χρήστης κάνει δεξί κλικ. Ο χρήστης μαθαίνει το
   * άδειο πρόχειρο από το μήνυμα, όχι από γκρίζο item που θα ήταν εξίσου μαντεψιά.
   *
   * §57 — δες τη {@link canPaste} για τον **δεύτερο** λόγο που προστέθηκε (δικό μας φορτίο).
   */
  readonly canPaste: () => boolean;
  readonly copy: (bounds: TableCellRangeBounds) => Promise<void>;
  readonly cut: (bounds: TableCellRangeBounds) => Promise<void>;
  /** Σκέτη «Επικόλληση» — δηλαδή {@link pasteAs} με το {@link FULL_TABLE_PASTE}. */
  readonly paste: (bounds: TableCellRangeBounds) => Promise<void>;
  /**
   * 🔴 §57 — **«Επικόλληση Ειδική»**: τιμές / τύποι / μορφές / υποσύνολο όψεων.
   *
   * Ξεχωριστή μέθοδος από το {@link paste} και όχι προαιρετικό όρισμα: το δεύτερο θα σήμαινε
   * ότι κάθε υπάρχων καλών «ζητά σιωπηλά την προεπιλογή», δηλαδή ότι μια αλλαγή της
   * προεπιλογής αλλάζει συμπεριφορά σε σημεία που κανείς δεν κοίταξε.
   */
  readonly pasteAs: (bounds: TableCellRangeBounds, request: TablePasteRequest) => Promise<void>;
}

export function useTableMenuClipboard(
  params: UseTableMenuClipboardParams,
): TableMenuClipboardActions {
  const { levelManager, execute, liveTable } = params;
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();
  const applyModel = useLiveTableMutation({ levelManager, execute, liveTable });
  const applyPaste = useTablePasteApply({ levelManager, execute });

  /**
   * Γράφει την περιοχή στο πρόχειρο και **δηλώνει αν το ανέλαβε**.
   *
   * Ίδιος διαχωρισμός με το `writeRangeToClipboard` της διαδρομής πληκτρολογίου, και για τον
   * ίδιο λόγο: η αντιγραφή και η αποκοπή διαφέρουν σε **ένα** πράγμα (η δεύτερη αδειάζει μετά),
   * και δύο σώματα με τα ίδια βήματα θα ήταν sibling clone — με τη χειρότερη συνέπεια να είναι
   * ότι η αποκοπή θα μπορούσε κάποτε να γράψει άλλη μορφή από την αντιγραφή.
   */
  const writeRange = useCallback(
    async (bounds: TableCellRangeBounds): Promise<TableEntity | null> => {
      const live = liveTable();
      if (!live) return null;
      const text = tableRangeToClipboardText(activeTableModel(live), bounds);
      if (text === null) return null;
      if (!(await writeClipboardText(text))) {
        notifications.warning(t('table.clipboard.writeDenied'));
        return null;
      }
      // 🔴 §57 — **το δεύτερο πρόχειρο, στην ίδια αναπνοή.** Δες την κεφαλίδα για το γιατί εδώ
      // και όχι στους καλούντες. Η αποτυχία φόρτωσης (μπαγιάτικα όρια) **δεν** ακυρώνει την
      // αντιγραφή: το κείμενο γράφτηκε ήδη έξω και είναι χρήσιμο — απλώς δεν θα υπάρχει πλούσιο
      // φορτίο, και ο επιλυτής θα το δει ως «ξένο κείμενο», που είναι η αλήθεια.
      const payload = captureTableClipboard(activeTableModel(live), resolveTableStyle(live), bounds);
      if (payload) setTableClipboard(payload);
      return live;
    },
    [liveTable, notifications, t],
  );

  const copy = useCallback(
    async (bounds: TableCellRangeBounds) => {
      const live = await writeRange(bounds);
      // §48 — μυρμήγκια **μόνο** όταν η αντιγραφή όντως έγινε: αλλιώς το περίγραμμα θα υποσχόταν
      // πρόχειρο που ποτέ δεν γράφτηκε.
      if (live) setTableCopyMarquee(live.id, bounds, activeTableModel(live));
    },
    [writeRange],
  );

  const cut = useCallback(
    async (bounds: TableCellRangeBounds) => {
      // Αντιγραφή **και μετά** άδειασμα: με την αντίστροφη σειρά το πρόχειρο θα γέμιζε με κενά
      // κελιά. Και μόνο αν η αντιγραφή πέτυχε — αλλιώς θα σβήναμε δεδομένα που δεν μπήκαν
      // πουθενά (μια άρνηση προχείρου δεν επιτρέπεται να γίνει απώλεια).
      if (await writeRange(bounds)) applyModel((model, book) => clearTableRange(book, model, bounds));
    },
    [writeRange, applyModel],
  );

  const pasteAs = useCallback(
    async (bounds: TableCellRangeBounds, request: TablePasteRequest) => {
      const live = liveTable();
      // Η γωνία της επικόλλησης είναι το **πάνω-αριστερά** κελί του στόχου — το πρώτο που
      // απαριθμεί ο ΕΝΑΣ ορισμός των κελιών μιας περιοχής, ποτέ δεύτερη αριθμητική.
      const anchor = live ? tableRangeCellRefs(resolveTableModel(activeTableModel(live)), bounds)[0] : undefined;
      if (!live || anchor === undefined) return;

      // §57 — ο κανόνας των πέντε καταστάσεων ζει **καθαρός** και κοινός με το `Ctrl+V`· εδώ
      // μένει μόνο η ασύγχρονη ανάγνωση, που είναι η μία πραγματική διαφορά αυτής της διαδρομής.
      const source = resolveTablePasteSource(await readClipboardText(), getTableClipboard(), request);
      applyPaste(live, anchor, source, request);
    },
    [liveTable, applyPaste],
  );

  const paste = useCallback(
    (bounds: TableCellRangeBounds) => pasteAs(bounds, FULL_TABLE_PASTE),
    [pasteAs],
  );

  return useMemo(
    () => ({ canPaste, copy, cut, paste, pasteAs }),
    [copy, cut, paste, pasteAs],
  );
}

/**
 * Έχει νόημα να προσφερθεί «Επικόλληση»;
 *
 * §57 — **δύο** λόγοι πλέον, όχι ένας: ή μπορεί να επιχειρηθεί ανάγνωση του προχείρου του
 * συστήματος, ή κρατάμε δικό μας φορτίο. Ο δεύτερος είναι που κρατά την εντολή ζωντανή στον
 * Firefox/Safari, όπου η ανάγνωση χωρίς χειρονομία επικόλλησης δεν είναι καν διαθέσιμη — και
 * είναι ακριβώς η περίπτωση όπου το Google Sheets παραιτείται.
 */
function canPaste(): boolean {
  return canReadClipboard() || getTableClipboard() !== null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Το πρόχειρο του λειτουργικού — **ένα** σημείο επαφής, καμία εξαίρεση προς τα έξω
// ──────────────────────────────────────────────────────────────────────────────

/** Υπάρχει καν API ανάγνωσης; (Firefox χωρίς σημαία, ανασφαλές context, SSR.) */
function canReadClipboard(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';
}

/** `false` όταν το πρόχειρο αρνήθηκε ή δεν υπάρχει — ποτέ εξαίρεση προς τον καλούντα. */
async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** `null` όταν το πρόχειρο αρνήθηκε ή δεν υποστηρίζεται — δες την κεφαλίδα. */
async function readClipboardText(): Promise<string | null> {
  if (!canReadClipboard()) return null;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
