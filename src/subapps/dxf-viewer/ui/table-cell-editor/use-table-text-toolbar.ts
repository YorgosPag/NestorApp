'use client';

/**
 * ADR-739 §67 / **ADR-753 Φ4** — **ποιος ανοίγει τη γραμμή εργαλείων του δεξιού κλικ μέσα στο
 * κείμενο, και με ποιον στόχο**.
 *
 * ## 🔑 Ο ΣΤΟΧΟΣ ΕΙΝΑΙ ΤΑ ΓΡΑΜΜΑΤΑ ΟΤΑΝ ΥΠΑΡΧΟΥΝ ΓΡΑΜΜΑΤΑ — αλλιώς το κελί
 * ```
 *   μαρκαρισμένοι χαρακτήρες  →  scope 'chars'  →  TableCell.runs   (ADR-753)
 *   σκέτος δρομέας            →  scope 'range'  →  TableCell.styleOverride
 * ```
 * Είναι το Excel, μετρημένο: σε λειτουργία Επεξεργασίας το «Β» πάνω σε μαρκαρισμένα γράμματα
 * βάφει **μόνο αυτά**, ενώ με σκέτο δρομέα βάφει ολόκληρο το κελί.
 *
 * 🔴 **ΕΔΩ ΕΓΡΑΦΕ ΤΟ ΑΝΤΙΘΕΤΟ, ΚΑΙ ΗΤΑΝ ΨΕΥΔΕΣ:** *«ο πίνακας δεν έχει μορφοποίηση ανά
 * χαρακτήρα (`TableCell.value` είναι απλό `string`)»*. Το `value` **μένει** `string` — αλλά
 * δίπλα του υπάρχει `TableCell.runs` από το ADR-753 Φ1, με ολόκληρη τη μηχανή (πράξεις,
 * μέτρηση, τέσσερις ζωγράφους) ήδη γραμμένη. Ο ισχυρισμός δεν ήταν παρωχημένος: ήταν λάθος
 * όταν γράφτηκε, και μαζί του έφευγε η επιλογή κειμένου χωρίς να τη ζητήσει κανείς.
 *
 * ## 🔴 ΚΑΜΙΑ ΕΝΤΟΛΗ ΔΕΔΟΜΕΝΩΝ — και είναι ολόκληρος ο λόγος που αυτό το αρχείο είναι μικρό
 * Η πρώτη γραφή του §67 είχε αποκοπή / αντιγραφή / επικόλληση πάνω στα μαρκαρισμένα γράμματα,
 * με πάγωμα επιλογής, έλεγχο μπαγιάτικων δεικτών και ασύγχρονο πρόχειρο. Ο ιδιοκτήτης μέτρησε
 * το Excel: **δεν υπάρχει μενού εκεί**, μόνο η γραμμή. Οι τρεις εντολές ζουν στα
 * `Ctrl+X`/`C`/`V`, που δουλεύουν **φυσικά** μέσα στο `<textarea>` — με IME, με ελληνικούς
 * τόνους, χωρίς άδεια προχείρου, χωρίς δικό μας κώδικα. Ό,τι διαγράφηκε ήταν **δεύτερη
 * υλοποίηση** μιας δουλειάς που ο browser κάνει σωστά.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-text-toolbar
 * @see ui/components/TableTextMiniToolbar.tsx — η επιφάνεια
 * @see ui/table-cell-editor/table-text-menu-port.ts — γιατί θύρα και όχι νέα προτεραιότητα
 */

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import { findPersistedCell } from '../../bim/table/table-cell-content';
import { isFormulaInput } from '../../bim/table/formula/table-formula-parse';
import { tableCharsFormatScopeOf, type TableFormatScope } from '../../bim/table/table-format-scope';
import {
  resolveTableSelectionBounds,
  type TableCellRangeBounds,
  type TableCellRef,
} from '../../bim/table/table-cell-range';
import {
  hasTableTextSelection,
  isStaleTableTextSelection,
  readTableTextSelection,
  restoreTableTextSelection,
  type TableTextSelection,
} from './table-text-selection';
import { tableModelWithPendingDraft } from './table-text-draft-sync';
import { getAllLayers } from '../../stores/LayerStore';
import { useCommandHistory } from '../../core/commands';
// 🔴 §52 — οι **ίδιες** πέντε εντολές μορφοποίησης με τις δύο άλλες υποδοχές, μέσα από την ίδια
// ουρά (`UpdateEntityCommand`, ένα `Ctrl+Z`). Καμία δεύτερη διαδρομή εγγραφής στυλ.
import { tableFormatCommands } from './table-format-commands';
import {
  resolveTableFontState,
  resolveTableFormatSnapshot,
  type FormatTarget,
} from './table-format-snapshot';
import { rangeLabel } from './table-range-menu-target';
import { useLiveTable } from './use-live-table';
import { useLiveTableMutation } from './use-table-model-commit';
import { useToolbarFontNames } from './use-toolbar-font-names';
import {
  getTableTextMenuPort,
  setTableTextMenuPort,
  type TableTextMenuPort,
} from './table-text-menu-port';
import {
  getTableCellCursor,
  restartTableCellCursorSession,
} from '../../state/table-cell-cursor-store';
import type {
  TableTextField,
  TableTextToolbarHandle,
  TableTextToolbarProps,
  TableTextToolbarTarget,
} from '../components/TableTextMiniToolbar';
import type { TableToggleFormatKey } from '../components/table-format-toolbar/TableFormatToolbar';
import type { TextHeightStepDirection } from '../../bim/table/table-text-height-scale';
import type { PersistedTableModel, TableAxisStyleOverride } from '../../types/table';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableTextToolbarParams {
  readonly levelManager: LevelManagerLike;
}

