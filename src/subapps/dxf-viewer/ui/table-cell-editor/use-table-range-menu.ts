'use client';

/**
 * ADR-750 Φάση 4 — **ποιος ανοίγει το μενού περιγραμμάτων και με ποιον στόχο**.
 *
 * ## 🔑 Α22 — ο στόχος είναι το κελί, ΕΚΤΟΣ αν ανήκει στην επιλογή
 * ```
 * επιλογή B2:D4, δεξί κλικ στο C3  ⇒  στόχος B2:D4   (μέσα στην επιλογή)
 * επιλογή B2:D4, δεξί κλικ στο E5  ⇒  στόχος E5      (έξω από αυτήν)
 * καμία επιλογή,  δεξί κλικ στο E5  ⇒  στόχος E5
 * ```
 * Είναι **ακριβώς η σημασιολογία του Excel**, χωρίς την παρενέργειά του. Το Excel τη
 * συμπεραίνει *μετακινώντας* την επιλογή στο κελί που πατήθηκε· εδώ το δεξί κλικ δεν αγγίζει
 * ποτέ την επιλογή (ADR-739 §27.14: «το δεξί σταματά εδώ»), οπότε ο ίδιος κανόνας βγαίνει από
 * την **ερώτηση** αντί από τη μεταβολή. Ο χρήστης βλέπει την επιλογή του ανέπαφη και ξέρει τι
 * θα βαφτεί επειδή ο τίτλος του μενού το γράφει.
 *
 * ⚠️ Η εναλλακτική «πάντα η τρέχουσα επιλογή» απορρίφθηκε ως **ψέμα**: δεξί κλικ στο E5 θα
 * έβαφε το B2:D4, δηλαδή μακριά από τον δείκτη, χωρίς καμία ένδειξη.
 *
 * ## Δώρο από τον ΕΝΑ δρόμο: η συγχώνευση λύνεται μόνη της
 * Το μεμονωμένο κελί περνά από το `resolveTableSelectionBounds` με είδος `'range'`, δηλαδή
 * **κουμπώνει σε ολόκληρη συγχώνευση** (ADR-739 §26.5). Δεξί κλικ σε συγχωνευμένο κελί δίνει
 * περίγραμμα γύρω από **όλη** τη συγχώνευση, χωρίς μία γραμμή ειδικής λογικής εδώ.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-range-menu
 * @see ui/components/TableRangeContextMenu.tsx — η επιφάνεια
 * @see ui/table-cell-editor/use-table-border-actions.ts — οι πράξεις (κοινές με τη Φ3)
 */

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { clearTableRange } from '../../bim/table/table-range-clipboard';
// 🔴 ADR-739 §52 — η μορφοποίηση **κελιών**: ο ίδιος στόχος, οι ίδιες πέντε εντολές, το ίδιο
// στιγμιότυπο με τη ζώνη δείκτη. Καμία δεύτερη υλοποίηση — δες τα δύο modules.
import { tableFormatCommands } from './table-format-commands';
// 🔴 ADR-739 §55/§58 Γ2 — τα τμήματα της γραμμής από τον **ΕΝΑΝ** κατασκευαστή, κοινό με το
// μενού των ζωνών δείκτη. Ίδιο module, ίδιο ύφος με το `resolveTableFormatSnapshot`: στόχος
// μέσα, κατάσταση έξω, μηδέν React.
import {
  resolveTableFormatSnapshot,
  resolveTableToolbarExtrasState,
} from './table-format-snapshot';
// 🔴 ADR-739 §61 — η **πέμπτη** υποδοχή του διαλόγου «Μορφοποίηση κελιών», και η κανονική του
// Excel. Η υποδοχή δεν ζωγραφίζει τίποτα: λέει `open(…)` με τον στόχο του κανόνα Α22.
import { openTableFormatCellsDialog } from '../../state/table-format-cells-dialog-store';
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import { getAllLayers } from '../../stores/LayerStore';
import { useLiveTableMutation } from './use-table-model-commit';
import { useCommandHistory } from '../../core/commands';
import {
  resolveTableSelectionBounds,
  type TableCellRangeBounds,
} from '../../bim/table/table-cell-range';
// 🔴 §61 — η καθαρή γεωμετρία δεικτών (Α22 + ονομασία `B2:D4`) **εξήχθη**: αυτό το αρχείο ήταν
// στα 470/500 (N.7.1) και η υποδοχή «Μορφοποίηση κελιών…» χρειαζόταν χώρο. Εξαγωγή, ποτέ trim.
import {
  rangeLabel,
  sameTableRangeBounds,
  tableBorderTargetBounds,
} from './table-range-menu-target';
import {
  tableEventWorldPoint,
  tablePointerHitAtWorld,
} from './table-cell-pointer-hit';
import {
  getTableCellCursor,
  restartTableCellCursorSession,
} from '../../state/table-cell-cursor-store';
// 🔴 ADR-739 §43 — ο ΕΝΑΣ γραφέας του «επίλεξε τα πάντα». Δες το σκεπτικό στο `resolveTarget`
// για το γιατί το **δεξί** κλικ επιτρέπεται να γράψει, σε αντίθεση με κάθε άλλη διαδρομή.
import { selectWholeTable } from './table-select-all-action';
import { useLiveTable } from './use-live-table';
import { useTableBorderActions } from './use-table-border-actions';
import { useTableMergeActions } from './use-table-merge-actions';
// 🔴 §54 — το πρόχειρο **χωρίς συμβάν** (async Clipboard API) και οι δομικές πράξεις, και τα
// δύο μέσα από τους ήδη υπάρχοντες δρόμους εγγραφής. Καμία νέα πράξη — μόνο νέα πόρτα.
import { useTableMenuClipboard } from './use-table-menu-clipboard';
import { useTableStructureActions } from './use-table-structure-actions';
import { useToolbarFontNames } from './use-toolbar-font-names';
import {
  getTableRangeMenuPort,
  setTableRangeMenuPort,
  type TableRangeMenuPort,
} from './table-range-menu-port';
import type {
  TableRangeContextMenuHandle,
  TableRangeMenuEnabled,
  TableRangeMenuProps,
  TableRangeMenuTarget,
} from '../components/TableRangeContextMenu';
import type { TableToolbarExtrasState } from '../components/table-format-toolbar/table-toolbar-extras';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { ViewTransform } from '../../rendering/types/Types';

