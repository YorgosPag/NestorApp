'use client';

/**
 * ADR-739 Φ.Δ βήμα 8 — **οι ενέργειες της περιοχής**: επέκταση, επιλογή όλων, άδειασμα,
 * αντιγραφή, αποκοπή, επικόλληση.
 *
 * ## Γιατί ξεχωριστό αρχείο και όχι μέσα στον `useTableCellDoubleClickEditor`
 * Ο ανοιχτήρας είναι ήδη **450 γραμμές** — το όριο του N.7.1 είναι 500. Πέντε ακόμη
 * χειριστές θα τον έσπρωχναν έξω και θα ανάγκαζαν έναν βιαστικό διαχωρισμό αργότερα, στη
 * χειρότερη στιγμή. Και ο διαχωρισμός είναι ούτως ή άλλως **σημασιολογικός**: εκείνος ξέρει
 * «ποιο κελί, πού, με τι όψη»· αυτός εδώ ξέρει «ποια κελιά και τι τους κάνω».
 *
 * ## 🔴 ΓΙΑΤΙ ΤΟ ΠΡΟΧΕΙΡΟ ΔΕΝ ΠΕΡΝΑ ΑΠΟ ΠΛΗΚΤΡΑ
 * Το `Ctrl+C`/`Ctrl+V`/`Ctrl+X` **δεν** αναγνωρίζονται ως `keydown`. Ο browser εκπέμπει ήδη
 * πραγματικά συμβάντα `copy`/`cut`/`paste` πάνω στο εστιασμένο `<textarea>` της συνεδρίας,
 * με έτοιμο `clipboardData`. Αυτό είναι καλύτερο σε **τέσσερα** μέτωπα ταυτόχρονα, και το
 * καθένα τους θα ήταν από μόνο του αρκετό:
 *
 *  1. **Καμία άδεια, καμία χειρονομία.** Το `navigator.clipboard.readText()` απαιτεί άδεια
 *     και user gesture, και σε ορισμένα περιβάλλοντα απλώς απορρίπτεται. Το `clipboardData`
 *     του συμβάντος δουλεύει πάντα, γιατί **είναι** η χειρονομία.
 *  2. **Κάθε διάταξη πληκτρολογίου.** Σε **ελληνική** διάταξη το `Ctrl+C` έχει `key: 'ψ'`
 *     και το `Ctrl+V` `key: 'ω'`. Ένας έλεγχος χαρακτήρα θα δούλευε μόνο σε λατινική — το
 *     ίδιο μάθημα που κωδικοποιεί ήδη το `undoRedoIntent` με το `event.code`.
 *  3. **Ό,τι έχει το πρόχειρο, όχι ό,τι νομίζουμε.** Το Excel γεμίζει `text/html` **και**
 *     `text/plain` (TSV)· εμείς διαβάζουμε το δεύτερο απευθείας από την πηγή.
 *  4. **Το ποντίκι δουλεύει δωρεάν.** Δεξί κλικ → «Επικόλληση» εκπέμπει το ίδιο συμβάν.
 *
 * Η **απόφαση** ποιος κατέχει το πρόχειρο σε κάθε κατάσταση δεν ζει εδώ: ζει στο
 * {@link tableClipboardScope}, δίπλα σε κάθε άλλη απόφαση πλήκτρου του πίνακα.
 *
 * ## Ιδιοκτησία πλήκτρων — τίποτα δεν διεκδικείται με `if`
 * Ο `useDxfToolbarShortcuts` παραιτείται από **κάθε** συντόμευση όταν ο στόχος του συμβάντος
 * είναι `INPUT`/`TEXTAREA` (πρώτες γραμμές του `handleKeyDown` του). Άρα όσο η συνεδρία
 * κελιού είναι εστιασμένη, τα `Ctrl+A/C/V` **δεν φτάνουν ποτέ** στον καμβά — ούτε «επιλογή
 * όλων των οντοτήτων», ούτε «πρόχειρο οντοτήτων» (ADR-466). Η ιδιοκτησία είναι **δομική**,
 * όχι δηλωμένη.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-range-actions
 * @see bim/table/table-cell-range.ts — ποια κελιά είναι μέσα (καθαρό)
 * @see bim/table/table-range-clipboard.ts — τι τους κάνω (καθαρό)
 * @see lib/spreadsheet/tsv.ts — η σειριοποίηση (SSoT)
 */