export interface TableTextToolbarMount {
  readonly ref: RefObject<TableTextToolbarHandle | null>;
  readonly props: TableTextToolbarProps;
}

/**
 * 🔴 Ο στόχος μορφοποίησης **με τα όρια του κελιού δίπλα του** — και δεν είναι τυπικότητα.
 *
 * ## Γιατί τα όρια ταξιδεύουν χωριστά από το `scope`
 * Μέχρι τη Φ4 ο τύπος **στένευε** το `scope` σε `'range'`, γιατί ο στόχος ήταν πάντα το κελί
 * και η ονομασία της γραμμής (`C3`) διάβαζε το `scope.bounds` κατευθείαν. Από τη Φ4 ο στόχος
 * μπορεί να είναι **χαρακτήρες**, που δεν έχουν ορθογώνιο μέσα τους — το έχει το κελί τους,
 * και το βρίσκει το `tableFormatScopeBounds`.
 *
 * Το πεδίο **δεν** είναι δεύτερη αλήθεια: είναι ακριβώς ό,τι θα απαντούσε εκείνη η συνάρτηση,
 * υπολογισμένο **μία** φορά και για τους δύο καταναλωτές (ονομασία · κατασκευή του `'range'`
 * σκέλους). Ένα δεύτερο πέρασμα θα ήταν δεύτερη ανάγνωση του **ίδιου** μοντέλου λίγες γραμμές
 * μετά — φθηνό, αλλά και η ευκαιρία να απαντηθούν διαφορετικά.
 */
type TableTextFormatTarget = FormatTarget & {
  readonly bounds: TableCellRangeBounds;
  /** 🔴 ADR-753 Φ4 — το πρόχειρο πρώτα· δες `TableFormatCommandTarget.prepare`. */
  readonly prepare?: (model: PersistedTableModel) => PersistedTableModel;
};