export interface UseTableRangeMenuParams {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly transformRef: RefObject<ViewTransform>;
  readonly levelManager: LevelManagerLike;
}

export interface TableRangeMenuMount {
  readonly ref: RefObject<TableRangeContextMenuHandle | null>;
  readonly props: TableRangeMenuProps;
}

export function useTableRangeMenu(params: UseTableRangeMenuParams): TableRangeMenuMount {
  const { containerRef, transformRef, levelManager } = params;
  const menuRef = useRef<TableRangeContextMenuHandle | null>(null);
  const liveTable = useLiveTable(levelManager);
  const { execute } = useCommandHistory();
  const borderActions = useTableBorderActions({ levelManager, liveTable });
  const mergeActions = useTableMergeActions({ levelManager, liveTable });
  // §52 — **η ίδια ουρά** με τη μορφοποίηση άξονα και τα περιγράμματα: ένα
  // `UpdateEntityCommand`, ένα `Ctrl+Z`, καμία δεύτερη διαδρομή εγγραφής (§6.6).
  const applyFormat = useLiveTableMutation({ levelManager, execute, liveTable });
  const formatCommands = useMemo(() => tableFormatCommands(applyFormat), [applyFormat]);
  const clipboard = useTableMenuClipboard({ levelManager, execute, liveTable });
  // §54 — **καμία νέα δομική πράξη**: η ίδια θύρα που δημοσιεύει η κορδέλα (§52), η οποία με
  // τη σειρά της δείχνει στους καθαρούς σχεδιαστές του `table-header-axis-actions`.
  const structure = useTableStructureActions({ levelManager, table: liveTable });
  const fontNames = useToolbarFontNames(levelManager);

  /**
   * 🔴 §27.15/§27.17 — **ΠΟΙΟΝ ΑΞΟΝΑ ΕΝΝΟΕΙ Η «ΕΙΣΑΓΩΓΗ» ΑΠΟ ΕΔΩ** — και πότε καθόλου.
   *
   * Η μόνη νόμιμη πηγή πρόθεσης είναι το **είδος της επιλογής**, ποτέ η γεωμετρία των ορίων:
   * το §27.15 έβγαλε ρητά την προεπιλογή από το `kind` ώστε μια σύρση `'range'` που τυχαίνει να
   * πιάνει όλες τις γραμμές να **μη** διαβάζεται ως «ο χρήστης διάλεξε στήλες». Άρα:
   *
   * ```
   *   επιλογή 'column' και ο στόχος ΕΙΝΑΙ αυτή  ⇒  'column'
   *   επιλογή 'row'    και ο στόχος ΕΙΝΑΙ αυτή  ⇒  'row'
   *   οτιδήποτε άλλο                            ⇒  null  (γκρίζα items)
   * ```
   *
   * ⚠️ Ο έλεγχος ταυτότητας ορίων **δεν** είναι ευλάβεια: ο κανόνας Α22 επιτρέπει στόχο **έξω**
   * από την επιλογή (δεξί κλικ στο `E5` με επιλεγμένες τις στήλες `B:D`). Χωρίς αυτόν, η
   * «Διαγραφή» θα έσβηνε τις `B:D` ενώ ο τίτλος του μενού γράφει `E5` — αλλαγή μακριά από τον
   * δείκτη, ακριβώς το ελάττωμα που τεκμηριώνει το `table-axis-action-target.ts` (Giorgio,
   * 04/08: «η οθόνη έλεγε τρεις, η πράξη έκανε μία»).
   *
   * 🔑 Η **γωνία** («επιλογή όλων») γράφει επιλογή είδους `'range'` (§43), άρα πέφτει εδώ σε
   * `null` — και σωστά: «Εισαγωγή» πάνω σε ολόκληρο τον πίνακα δεν έχει άξονα. Το Excel λύνει
   * την ίδια ασάφεια με **modal διάλογο** τεσσάρων επιλογών (μετατόπιση δεξιά/κάτω, ολόκληρη
   * γραμμή, ολόκληρη στήλη)· μέχρι να υπάρξει, γκρίζο είναι η τίμια απάντηση.
   */
  const structuralAxis = useCallback(
    (bounds: TableCellRangeBounds): 'row' | 'column' | null => {
      const live = liveTable();
      const selection = getTableCellCursor()?.selection;
      if (!live || !selection || selection.kind === 'range') return null;
      const selected = resolveTableSelectionBounds(resolveTableModel(live.model), selection);
      return selected && sameTableRangeBounds(selected, bounds) ? selection.kind : null;
    },
    [liveTable],
  );

  /**
   * 🔴 §52 — ο στόχος μορφοποίησης **αυτής** της περιοχής, τη στιγμή της κλήσης.
   *
   * `kind: 'range'` γραμμένο ρητά και όχι μέσω `tableFormatScopeOf`: εδώ ο στόχος **δεν** είναι
   * η επιλογή του χρήστη αλλά τα όρια που άνοιξε το δεξί κλικ (κανόνας Α22 — μπορεί να είναι
   * ένα κελί **έξω** από την επιλογή). Ένα πέρασμα από τον resolver της επιλογής θα έβαφε τα
   * μαρκαρισμένα κελιά ενώ ο τίτλος του μενού λέει `E5`.
   */
  const formatTarget = useCallback(
    (bounds: TableCellRangeBounds) => {
      const live = liveTable();
      if (!live) return null;
      return {
        // 🔴 ADR-739 §63 — δες `FormatTarget.entityId`: ο στόχος κουβαλά **ποιος** πίνακας.
        entityId: live.id,
        model: live.model,
        style: resolveTableStyle(live),
        scope: { kind: 'range' as const, bounds },
        // ADR-040 κανόνας #2 — getter τη στιγμή του συμβάντος· αυτό το hook ζει στον
        // `CanvasSection`, όπου κάθε συνδρομή γίνεται re-render του orchestrator.
        layerColors: getAllLayers().map((layer) => layer.color),
      };
    },
    [liveTable],
  );

  /**
   * 🔴 §55/§58 Γ2 — **τι δείχνουν τα τέσσερα τμήματα** της γραμμής για αυτά τα κελιά.
   *
   * Ο στόχος περνά **μία** φορά από το {@link formatTarget}: οι τέσσερις αναγνώσεις διατρέχουν
   * η καθεμιά τα κελιά της, και μια δεύτερη κατασκευή στόχου ανάμεσά τους θα άφηνε ανοιχτό το
   * παράθυρο να απαντήσουν πάνω σε **διαφορετικά** μοντέλα (ένα `Ctrl+Z` από συντόμευση
   * ενδιάμεσα) — δηλαδή γραμματοσειρά ενός πίνακα με στοίχιση ενός άλλου.
   *
   * ⚠️ Το **ποια** τμήματα και **πώς** διαβάζονται ζει στο {@link resolveTableToolbarExtrasState}
   * — ο ΕΝΑΣ κατασκευαστής για τις δύο υποδοχές (N.18). Εδώ μένει μόνο **ποιος** είναι ο
   * στόχος: όρια εδώ, ζώνη δείκτη εκεί — ακριβώς ό,τι διαφέρει ανάμεσά τους.
   */
  const toolbarState = useCallback(
    (bounds: TableCellRangeBounds): TableToolbarExtrasState =>
      resolveTableToolbarExtrasState(formatTarget(bounds), fontNames()),
    [formatTarget, fontNames],
  );

  /**
   * 🔴 §54 — **ποιες από τις δεκαπέντε εντολές έχουν νόημα ΤΩΡΑ.**
   *
   * Ό,τι δεν αναφέρεται εδώ μένει γκρίζο δομικά (ο ένας κανόνας ζει στο `TableRangeMenuItems`:
   * χειριστής **και** μη-`false`). Οι έξι που απαντιούνται:
   *
   *  - **αποκοπή / αντιγραφή / απαλοιφή**: ο στόχος υπάρχει ⇒ έχουν νόημα. Η άδεια περιοχή
   *    δεν γκριζάρει: το `clearTableRange` επιστρέφει το **ίδιο** μοντέλο by-reference, άρα
   *    «καμία εντολή, κανένα βήμα undo» — και ο χρήστης δεν χρειάζεται να μάθει τη διαφορά.
   *  - **επικόλληση**: λέει «μπορεί να **επιχειρηθεί** ανάγνωση προχείρου». Το «υπάρχει κάτι
   *    μέσα;» θα απαιτούσε ασύγχρονη ανάγνωση με άδεια σε **κάθε** δεξί κλικ — δες
   *    {@link TableMenuClipboardActions.canPaste}.
   *  - **εισαγωγή / διαγραφή**: μόνο όταν η επιλογή δηλώνει ρητά άξονα και ο στόχος **είναι**
   *    αυτή· δες {@link structuralAxis}. Η διαγραφή περνά επιπλέον από το ίδιο φράγμα «όλα ή
   *    τίποτα» με το ⊖ και το μενού των ζωνών (§42), ώστε τα τρία χειριστήρια να μη μπορούν να
   *    διαφωνήσουν για το αν η πράξη επιτρέπεται.
   */
  const menuCommands = useCallback(
    (bounds: TableCellRangeBounds): TableRangeMenuEnabled => {
      const axis = structuralAxis(bounds);
      return {
        cut: true,
        copy: true,
        pasteAll: clipboard.canPaste(),
        clearContents: true,
        insert: axis !== null,
        delete: axis !== null && structure.canDeleteAxis(axis),
        // 🔴 §61 — **πάντα**: ο στόχος υπάρχει (αλλιώς το μενού δεν θα είχε ανοίξει καν), και ο
        // διάλογος δουλεύει σε κάθε περιοχή, χωρίς προϋπόθεση επιλογής ή άξονα. Ο μοναδικός
        // τρόπος να μην ανοίξει είναι ένα `Ctrl+Z` **ανάμεσα** στο άνοιγμα και το πάτημα — και
        // τον χειρίζεται ο `formatTarget`, που τότε επιστρέφει `null`.
        formatCells: true,
      };
    },
    [structuralAxis, clipboard, structure],
  );

  /**
   * 🔑 Ό,τι ξέρει το μενού για μια περιοχή, σε **μία** ερώτηση.
   *
   * Ξεχωριστό από το {@link resolveTarget} επειδή το ζητούν **δύο** διαφορετικά γεγονότα: το
   * άνοιγμα (που πρώτα πρέπει να βρει *ποια* περιοχή) και η **ανανέωση μετά από εντολή** (που
   * την ξέρει ήδη). Χωρίς τον διαχωρισμό, η ανανέωση θα ξανάκανε hit-test σε συντεταγμένες που
   * δεν έχει — ή θα αντέγραφε το σώμα, δηλαδή δύο απαντήσεις στο «τι δείχνει το κουμπί».
   */
  const describeTarget = useCallback(
    (bounds: TableCellRangeBounds): TableRangeMenuTarget => ({
      bounds,
      label: rangeLabel(bounds),
      canReset: borderActions.canReset(bounds),
      canClearDiagonals: borderActions.canClearDiagonals(bounds),
      merge: mergeActions.resolveState(bounds),
      format: resolveTableFormatSnapshot(formatTarget(bounds)),
      toolbar: toolbarState(bounds),
      commands: menuCommands(bounds),
      borders: {
        canReset: borderActions.canReset(bounds),
        canClearDiagonals: borderActions.canClearDiagonals(bounds),
        onApply: (id) => borderActions.applyCommand(bounds, id),
        onReset: () => borderActions.resetBorders(bounds),
        onApplyDiagonal: (id) => borderActions.applyDiagonal(bounds, id),
        resolvePencil: borderActions.resolvePencil,
        // ADR-750 Φ6 — ο διάλογος ξαναρωτά τα **ίδια** όρια τη στιγμή του ανοίγματος: ένα undo
        // ενόσω το μενού ήταν ανοιχτό σημαίνει «δεν ανοίγει», ποτέ διάλογος πάνω σε φάντασμα.
        moreBorders: {
          // 🔴 §60 — δες την ίδια γραμμή στο `use-table-header-menu.ts`: ο στόχος είναι ο
          // **ίδιος** με κάθε άλλη πράξη μορφοποίησης, και κουβαλά το `scope`.
          // 🔴 §61 — το `onCommit` έφυγε (ένας ξενιστής ⇒ ένας καλών ⇒ μία πόρτα προς την ουρά).
          resolveTarget: () => formatTarget(bounds),
        },
      },
    }),
    [borderActions, mergeActions, formatTarget, toolbarState, menuCommands, applyFormat],
  );

  /**
   * Ο στόχος του δεξιού κλικ· `null` όταν δεν έπεσε σε κελί —ή στη γωνία— ζωντανού πίνακα.
   *
   * ## 🔴 ADR-739 §43 — Η ΜΙΑ ΠΑΡΕΝΕΡΓΕΙΑ, ΡΗΤΗ ΚΑΙ ΜΕΤΡΗΜΕΝΗ
   * Ο κλάδος της γωνίας **γράφει** την επιλογή πριν επιστρέψει, και είναι η **μόνη** διαδρομή
   * δεξιού κλικ σε ολόκληρο τον πίνακα που το κάνει. Είναι απόκλιση από τον κανόνα του §27.14
   * («*το δεξί σταματά εδώ: δήλωσε και παραδώσου*») και από τον Α22 της κεφαλίδας («*ο στόχος
   * βγαίνει από την **ερώτηση** αντί από τη μεταβολή*») — και μπήκε ως **συνειδητή εξαίρεση**,
   * όχι από παράβλεψη:
   *
   *  - **μετρήθηκε στο πραγματικό Excel** (Giorgio, 04/08): με ενεργή επιλογή `B2:C4`, δεξί
   *    κλικ στο τετραγωνάκι ⇒ *«χάθηκε η επιλογή σου κι επιλέχθηκε όλο το φύλλο»*·
   *  - ο ιδιοκτήτης επέλεξε ρητά **full parity** αφού του παρουσιάστηκε η σύγκρουση.
   *
   * ⚠️ Ο λόγος που ο Α22 **δεν** αρκούσε εδώ είναι πραγματικός, όχι τυπικός: η γωνία είναι
   * **κουμπί**, όχι θέση. Ένα μενού με τίτλο `A1:E7` πάνω από μια οθόνη που δείχνει ακόμα
   * μαρκαρισμένο το `B2:C4` λέει δύο πράγματα ταυτόχρονα — και ο Α22 στηρίζεται ακριβώς στο ότι
   * ο τίτλος **συμφωνεί** με ό,τι φαίνεται.
   *
   * Η γραφή περνά από τον **ΕΝΑ** γραφέα ({@link selectWholeTable}), τον ίδιο που εκτελεί το
   * `Ctrl+A` και το αριστερό κλικ — και τα όρια που τιτλοφορούν το μενού είναι **αυτά που
   * γράφτηκαν**, όχι δεύτερος υπολογισμός τους.
   */
  const resolveTarget = useCallback(
    (clientX: number, clientY: number): TableRangeMenuTarget | null => {
      const live = liveTable();
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!live || !container || !transform) return null;

      const world = tableEventWorldPoint({ clientX, clientY }, container, transform);
      if (!world) return null;
      const hit = tablePointerHitAtWorld(live, world, transform.scale);
      const model = resolveTableModel(live.model);

      // 🔴 §43 — το τετραγωνάκι της γωνίας. Το Excel δείχνει εκεί το μενού **ΚΕΛΙΟΥ**, όχι της
      // κεφαλίδας — μετρήθηκε στα δύο στιγμιότυπα της 04/08 και τα ξεχωρίζουν τα ίδια τα items
      // (η γωνία έχει «Έξυπνη αναζήτηση / Φίλτρο / Ταξινόμηση»· η στήλη έχει «Πλάτος στήλης /
      // Απόκρυψη»). Άρα ο στόχος είναι **περιοχή**, και το μενού είναι αυτό εδώ — κανένα νέο.
      if (hit?.where === 'select-all-corner') {
        const whole = selectWholeTable(model);
        return whole ? describeTarget(whole) : null;
      }

      // Ζώνη δείκτη και διαχωριστικό στηλών έχουν **δικούς τους** χειριστές σε προηγούμενη
      // προτεραιότητα· εδώ απαντάμε μόνο για κελιά.
      if (!hit || hit.where !== 'cell') return null;

      const bounds = tableBorderTargetBounds(
        model,
        { rowId: hit.cell.rowId, colId: hit.cell.colId },
        getTableCellCursor()?.selection,
      );
      if (!bounds) return null;

      return describeTarget(bounds);
    },
    [liveTable, containerRef, transformRef, describeTarget],
  );

  useEffect(() => {
    const port: TableRangeMenuPort = {
      open: (x, y) => {
        const target = resolveTarget(x, y);
        if (!target) return false;
        menuRef.current?.open(x, y, target);
        return true;
      },
    };
    setTableRangeMenuPort(port);
    // Έλεγχος ταυτότητας στο cleanup, ίδιος λόγος με τη θύρα των ζωνών: σε διπλό mount το
    // cleanup του παλιού δεν επιτρέπεται να σβήσει τη θύρα που μόλις έγραψε ο νέος.
    return () => {
      if (getTableRangeMenuPort() === port) setTableRangeMenuPort(null);
    };
  }, [resolveTarget]);

  const props = useMemo<TableRangeMenuProps>(
    () => ({
      onApplyBorder: (bounds, commandId) => borderActions.applyCommand(bounds, commandId),
      onResetBorders: (bounds) => borderActions.resetBorders(bounds),
      onApplyDiagonal: (bounds, commandId) => borderActions.applyDiagonal(bounds, commandId),
      // ADR-755 — επιστρέφει `Promise`: η συγχώνευση ρωτά πριν πετάξει περιεχόμενο, και ο
      // καλών περιμένει την απάντηση πριν ξαναρωτήσει την κατάσταση του κουμπιού.
      onApplyMerge: (bounds, commandId) => mergeActions.applyCommand(bounds, commandId),
      // §52 — οι πέντε εντολές μορφοποίησης, παραμετρικές ως προς τα όρια. Ο στόχος
      // ξαναφτιάχνεται **μέσα** σε κάθε χειριστή: ένα undo ενόσω η γραμμή ήταν ανοιχτή
      // σημαίνει «καμία πράξη», ποτέ εγγραφή σε κελιά που δεν υπάρχουν πια.
      formatActions: {
        onToggle: (bounds, key) => formatCommands.toggle(formatTarget(bounds), key),
        onStepSize: (bounds, direction) => formatCommands.stepSize(formatTarget(bounds), direction),
        onReset: (bounds) => formatCommands.reset(formatTarget(bounds)),
        onSetTextColor: (bounds, value) => formatCommands.setField(formatTarget(bounds), 'textColorHex', value),
        onSetFillColor: (bounds, value) => formatCommands.setField(formatTarget(bounds), 'fillColorHex', value),
        // §55 — γραμματοσειρά, μέγεθος, αριθμητική μορφή, στοίχιση: **ο ίδιος** γραφέας με τα
        // δύο χρώματα από πάνω, με το κλειδί ως όρισμα. Καμία δεύτερη διαδρομή εγγραφής.
        onSetField: (bounds, key, value) => formatCommands.setField(formatTarget(bounds), key, value),
        // 🔴 §58 Γ2 — δικός του γραφέας: το `overflow` δεν είναι `keyof TableAxisStyleOverride`.
        onSetOverflow: (bounds, value) => formatCommands.setOverflow(formatTarget(bounds), value),
        // 🔴 §61 — «Μορφοποίηση κελιών…»: **ο ίδιος** `formatTarget` με τις εννιά εντολές από
        // πάνω, δηλαδή ο κανόνας Α22 αυτούσιος (στόχος τα όρια του δεξιού κλικ, όχι η επιλογή).
        // Χωρίς καρτέλα **επίτηδες**: το Excel ανοίγει στην τελευταία που είδε ο χρήστης.
        onOpenFormatCells: (bounds) => openTableFormatCellsDialog({ target: formatTarget(bounds) }),
      },
      /*
        🔴 §54 — οι **έξι εντολές δεδομένων**, παραμετρικές ως προς τα όρια για τον ίδιο λόγο
        με τη μορφοποίηση: ο στόχος ξαναφτιάχνεται **μέσα** σε κάθε χειριστή, ώστε ένα undo
        ενόσω το μενού ήταν ανοιχτό να σημαίνει «καμία πράξη» αντί για εγγραφή σε κελιά που
        δεν υπάρχουν πια.
      */
      rangeActions: {
        onCut: (bounds) => clipboard.cut(bounds),
        onCopy: (bounds) => clipboard.copy(bounds),
        onPaste: (bounds) => clipboard.paste(bounds),
        // Ο έλεγχος ξαναγίνεται **εδώ** και δεν στηρίζεται στο `enabled` που πάγωσε στο
        // άνοιγμα: το μενού επιβιώνει για την επόμενη εντολή, και η επιλογή μπορεί να έχει
        // αλλάξει στο μεταξύ. Καμία εντολή δεν εμπιστεύεται τη σημαία της για να γράψει.
        onInsert: (bounds) => {
          const axis = structuralAxis(bounds);
          if (axis) structure.insertAxis(axis, 'before');
        },
        onDelete: (bounds) => {
          const axis = structuralAxis(bounds);
          if (axis) structure.deleteAxis(axis);
        },
        onClearContents: (bounds) => {
          // §6.6 — **η ίδια** ουρά με κάθε άλλη αλλαγή πίνακα: ένα `UpdateEntityCommand`, ένα
          // `Ctrl+Z`. Το `clearTableRange` ξαναϋπολογίζει μόνο του τους τύπους (§50), οπότε
          // ένα `=SUM(...)` πάνω από τα κελιά που άδειασαν δεν μένει με μπαγιάτικο άθροισμα.
          applyFormat((model) => clearTableRange(model, bounds));
        },
      },
      resolveTarget: describeTarget,
      // Το μενού έκλεισε — η εστίαση επιστρέφει στο κελί, αλλιώς η συνεδρία μένει ζωντανή στο
      // store αλλά κουφή στην οθόνη (ίδια σύμβαση με το μενού των ζωνών).
      onClosed: restartTableCellCursorSession,
    }),
    [
      borderActions, mergeActions, describeTarget, formatCommands, formatTarget,
      clipboard, structure, structuralAxis, applyFormat,
    ],
  );

  return useMemo(() => ({ ref: menuRef, props }), [props]);
}