import { useCallback, useMemo, type ClipboardEvent } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { formatTsv, parseTsv, rectangularizeTsvGrid } from '@/lib/spreadsheet/tsv';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { useTableModelCommit } from './use-table-model-commit';
import {
  extendTableCellRangeEnd,
  extendTableSelectionTo,
  resolveTableSelectionBounds,
  tableRangeSize,
  type TableCellRangeBounds,
  type TableCellRef,
} from '../../bim/table/table-cell-range';
// 🔴 ADR-739 §43 — ο ΕΝΑΣ γραφέας του «επίλεξε τα πάντα»: τρεις πόρτες, μία εντολή.
import { selectWholeTable } from './table-select-all-action';
import {
  clearTableRange,
  pasteTsvIntoTable,
  tableRangeToTsvGrid,
  type TablePasteResult,
} from '../../bim/table/table-range-clipboard';
import type { TableCursorMove } from '../../bim/table/table-cell-navigation';
import {
  setTableCellSelection,
  type TableCellCursorState,
} from '../../state/table-cell-cursor-store';
import { tableClipboardScope } from './table-cell-key-intent';
import type { TableEntity } from '../../types/table-entity';
import type { ICommand } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableRangeActionsParams {
  readonly cursor: TableCellCursorState | null;
  /** Η **ζωντανή** οντότητα, ήδη διαβασμένη από τον καλούντα — καμία δεύτερη ανάγνωση σκηνής. */
  readonly entity: TableEntity | null;
  readonly levelManager: LevelManagerLike;
  readonly execute: (command: ICommand) => void;
}

export interface TableRangeActions {
  /** `Shift + βέλος/Home/End` — μεγαλώνει την περιοχή· το ενεργό κελί δεν κουνιέται. */
  readonly extend: (move: TableCursorMove) => void;
  /**
   * `Shift + κλικ` — η περιοχή απλώνεται από το **ενεργό κελί** ως αυτό που δείχτηκε.
   *
   * Δεύτερη γωνία, όχι μετακίνηση: το ενεργό κελί μένει εκεί που ήταν, ακριβώς όπως στο
   * `Shift+βέλος`. Ίδιο με Excel και Sheets.
   */
  readonly selectTo: (cell: TableCellRef) => void;
  /** `Ctrl+A` — όλα τα κελιά **αυτού** του πίνακα. */
  readonly selectAll: () => void;
  /** `Delete` / `Backspace` — αδειάζει **όλη** την περιοχή, με ένα undo. */
  readonly clearSelection: () => void;
  readonly onCopy: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onCut: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLElement>) => void;
}

/**
 * Η προειδοποίηση «απλό κείμενο» λέγεται **μία φορά ανά φόρτωση σελίδας** (§4.5).
 *
 * Ένα toast σε **κάθε** επικόλληση θα ήταν θόρυβος που ο χρήστης μαθαίνει να αγνοεί — και
 * τότε θα έχανε και τα μηνύματα που **μετράνε** (τι δεν χώρεσε). Μία φορά είναι αρκετή για
 * να μάθει τον κανόνα· είναι πληροφορία για το **σύστημα**, όχι για τη συγκεκριμένη πράξη.
 *
 * Σε επίπεδο module και όχι στο store: δεν είναι κατάσταση του πίνακα, δεν σειριοποιείται,
 * δεν αναιρείται.
 */
let plainTextNoticeShown = false;

/** Test helper — μηδενισμός του «μία φορά» μεταξύ tests. */
export function __resetTablePlainTextNoticeForTests(): void {
  plainTextNoticeShown = false;
}