export function useTableTextToolbar(params: UseTableTextToolbarParams): TableTextToolbarMount {
  const { levelManager } = params;
  const toolbarRef = useRef<TableTextToolbarHandle | null>(null);
  /**
   * Το πεδίο που άνοιξε τη **τελευταία** γραμμή — η μόνη κατάσταση αυτού του hook.
   *
   * Χρειάζεται επειδή το `onClosed` του συμβολαίου είναι `() => void`: η γραμμή δεν κουβαλά τον
   * στόχο της στο κλείσιμο, και η εστίαση **πρέπει** να γυρίσει ακριβώς στο πεδίο που πάτησε ο
   * χρήστης — δες {@link restoreFocus}.
   */
  const fieldRef = useRef<TableTextField | null>(null);
  /**
   * 🔴 ADR-753 Φ4 — **η επιλογή χαρακτήρων, παγωμένη στο δεξί κλικ.**
   *
   * Δες την κεφαλίδα του `table-text-selection.ts` για το γιατί δεν διαβάζεται τη στιγμή του
   * πατήματος: εκείνη τη στιγμή το πληκτρολόγιο το έχει η **γραμμή**, όχι το πεδίο.
   */
  const selectionRef = useRef<TableTextSelection | null>(null);
  /**
   * Πού άνοιξε η γραμμή — χρειάζεται για την **ανανέωσή** της μετά από κάθε εντολή.
   *
   * ⚠️ Χωρίς ανανέωση η γραμμή έδειχνε **μπαγιάτικη** κατάσταση: πατούσες «Β», το μοντέλο
   * γινόταν έντονο, και το κουμπί έμενε αφώτιστο μέχρι το επόμενο δεξί κλικ. Οι δύο αδελφές
   * υποδοχές το κάνουν ήδη (`runFormat` / `runOnRange`: εφαρμογή → **ξαναρώτημα** → κλείσιμο
   * του μενού)· εδώ έλειπε, και φαινόταν μόνο με το μάτι.
   */
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const liveTable = useLiveTable(levelManager);
  const { execute } = useCommandHistory();
  const applyFormat = useLiveTableMutation({ levelManager, execute, liveTable });
  const formatCommands = useMemo(() => tableFormatCommands(applyFormat), [applyFormat]);
  const fontNames = useToolbarFontNames(levelManager);

  /**
   * Ο στόχος μορφοποίησης: το κελί που γράφεται αυτή τη στιγμή· `null` όταν δεν γράφεται κανένα
   * (ο δρομέας έκλεισε, ο πίνακας σβήστηκε, η θέση δεν λύνεται στο μοντέλο).
   *
   * Ξαναφτιάχνεται **μέσα** σε κάθε χειριστή, ο ίδιος κανόνας με τις δύο άλλες υποδοχές: ένα
   * undo ενόσω η γραμμή ήταν ανοιχτή σημαίνει «καμία πράξη», ποτέ εγγραφή σε κελί που έφυγε.
   */
  /**
   * 🔴 ADR-753 Φ4 — **δείχνει ο χρήστης ΓΡΑΜΜΑΤΑ;** — `null` σημαίνει «δείχνει το κελί».
   *
   * Τέσσερις ρητοί λόγοι για να είναι το κελί, και ο καθένας μόνος του αρκεί:
   *
   * 1. **Καμία παγωμένη επιλογή** — η γραμμή δεν άνοιξε από πεδίο κειμένου.
   * 2. **Σκέτος δρομέας** (μηδέν χαρακτήρες). Είναι το Excel: με τον δρομέα ανάμεσα σε δύο
   *    γράμματα, το «Β» βάφει **ολόκληρο** το κελί.
   * 3. **Μπαγιάτικη επιλογή** — το κείμενο άλλαξε από κάτω της (`Ctrl+Z`, ή ο χρήστης
   *    ξαναέπιασε το πεδίο και πληκτρολόγησε ενώ η γραμμή ήταν ανοιχτή). Δείκτες πάνω σε άλλο
   *    κείμενο δεν είναι «σχεδόν σωστοί»· δείχνουν αλλού.
   * 4. **Κελί τύπου** — και είναι το Excel ξανά: το αποτέλεσμα ενός τύπου έχει **ενιαία**
   *    μορφοποίηση, γιατί δεν υπάρχει κανείς να πει ποια θα είναι τα τρία πρώτα ψηφία μετά τον
   *    επόμενο υπολογισμό. Ρωτιέται το **πρόχειρο** και όχι μόνο το αποθηκευμένο `kind`: ο
   *    χρήστης μπορεί να πληκτρολογεί `=SUM(` **αυτή τη στιγμή** πάνω σε κελί κειμένου, και
   *    μέχρι τη δέσμευση το μοντέλο δεν το ξέρει. Ο κριτής είναι ο **ίδιος** που θα κρίνει και
   *    τη γραφή ({@link isFormulaInput}), όχι δεύτερη σύγκριση με `=`.
   */
  const charsScope = useCallback(
    (model: PersistedTableModel, cell: TableCellRef, draft: string): TableFormatScope | null => {
      const field = fieldRef.current;
      const selection = selectionRef.current;
      if (!field || !selection) return null;
      if (!hasTableTextSelection(selection)) return null;
      if (isStaleTableTextSelection(selection, field)) return null;
      if (isFormulaInput(draft)) return null;
      if (findPersistedCell(model, cell.rowId, cell.colId)?.kind === 'formula') return null;
      return tableCharsFormatScopeOf(model, cell, selection);
    },
    [],
  );

  const formatTarget = useCallback((): TableTextFormatTarget | null => {
    const cursor = getTableCellCursor();
    const live = liveTable();
    if (!cursor || !live || cursor.entityId !== live.id) return null;
    const model = resolveTableModel(live.model);
    const { rowId, colId } = cursor.position;
    const cell: TableCellRef = { rowId, colId };
    const bounds = resolveTableSelectionBounds(model, {
      from: cell,
      to: cell,
      // `'range'` και όχι `'cell'`: **κουμπώνει σε ολόκληρη συγχώνευση** (§26.5), δηλαδή η
      // μορφοποίηση από εδώ βάφει ό,τι βλέπει ο χρήστης ως ένα κελί — ίδιο με το μενού περιοχής.
      kind: 'range',
    });
    if (!bounds) return null;

    const chars = charsScope(live.model, cell, cursor.draft);
    return {
      entityId: live.id,
      model: live.model,
      style: resolveTableStyle(live),
      bounds,
      scope: chars ?? { kind: 'range', bounds },
      // ADR-040 κανόνας #2 — getter τη στιγμή του συμβάντος, ποτέ συνδρομή στον orchestrator.
      layerColors: getAllLayers().map((layer) => layer.color),
      // 🔴 Το πρόχειρο γράφεται **μόνο** για στόχο-γράμματα, και ο λόγος είναι ασύμμετρος: εκεί
      // οι δείκτες **δεν σημαίνουν τίποτα** χωρίς το κείμενό τους, ενώ ο στόχος-κελί δεν έχει
      // δείκτες. Ένα άνευ όρου συγχρονισμό θα έβαζε το πληκτρολογημένο κείμενο στο **ίδιο**
      // βήμα αναίρεσης με κάθε πάτημα «Β», χωρίς κανένα κέρδος ορθότητας.
      ...(chars === null ? {} : {
        prepare: (next: PersistedTableModel) => tableModelWithPendingDraft(next, {
          cell,
          draft: cursor.draft,
          binding: live.binding,
        }),
      }),
    };
  }, [liveTable, charsScope]);

  /** Ό,τι δείχνει η γραμμή για το κελί που γράφεται, σε μία ερώτηση. */
  const describeTarget = useCallback(
    (field: TableTextField): TableTextToolbarTarget | null => {
      const target = formatTarget();
      if (!target) return null;
      return {
        field,
        label: rangeLabel(target.bounds),
        format: resolveTableFormatSnapshot(target),
        fonts: resolveTableFontState(target),
        fontNames: fontNames(),
      };
    },
    [formatTarget, fontNames],
  );

  /**
   * 🔴 **Ο ΕΝΑΣ δρόμος κάθε εντολής**: εφαρμογή → ξαναρώτημα → επαναφορά του μαρκαρίσματος.
   *
   * Ίδια σειρά με τις δύο αδελφές υποδοχές (`runFormat` / `runOnRange`), μείον το «κλείσιμο του
   * μενού» — εδώ **δεν υπάρχει** μενού (§67.10), και η γραμμή οφείλει να επιβιώσει για την
   * επόμενη εντολή (§28.13: «έντονα, μετά πλάγια, μετά ένα μέγεθος πάνω»).
   *
   * ⚠️ Η **παγωμένη επιλογή δεν ξαναδιαβάζεται** ενδιάμεσα: τα τρία πατήματα δείχνουν στα ίδια
   * γράμματα, και μια ανάγνωση από το πεδίο τη στιγμή του δεύτερου θα απαντούσε για κατάσταση
   * που ο χρήστης δεν έχει δει. Ό,τι γίνεται είναι το αντίστροφο — η επιλογή **ξαναδηλώνεται**
   * στο πεδίο, ώστε τα γράμματα να μένουν μαρκαρισμένα όπως στο Excel.
   */
  const runFormat = useCallback(
    (command: (target: TableTextFormatTarget | null) => void): void => {
      command(formatTarget());

      const field = fieldRef.current;
      const anchor = anchorRef.current;
      if (!field || !anchor) return;

      const selection = selectionRef.current;
      if (selection) restoreTableTextSelection(field, selection);

      // Ο στόχος μπορεί να **έφυγε** μέσα στην ίδια χειρονομία (ένα `Ctrl+Z` από συντόμευση που
      // έσβησε τη γραμμή). Τότε η γραμμή δεν έχει τι να δείξει: κλείνει με το `close()` του
      // συμβολαίου — εντολή του ιδιοκτήτη, όχι αποχώρηση του χρήστη, άρα **χωρίς** επαναφορά
      // εστίασης σε πεδίο που δεν υπάρχει πια.
      const next = describeTarget(field);
      if (next === null) toolbarRef.current?.close();
      else toolbarRef.current?.open(anchor.x, anchor.y, next);
    },
    [formatTarget, describeTarget],
  );

  const formatActions = useMemo(
    () => ({
      onToggle: (key: TableToggleFormatKey) =>
        runFormat((target) => formatCommands.toggle(target, key)),
      onStepSize: (direction: TextHeightStepDirection) =>
        runFormat((target) => formatCommands.stepSize(target, direction)),
      onSetTextColor: (value: string | undefined) =>
        runFormat((target) => formatCommands.setField(target, 'textColorHex', value)),
      onSetField: <K extends keyof TableAxisStyleOverride>(
        key: K,
        value: TableAxisStyleOverride[K] | undefined,
      ) => runFormat((target) => formatCommands.setField(target, key, value)),
    }),
    [formatCommands, runFormat],
  );

  /**
   * 🔴 **Η ΕΣΤΙΑΣΗ ΓΥΡΙΖΕΙ ΜΟΝΟ ΑΝ ΤΗΝ ΕΙΧΕ Η ΓΡΑΜΜΗ** — αλλιώς παλεύει με τον χρήστη.
   *
   * Το κλείσιμο έρχεται από τρεις αφορμές (πλήκτρο, κύλιση, κλικ έξω) και **μόνο η πρώτη** αφήνει
   * την εστίαση εκεί που ήταν. Ένα άνευ όρου `field.focus()` θα ξανάπαιρνε το πληκτρολόγιο τη
   * στιγμή που ο χρήστης πάτησε **άλλο** κελί ή άλλο εργαλείο — δηλαδή θα ακύρωνε τη δική του
   * κίνηση, σιωπηλά.
   *
   * ⚠️ Ο έλεγχος `isConnected` δεν είναι ευλάβεια: αν στο μεταξύ ξαναστήθηκε ο επεξεργαστής
   * (αλλαγή `sessionId`), το παγωμένο στοιχείο είναι **ορφανό** και το `focus()` του δεν κάνει
   * τίποτα — σιωπηλά. Τότε ο σωστός δρόμος είναι ο ίδιος με των αδελφών μενού: ξαναστήσιμο μέσω
   * React (`key` ⇒ νέο `<textarea autoFocus>`), ποτέ ωμό `focus()` σε νεκρό κόμβο.
   */
  const restoreFocus = useCallback(() => {
    const field = fieldRef.current;
    // 🔴 ADR-753 Φ4 — **η παγωμένη επιλογή πεθαίνει με τη γραμμή.** Επιβιώνει μόνο όσο ζει το
    // ένα δεξί κλικ που τη γέννησε: το επόμενο άνοιγμα την ξαναπαγώνει, και ένα υπόλειμμα
    // ανάμεσα στα δύο θα ήταν δείκτες που κανείς δεν επαλήθευσε — ακριβώς η κατάσταση για την
    // οποία υπάρχει ο έλεγχος μπαγιάτικου.
    selectionRef.current = null;
    anchorRef.current = null;
    if (!field) return;
    // Η γραμμή είχε το πληκτρολόγιο ⇒ δώσ' το πίσω. Αλλιώς ο χρήστης το πήγε κάπου μόνος του.
    if (typeof document !== 'undefined' && document.activeElement === field) return;
    if (field.isConnected) field.focus();
    else restartTableCellCursorSession();
  }, []);

  useEffect(() => {
    const port: TableTextMenuPort = {
      open: (x, y, field) => {
        // 🔴 ADR-753 Φ4 — **ΤΟ ΠΑΓΩΜΑ ΓΙΝΕΤΑΙ ΕΔΩ, ΠΡΙΝ ΑΠΟ ΟΤΙΔΗΠΟΤΕ ΑΛΛΟ.**
        //
        // Είναι η **μόνη** στιγμή που το πεδίο κατέχει ακόμη το πληκτρολόγιο: το δεξί κλικ δεν
        // έχει μετακινήσει την εστίαση, ενώ το πρώτο πάτημα κουμπιού την έχει ήδη πάρει. Και
        // πρέπει να προηγηθεί του {@link describeTarget}, γιατί **εκείνο** ρωτά ήδη ποιο είναι
        // το σκέλος του στόχου — δηλαδή διαβάζει την επιλογή που μόλις παγώσαμε.
        fieldRef.current = field;
        selectionRef.current = readTableTextSelection(field);
        const target = describeTarget(field);
        if (!target) {
          selectionRef.current = null;
          return false;
        }
        anchorRef.current = { x, y };
        toolbarRef.current?.open(x, y, target);
        return true;
      },
    };
    setTableTextMenuPort(port);
    // Έλεγχος ταυτότητας στο cleanup, ίδιος λόγος με τις τρεις αδελφές θύρες: σε διπλό mount το
    // cleanup του παλιού δεν επιτρέπεται να σβήσει τη θύρα που μόλις έγραψε ο νέος.
    return () => {
      if (getTableTextMenuPort() === port) setTableTextMenuPort(null);
    };
  }, [describeTarget]);

  const props = useMemo<TableTextToolbarProps>(
    () => ({ formatActions, onClosed: restoreFocus }),
    [formatActions, restoreFocus],
  );

  return useMemo(() => ({ ref: toolbarRef, props }), [props]);
}
