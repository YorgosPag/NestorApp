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
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-menu-clipboard
 * @see ui/table-cell-editor/use-table-range-actions.ts — η διαδρομή του πληκτρολογίου
 * @see bim/table/table-range-clipboard.ts — οι καθαρές πράξεις (κοινές με εκείνη)
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  clearTableRange,
  clipboardTextToTableGrid,
  pasteTsvIntoTable,
  tableRangeToClipboardText,
} from '../../bim/table/table-range-clipboard';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { tableRangeCellRefs, type TableCellRangeBounds } from '../../bim/table/table-cell-range';
// 🔴 ADR-739 §48 — τα «μυρμήγκια» της αντιγραμμένης περιοχής, **μόνο** στην αντιγραφή· δες
// τον λόγο στο `use-table-range-actions.ts` (η αποκοπή δεν υπόσχεται περιοχή που άδειασε).
import { setTableCopyMarquee } from '../../state/table-copy-marquee-store';
import { useLiveTableMutation, useTableModelCommit } from './use-table-model-commit';
import { useTablePasteReport } from './use-table-paste-report';
import type { TableEntity } from '../../types/table-entity';
import type { ICommand } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

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
   * με κάθε άλλη σημαία του στόχου. Λέει «μπορεί να **επιχειρηθεί** ανάγνωση», όχι «υπάρχει
   * κάτι στο πρόχειρο» — το δεύτερο απαιτεί ασύγχρονη ανάγνωση με άδεια, δηλαδή θα ζητούσε
   * άδεια προχείρου κάθε φορά που ο χρήστης κάνει δεξί κλικ. Ο χρήστης μαθαίνει το άδειο
   * πρόχειρο από το μήνυμα, όχι από γκρίζο item που θα ήταν εξίσου μαντεψιά.
   */
  readonly canPaste: () => boolean;
  readonly copy: (bounds: TableCellRangeBounds) => Promise<void>;
  readonly cut: (bounds: TableCellRangeBounds) => Promise<void>;
  readonly paste: (bounds: TableCellRangeBounds) => Promise<void>;
}

export function useTableMenuClipboard(
  params: UseTableMenuClipboardParams,
): TableMenuClipboardActions {
  const { levelManager, execute, liveTable } = params;
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();
  const commitModel = useTableModelCommit({ levelManager, execute });
  const applyModel = useLiveTableMutation({ levelManager, execute, liveTable });
  const reportPaste = useTablePasteReport();

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
      const text = tableRangeToClipboardText(live.model, bounds);
      if (text === null) return null;
      if (!(await writeClipboardText(text))) {
        notifications.warning(t('table.clipboard.writeDenied'));
        return null;
      }
      return live;
    },
    [liveTable, notifications, t],
  );

  const copy = useCallback(
    async (bounds: TableCellRangeBounds) => {
      const live = await writeRange(bounds);
      // §48 — μυρμήγκια **μόνο** όταν η αντιγραφή όντως έγινε: αλλιώς το περίγραμμα θα υποσχόταν
      // πρόχειρο που ποτέ δεν γράφτηκε.
      if (live) setTableCopyMarquee(live.id, bounds, live.model);
    },
    [writeRange],
  );

  const cut = useCallback(
    async (bounds: TableCellRangeBounds) => {
      // Αντιγραφή **και μετά** άδειασμα: με την αντίστροφη σειρά το πρόχειρο θα γέμιζε με κενά
      // κελιά. Και μόνο αν η αντιγραφή πέτυχε — αλλιώς θα σβήναμε δεδομένα που δεν μπήκαν
      // πουθενά (μια άρνηση προχείρου δεν επιτρέπεται να γίνει απώλεια).
      if (await writeRange(bounds)) applyModel((model) => clearTableRange(model, bounds));
    },
    [writeRange, applyModel],
  );

  const paste = useCallback(
    async (bounds: TableCellRangeBounds) => {
      const text = await readClipboardText();
      if (text === null) {
        notifications.warning(t('table.clipboard.readDenied'));
        return;
      }
      const grid = clipboardTextToTableGrid(text);
      if (grid.length === 0) {
        notifications.info(t('table.clipboard.pasteEmpty'));
        return;
      }
      const live = liveTable();
      // Η γωνία της επικόλλησης είναι το **πάνω-αριστερά** κελί του στόχου — το πρώτο που
      // απαριθμεί ο ΕΝΑΣ ορισμός των κελιών μιας περιοχής, ποτέ δεύτερη αριθμητική.
      const anchor = live ? tableRangeCellRefs(resolveTableModel(live.model), bounds)[0] : undefined;
      if (!live || anchor === undefined) return;

      const result = pasteTsvIntoTable(live.model, anchor, grid);
      commitModel(live, result.model);
      reportPaste(result);
    },
    [liveTable, commitModel, reportPaste, notifications, t],
  );

  return useMemo(
    () => ({ canPaste: canReadClipboard, copy, cut, paste }),
    [copy, cut, paste],
  );
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