export function useTableRangeActions(params: UseTableRangeActionsParams): TableRangeActions {
  const { cursor, entity, levelManager, execute } = params;
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();

  /**
   * Τα τρέχοντα όρια της επιλογής, **τη στιγμή της κλήσης**.
   *
   * Χωρίς επιλογή επιστρέφει το ορθογώνιο του **ενεργού κελιού** — που δεν είναι πάντα
   * ένα κελί: σε συγχώνευση το κούμπωμα το ανοίγει σε ολόκληρη. Γι' αυτό δεν υπάρχει
   * ξεχωριστός κλάδος «χωρίς περιοχή»: το ίδιο ερώτημα, η ίδια απάντηση.
   */
  const currentBounds = useCallback((): TableCellRangeBounds | null => {
    if (!cursor || !entity) return null;
    const model = resolveTableModel(entity.model);
    // ADR-739 §27.15 — χωρίς επιλογή, το ενεργό κελί είναι **περιοχή**: εκεί το κούμπωμα
    // είναι ακριβώς ο κανόνας που θέλουμε (σκέτο κελί μέσα σε συγχώνευση ⇒ ολόκληρη η
    // συγχώνευση), και είναι η συμπεριφορά που τεκμηριώνεται από πάνω.
    return resolveTableSelectionBounds(
      model,
      cursor.selection ?? { from: cursor.position, to: cursor.position, kind: 'range' },
    );
  }, [cursor, entity]);

  // ADR-739 Φ.Δ βήμα 9 — η μία διαδρομή commit ζει πλέον σε δικό της module: την καλεί και
  // το μενού των ζωνών δείκτη. Δες την κεφαλίδα εκείνου για το γιατί δεν αντιγράφηκε.
  const commitModel = useTableModelCommit({ levelManager, execute });

  const extend = useCallback(
    (move: TableCursorMove) => {
      if (!cursor || !entity) return;
      const model = resolveTableModel(entity.model);
      // Η γωνία που ΜΕΝΕΙ είναι το ενεργό κελί (ή το ήδη σταθερό `from` μιας ανοιχτής
      // επιλογής)· κουνιέται μόνο το `to`. Αυτή ΕΙΝΑΙ η διαφορά `βέλος` ↔ `Shift+βέλος`.
      const current = cursor.selection ?? {
        from: cursor.position,
        to: cursor.position,
        kind: 'range' as const,
      };
      const next = extendTableCellRangeEnd(model, current.to, move);
      // `null` = άκρη πλέγματος. Η περιοχή **μένει** όπου είναι — ποτέ αναδίπλωση, ίδια
      // σύμβαση με τον δρομέα.
      //
      // ADR-739 §27.15 — το είδος **διατηρείται**: `Shift+δεξί` πάνω σε επιλεγμένη στήλη
      // δίνει **δύο ολόκληρες στήλες** (Excel), όχι ορθογώνιο που ξαφνικά ξανακουμπώνει
      // στη συγχώνευση του τίτλου. Η επέκταση δεν αλλάζει **τι** διάλεξε ο χρήστης.
      //
      // §27.16 Ε2 — ο κανόνας ζει πλέον σε **μία** συνάρτηση, γιατί το `Shift+κλικ` σε
      // γράμμα στήλης τον ζητά από άλλο αρχείο. Δύο αντίγραφα μιας γραμμής δεν πιάνονται
      // από κανένα εργαλείο και αποκλίνουν σιωπηλά.
      if (next) setTableCellSelection(extendTableSelectionTo(current, next));
    },
    [cursor, entity],
  );

  const selectTo = useCallback(
    (cell: TableCellRef) => {
      if (!cursor) return;
      // Η **σταθερή** γωνία είναι το ενεργό κελί, ακόμα κι αν υπάρχει ήδη επιλογή: ένα
      // `Shift+κλικ` στο Excel ξαναορίζει την περιοχή από την αφετηρία, δεν την προσθέτει
      // στην προηγούμενη.
      // ADR-739 §27.15 — `Shift+κλικ` σε **κελί** ορίζει γωνίες με το χέρι ⇒ **περιοχή**,
      // με το κούμπωμα ενεργό: εδώ είναι ακριβώς η περίπτωση όπου «μισό συγχωνευμένο
      // κελί» θα ήταν ανερμήνευτο.
      setTableCellSelection({ from: cursor.position, to: cell, kind: 'range' });
    },
    [cursor],
  );

  const selectAll = useCallback(() => {
    if (!cursor || !entity) return;
    // 🔴 ADR-739 §43 — το σώμα μετακόμισε στο {@link selectWholeTable} τη στιγμή που η πράξη
    // απέκτησε **τρίτη** πόρτα (αριστερό και δεξί κλικ στο τετραγωνάκι της γωνίας). Το
    // σκεπτικό — γιατί το «ενεργό κελί δεν μετακινείται» και γιατί το είδος είναι `'range'` —
    // ζει εκεί, δίπλα στον κώδικα που το εκτελεί. Εδώ μένει μόνο ο φύλακας «υπάρχει δρομέας;»,
    // που είναι η γνώση **της συνεδρίας**, όχι της πράξης.
    selectWholeTable(resolveTableModel(entity.model));
  }, [cursor, entity]);

  const clearSelection = useCallback(() => {
    const bounds = currentBounds();
    if (!bounds || !entity) return;
    commitModel(entity, clearTableRange(entity.model, bounds));
  }, [currentBounds, entity, commitModel]);

  // ── Πρόχειρο ──────────────────────────────────────────────────────────────

  /** Το TSV της τρέχουσας περιοχής, ή `null` όταν δεν υπάρχει τι να αντιγραφεί. */
  const rangeAsTsv = useCallback((): string | null => {
    const bounds = currentBounds();
    if (!bounds || !entity) return null;
    const grid = tableRangeToTsvGrid(entity.model, bounds);
    return grid.length === 0 ? null : formatTsv(grid);
  }, [currentBounds, entity]);

  /** `true` όταν το πρόχειρο ανήκει στην **περιοχή**· `false` ⇒ ο browser κάνει τη δουλειά. */
  const ownsClipboard = useCallback(
    () => cursor !== null && tableClipboardScope(cursor.mode) === 'range',
    [cursor],
  );

  /**
   * Γράφει την περιοχή στο πρόχειρο του λειτουργικού και **δηλώνει αν το ανέλαβε**.
   *
   * Η αντιγραφή και η αποκοπή διαφέρουν σε **ένα** πράγμα — η δεύτερη αδειάζει μετά. Δύο
   * σώματα με τα ίδια τέσσερα βήματα ήταν sibling clone και το CHECK 3.28 (jscpd, N.18) το
   * έπιασε (7 γραμμές / 54 tokens). Το σοβαρό δεν είναι οι γραμμές: αν κάποτε προστεθεί
   * δεύτερη μορφή στο πρόχειρο (`text/html`, όπως γράφει το Excel), ένα από τα δύο θα την
   * μάθαινε και το άλλο όχι — δηλαδή η αποκοπή θα επικολλούσε αλλιώς από την αντιγραφή.
   */
  const writeRangeToClipboard = useCallback(
    (event: ClipboardEvent<HTMLElement>): boolean => {
      if (!ownsClipboard()) return false;
      const tsv = rangeAsTsv();
      if (tsv === null) return false;
      event.preventDefault();
      event.clipboardData.setData('text/plain', tsv);
      return true;
    },
    [ownsClipboard, rangeAsTsv],
  );

  const onCopy = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      writeRangeToClipboard(event);
    },
    [writeRangeToClipboard],
  );

  const onCut = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      // Η αποκοπή είναι **αντιγραφή + άδειασμα**, με αυτή τη σειρά: αν το άδειασμα
      // προηγούνταν, το πρόχειρο θα γέμιζε με κενά κελιά. Και **μόνο** αν η αντιγραφή
      // όντως έγινε — αλλιώς θα σβήναμε δεδομένα που δεν μπήκαν πουθενά.
      if (writeRangeToClipboard(event)) clearSelection();
    },
    [writeRangeToClipboard, clearSelection],
  );

  /**
   * Τι έμαθε ο χρήστης μετά την επικόλληση — **ποτέ σιωπηλή απώλεια** (§4.3, §4.5).
   *
   * Δύο διαφορετικά πράγματα, δύο διαφορετικά μηνύματα:
   *  - **τι δεν χώρεσε** (προειδοποίηση, ανά πράξη) — αφορά *αυτά* τα δεδομένα·
   *  - **τι δεν μεταφέρεται ποτέ** (ενημέρωση, μία φορά) — αφορά τον κανόνα του συστήματος.
   */
  const reportPaste = useCallback(
    (result: TablePasteResult) => {
      const parts: string[] = [];
      if (result.fittedRows < result.offeredRows) {
        parts.push(
          t('table.clipboard.pasteClippedRows', {
            fitted: result.fittedRows,
            offered: result.offeredRows,
          }),
        );
      }
      if (result.fittedColumns < result.offeredColumns) {
        parts.push(
          t('table.clipboard.pasteClippedColumns', {
            fitted: result.fittedColumns,
            offered: result.offeredColumns,
          }),
        );
      }
      if (result.skippedMergedCells > 0) {
        parts.push(t('table.clipboard.pasteMergedSkipped', { count: result.skippedMergedCells }));
      }
      if (parts.length > 0) {
        notifications.warning(t('table.clipboard.pasteClipped', { detail: parts.join(' · ') }), {
          duration: 6000,
        });
      }
      if (!plainTextNoticeShown) {
        plainTextNoticeShown = true;
        notifications.info(t('table.clipboard.pastePlainText'), { duration: 8000 });
      }
    },
    [notifications, t],
  );

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      if (!ownsClipboard() || !cursor || !entity) return;
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      const grid = rectangularizeTsvGrid(parseTsv(text));
      if (grid.length === 0) {
        notifications.info(t('table.clipboard.pasteEmpty'));
        return;
      }
      const result = pasteTsvIntoTable(entity.model, cursor.position, grid);
      commitModel(entity, result.model);
      reportPaste(result);
    },
    [ownsClipboard, cursor, entity, commitModel, reportPaste, notifications, t],
  );

  return useMemo(
    () => ({ extend, selectTo, selectAll, clearSelection, onCopy, onCut, onPaste }),
    [extend, selectTo, selectAll, clearSelection, onCopy, onCut, onPaste],
  );
}

/** Το μέγεθος της τρέχουσας επιλογής — `null` όταν δεν υπάρχει πραγματική περιοχή. */
export function resolveTableSelectionSize(
  cursor: TableCellCursorState | null,
  entity: TableEntity | null,
): { readonly rows: number; readonly columns: number } | null {
  if (!cursor || !entity || !cursor.selection) return null;
  const bounds = resolveTableSelectionBounds(resolveTableModel(entity.model), cursor.selection);
  return bounds ? tableRangeSize(bounds) : null;
}
