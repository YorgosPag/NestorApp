'use client';

/**
 * ADR-739 Φ.Δ βήμα 9 — **το δεξί κλικ πάνω στα γράμματα στηλών και τους αριθμούς γραμμών**:
 * εισαγωγή και διαγραφή, με ρητή κατεύθυνση.
 *
 * ## Γιατί ΔΕΝ μπαίνει δεύτερος ακροατής `contextmenu`
 * Ο `useCanvasContextMenu` είναι ήδη ακροατής **φάσης σύλληψης** στο ίδιο container, και
 * γράφεται πρώτος. Ένας δεύτερος θα έτρεχε **μετά** — αφού το μενού οντότητας θα είχε ήδη
 * ανοίξει, γιατί σε λειτουργία πίνακα ο πίνακας **είναι** η επιλεγμένη οντότητα. Η σειρά
 * εγγραφής ακροατών δεν είναι συμβόλαιο· ο δρομολογητής είναι. Εδώ λοιπόν δεν υπάρχει
 * `addEventListener`, μόνο μια **θύρα** που ο δρομολογητής ρωτά στη σωστή προτεραιότητα.
 *
 * ## 🔴 Καμία συνδρομή React — τα πάντα διαβάζονται τη στιγμή του συμβάντος
 * Ούτε `useTableCellCursor`, ούτε ανάγνωση σκηνής στο render. Δύο λόγοι, και ο δεύτερος είναι
 * ο σοβαρός:
 *  1. **ADR-040**: αυτό το hook καλείται μέσα από τον `CanvasSection`· κάθε συνδρομή του
 *     γίνεται re-render του orchestrator.
 *  2. **Ορθότητα**: οι σημαίες «μπορώ να διαγράψω;» πρέπει να απαντηθούν τη στιγμή που
 *     **ανοίγει** το μενού, όχι στο τελευταίο render — αλλιώς ένα undo που έγινε ενδιάμεσα θα
 *     άφηνε ένα item ενεργό ενώ η πράξη δεν επιτρέπεται πια.
 *
 * ## 🔴 Ο δρομέας ΔΕΝ πεθαίνει όταν ανοίγει το μενού
 * Το `useTableCellSessionBlur` κλείνει τη συνεδρία όταν η εστίαση φύγει σε μη-μέλος της. Το
 * Radix εστιάζει το περιεχόμενο του μενού μόλις ανοίξει ⇒ **οι ζώνες θα εξαφανίζονταν τη
 * στιγμή που τις πατάς**, και το `Esc` θα σε πέταγε έξω από τον πίνακα. Η λύση δεν είναι νέος
 * κανόνας: το `TABLE_CELL_SESSION_MARKER` απλώνεται και στο μενού — «απλώνεται σε **κάθε**
 * εστιάσιμο στοιχείο της συνεδρίας», όπως λέει ο ίδιος ο ορισμός του. Στο κλείσιμο, το
 * `restartTableCellCursorSession` επαναφέρει την εστίαση στο κελί.
 *
 * ## Καμία δεύτερη διαδρομή εγγραφής
 * Κάθε ενέργεια είναι **καθαρή πράξη → `commitModel`**: ένα `UpdateEntityCommand`, ένα
 * `Ctrl+Z`, η ίδια διαδρομή με την επεξεργασία κελιού και την επικόλληση (§6.6).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-header-menu
 * @see bim/table/table-indicator-geometry.ts — ΠΟΥ είναι η ζώνη (SSoT, κοινό με τον ζωγράφο)
 * @see bim/table/table-axis-action-target.ts — ΠΟΙΟΥΣ άξονες αφορά το πάτημα (§27.17)
 * @see ui/table-cell-editor/table-header-axis-actions.ts — ΤΙ κάνει η κάθε εντολή (καθαρό)
 */

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import {
  computeTableEntityGeometryLive,
  resolveTableStyle,
  tablePxPerMm,
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
import {
  isTableIndicatorVisible,
  tableIndicatorBandsMm,
  tableIndicatorHitAtFrame,
  type TableIndicatorHit,
} from '../../bim/table/table-indicator-geometry';
// ADR-739 §27.17 — η πράξη ακολουθεί την **επιλογή**, όχι μόνο το γράμμα που πατήθηκε.
import {
  resolveTableAxisActionTarget,
  type TableAxisActionTarget,
} from '../../bim/table/table-axis-action-target';
import {
  deleteAxisTarget,
  insertAt,
  resolveHeaderState,
  type AxisActionPlanner,
  type SurvivorPick,
} from './table-header-axis-actions';
// 🔴 §42 — η ΜΙΑ διαδρομή «δομική πράξη άξονα → εντολή → επιζών δρομέας», κοινή με το ⊖ (N.18).
import { useTableAxisActionApply } from './use-table-axis-action-apply';
// 🔴 ADR-739 §52 — η μορφοποίηση περνά πλέον από τον **ΕΝΑ** δρόμο επιλογής στόχου. Οι δύο
// γραφείς (άξονας / κελιά) δεν καλούνται ποτέ κατευθείαν από επιφάνεια.
import {
  tableFormatScopeBounds,
  type TableFormatScope,
} from '../../bim/table/table-format-scope';
import { tableFormatCommands } from './table-format-commands';
// 🔴 ADR-739 §55/§58 Γ2 — οι αναγνώσεις των τμημάτων της γραμμής έρχονται από τον **ΕΝΑΝ**
// κατασκευαστή, τον ίδιο που καλεί το μενού της περιοχής: **η μία πλευρά δεν επιτρέπεται να
// μάθει τέταρτο τμήμα και η άλλη όχι** (N.18 — το CHECK 3.28 έπιασε το δίδυμο στο §58 Γ2).
import {
  resolveTableFormatSnapshot,
  resolveTableToolbarExtrasState,
  type FormatTarget,
} from './table-format-snapshot';
import { useToolbarFontNames } from './use-toolbar-font-names';
// 🔴 ADR-739 §61 — η **τέταρτη** υποδοχή του διαλόγου «Μορφοποίηση κελιών». Η υποδοχή δεν
// ζωγραφίζει τίποτα: λέει `open(…)` με τον στόχο του άξονα που πατήθηκε.
import { openTableFormatCellsDialog } from '../../state/table-format-cells-dialog-store';
import { getAllLayers } from '../../stores/LayerStore';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';
import { useTableBorderActions } from './use-table-border-actions';
import { useTableMergeActions } from './use-table-merge-actions';
import {
  getTableCellCursor,
  restartTableCellCursorSession,
} from '../../state/table-cell-cursor-store';
import { useLiveTable } from './use-live-table';
import {
  getTableHeaderMenuPort,
  setTableHeaderMenuPort,
  type TableHeaderMenuPort,
} from './table-header-menu-port';
import { useLiveTableMutation } from './use-table-model-commit';
import { useCommandHistory } from '../../core/commands';
import type { PersistedTableModel } from '../../types/table';
import type { TableToolbarExtrasState } from '../components/table-format-toolbar/table-toolbar-extras';
import type {
  TableHeaderContextMenuHandle,
  TableHeaderMenuProps,
} from '../components/TableHeaderContextMenu';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

export interface UseTableHeaderMenuParams {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly transformRef: RefObject<ViewTransform>;
  readonly levelManager: LevelManagerLike;
}

export interface TableHeaderMenuMount {
  readonly ref: RefObject<TableHeaderContextMenuHandle | null>;
  readonly props: TableHeaderMenuProps;
}

export function useTableHeaderMenu(params: UseTableHeaderMenuParams): TableHeaderMenuMount {
  const { containerRef, transformRef, levelManager } = params;
  const { execute } = useCommandHistory();
  const menuRef = useRef<TableHeaderContextMenuHandle | null>(null);

  /** Ο πίνακας του δρομέα, **τη στιγμή της κλήσης**· `null` χωρίς δρομέα ή σβησμένο πίνακα. */
  const liveTable = useLiveTable(levelManager);

  const getHit = useCallback(
    (clientX: number, clientY: number): TableIndicatorHit | null => {
      const live = liveTable();
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!live || !container || !transform) return null;

      const geometry = computeTableEntityGeometryLive(live);
      const pxPerMm = tablePxPerMm(geometry.mmToWorld, transform.scale);
      // Ό,τι δεν ζωγραφίστηκε δεν πιάνεται: το ΙΔΙΟ κατώφλι LOD με τον ζωγράφο, από το ίδιο
      // module. Αλλιώς ένα δεξί κλικ στο κενό γύρω από μια κουκκίδα θα άνοιγε μενού στήλης.
      if (!isTableIndicatorVisible(geometry.layout.widthMm, geometry.layout.heightMm, pxPerMm)) {
        return null;
      }

      const rect = container.getBoundingClientRect();
      const viewport: Viewport = { width: rect.width, height: rect.height };
      const world = CoordinateTransforms.screenToWorld(
        { x: clientX - rect.left, y: clientY - rect.top },
        transform,
        viewport,
      );
      const frame = tableWorldToFrame(live, world, geometry.mmToWorld);
      return tableIndicatorHitAtFrame(geometry.layout, frame, tableIndicatorBandsMm(pxPerMm));
    },
    [liveTable, containerRef, transformRef],
  );

  // Η θύρα προς τον δρομολογητή. Το `open` περνά από το ref ώστε η ταυτότητα της θύρας να
  // μην αλλάζει με κάθε απόδοση του μενού.
  useEffect(() => {
    const port: TableHeaderMenuPort = {
      getHit,
      open: (x, y, hit) => menuRef.current?.open(x, y, hit),
    };
    setTableHeaderMenuPort(port);
    // Έλεγχος ταυτότητας στο cleanup: σε διπλό mount (React StrictMode) ή σε ξαναδέσιμο του
    // effect, το cleanup του **παλιού** δεν επιτρέπεται να σβήσει τη θύρα που μόλις έγραψε ο
    // νέος — αλλιώς το δεξί κλικ θα σταματούσε να βρίσκει τις ζώνες, σιωπηλά.
    return () => {
      if (getTableHeaderMenuPort() === port) setTableHeaderMenuPort(null);
    };
  }, [getHit]);

  /**
   * Η μία διαδρομή κάθε δομικής ενέργειας: καθαρή πράξη πάνω στο **ζωντανό** μοντέλο, μία
   * εντολή, και μετά ο δρομέας τοποθετείται σε κελί που **υπάρχει**.
   *
   * ⚠️ §42 — το σώμα μετακόμισε στο {@link useTableAxisActionApply} τη στιγμή που το **⊖ της
   * διαγραφής** ζήτησε την ίδια ακριβώς ακολουθία. Το σκεπτικό (γιατί η τοποθέτηση του δρομέα
   * δεν είναι προαιρετική) μένει γραμμένο εκεί, δίπλα στον κώδικα που το εκτελεί. Εδώ μένει
   * μόνο η ανάγνωση του ζωντανού πίνακα — η γνώση που είναι όντως του μενού.
   */
  const applyAxisAction = useTableAxisActionApply({ levelManager, execute });
  const apply = useCallback(
    (mutate: (model: PersistedTableModel) => PersistedTableModel, pick: SurvivorPick) => {
      const live = liveTable();
      if (live) applyAxisAction(live, mutate, pick);
    },
    [liveTable, applyAxisAction],
  );

  /**
   * 🔴 ADR-739 §27.17 — **ΠΟΙΟΥΣ ΑΞΟΝΕΣ ΑΦΟΡΑ ΤΟ ΠΑΤΗΜΑ**: τον έναν, ή ολόκληρη την επιλογή.
   *
   * Η επιλογή διαβάζεται με **getter τη στιγμή του συμβάντος** (ADR-040 κανόνας #2), ποτέ με
   * συνδρομή: αυτό το hook ζει μέσα στον `CanvasSection`. Και είναι και **ορθότητα**, όχι μόνο
   * απόδοση — ο κανόνας πρέπει να απαντηθεί με ό,τι φωτίζει στην οθόνη **τώρα**, όχι με ό,τι
   * ίσχυε στο τελευταίο render.
   */
  const axisTarget = useCallback(
    (hit: TableIndicatorHit): TableAxisActionTarget | null => {
      const live = liveTable();
      if (!live) return null;
      return resolveTableAxisActionTarget(
        resolveTableModel(live.model),
        hit,
        getTableCellCursor()?.selection,
      );
    },
    [liveTable],
  );

  /**
   * 🔴 ADR-739 §52 — **ο ίδιος στόχος, στη γλώσσα της μορφοποίησης**.
   *
   * Το `TableAxisActionTarget` κρατά ταυτότητες **και** θέσεις (η διαγραφή θέλει τις πρώτες, η
   * εισαγωγή τις δεύτερες)· το {@link TableFormatScope} κρατά μόνο ό,τι χρειάζεται μια
   * εγγραφή στυλ. Η μετάφραση ζει εδώ και είναι **μία γραμμή**, ακριβώς για να μη μπει
   * `axis`/`ids` σε τέσσερις χειριστές — και για να καλεί αυτή η υποδοχή **τις ίδιες**
   * συναρτήσεις με την κορδέλα και με το μενού των κελιών.
   */
  const formatScope = useCallback(
    (hit: TableIndicatorHit): TableFormatScope | null => {
      const target = axisTarget(hit);
      return target ? { kind: 'axis', axis: target.axis, ids: target.ids } : null;
    },
    [axisTarget],
  );

  /**
   * Η **μία** διαδρομή κάθε δομικής πράξης: στόχος → σχέδιο (μεταβολή + πού πάει ο δρομέας)
   * → το υπάρχον {@link apply}.
   *
   * Τα τρία items δεν έχουν πια από έναν δικό τους δρόμο με δικό του `hit.index`: εκείνο ήταν
   * το σημείο όπου η επιλογή του χρήστη χανόταν σιωπηλά. Ο διαχωρισμός «τι κάνει» (καθαροί
   * σχεδιαστές, παρακάτω) από «ποιος το εκτελεί» (εδώ) κρατά τη γνώση της πράξης δοκιμάσιμη
   * χωρίς store, χωρίς React και χωρίς στημένο δρομέα.
   */
  const runAxisAction = useCallback(
    (target: TableAxisActionTarget | null, planner: AxisActionPlanner) => {
      if (!target) return;
      const { mutate, pick } = planner(target);
      apply(mutate, pick);
    },
    [apply],
  );

  /**
   * Η διαδρομή των πράξεων **μορφοποίησης** — ίδιο commit, αλλά **χωρίς** να αγγίζει τον δρομέα.
   *
   * 🔴 Δεν περνά από το {@link apply} επίτηδες. Εκείνο τελειώνει με `setTableCellCursor`, που
   * υπάρχει επειδή μια **διαγραφή** μπορεί να σβήσει τη γραμμή κάτω από τον δρομέα. Η
   * μορφοποίηση δεν προσθέτει ούτε αφαιρεί ποτέ γραμμές, άρα η θέση παραμένει έγκυρη — και το
   * γράψιμο του δρομέα θα ζητούσε πίσω την **εστίαση** στο κελί, κλέβοντάς την από το κουμπί
   * που μόλις πάτησε ο χρήστης: το πρώτο «Β» θα δούλευε και το δεύτερο θα έπεφτε στο κενό.
   *
   * ⚠️ Το σώμα μετακόμισε στο `use-table-model-commit` ως {@link useLiveTableMutation}: οι
   * εντολές περιγράμματος (ADR-750 Φ3) ζητούν **την ίδια ακριβώς** ακολουθία, και το CHECK 3.28
   * τη μέτρησε ως sibling clone μέσα στο ίδιο commit. Το σκεπτικό μένει εδώ γιατί εδώ γεννήθηκε.
   */
  const applyFormat = useLiveTableMutation({ levelManager, execute, liveTable });
  // §52 — οι πέντε εντολές, δεμένες μία φορά στον παραπάνω δεσμευτή (δες το module για το
  // γιατί η κατάσταση διαβάζεται **μέσα** στη μεταβολή και όχι πριν από αυτήν).
  const formatCommands = useMemo(() => tableFormatCommands(applyFormat), [applyFormat]);

  const borderActions = useTableBorderActions({ levelManager, liveTable });
  const mergeActions = useTableMergeActions({ levelManager, liveTable });

  /**
   * ADR-750 Φ3 — τα **όρια** που αντιστοιχούν σε μια ζώνη δείκτη: ολόκληρη η στήλη ή γραμμή.
   */
  const axisBounds = useCallback(
    (hit: TableIndicatorHit): TableCellRangeBounds | null => {
      const live = liveTable();
      const scope = formatScope(hit);
      if (!live || !scope) return null;
      // 🔴 ADR-739 §27.17 — τα περιγράμματα καλύπτουν **όλους** τους επιλεγμένους άξονες.
      //
      // ⚠️ §52 — το σώμα (πρώτος + τελευταίος άξονας μέσα από τον ΕΝΑ ορισμό της «ολόκληρης
      // στήλης», §27.16 Ε2) **μετακόμισε** στο {@link tableFormatScopeBounds}: η κορδέλα ρωτά
      // το ίδιο πράγμα και ένα αντίγραφο εδώ θα ήταν δεύτερη απάντηση στο «ποιο ορθογώνιο
      // είναι μια μαρκαρισμένη στήλη;». Ο πειρασμός των δύο γραμμών αριθμητικής
      // (`firstCol: target.firstIndex, …`) εξηγείται εκεί.
      return tableFormatScopeBounds(live.model, scope);
    },
    [liveTable, formatScope],
  );

  /**
   * Οι άξονες + το στυλ + το μοντέλο, τη στιγμή της κλήσης· `null` χωρίς ζωντανό πίνακα.
   *
   * 🔴 §27.17 — **οι ίδιοι ακριβώς άξονες** με τις δομικές πράξεις: μία ερώτηση
   * ({@link axisTarget}), δύο καταναλωτές. Δύο ξεχωριστοί υπολογισμοί θα σήμαιναν ότι το μενού
   * μπορεί κάποτε να σβήσει τρεις στήλες ενώ η γραμμή βάφει δύο.
   */
  const formatTarget = useCallback(
    (hit: TableIndicatorHit): FormatTarget | null => {
      const live = liveTable();
      const scope = formatScope(hit);
      if (!live || !scope) return null;
      return {
        // 🔴 ADR-739 §63 — δες `FormatTarget.entityId`: ο στόχος κουβαλά **ποιος** πίνακας.
        entityId: live.id,
        model: live.model,
        style: resolveTableStyle(live),
        scope,
        // ADR-739 Φ.Ε/Φ4 — τα χρώματα του σχεδίου διαβάζονται με **getter τη στιγμή του
        // συμβάντος** (ADR-040 κανόνας #2), ποτέ με συνδρομή: αυτό το hook καλείται μέσα από
        // τον `CanvasSection`, όπου κάθε συνδρομή γίνεται re-render του orchestrator.
        layerColors: getAllLayers().map((layer) => layer.color),
      };
    },
    [liveTable, formatScope],
  );

  const fontNames = useToolbarFontNames(levelManager);

  /**
   * 🔴 §55/§58 Γ2 — **τι δείχνουν τα τέσσερα τμήματα** για τους άξονες που πατήθηκαν.
   *
   * Ο στόχος περνά **μία** φορά από το {@link formatTarget}, για τον ίδιο λόγο που τον περνά
   * μία φορά και το μενού της περιοχής: τέσσερις ξεχωριστές κατασκευές θα άφηναν ανοιχτό το
   * παράθυρο να απαντήσουν πάνω σε διαφορετικά μοντέλα (`Ctrl+Z` από συντόμευση ενδιάμεσα).
   *
   * ⚠️ Το **ποια** τμήματα και **πώς** διαβάζονται ζει στο {@link resolveTableToolbarExtrasState}
   * — ο ΕΝΑΣ κατασκευαστής για τις δύο υποδοχές (N.18· δες την κεφαλίδα του). Εδώ μένει μόνο
   * **ποιος** είναι ο στόχος, που είναι ακριβώς ό,τι διαφέρει ανάμεσά τους.
   */
  const toolbarState = useCallback(
    (hit: TableIndicatorHit): TableToolbarExtrasState =>
      resolveTableToolbarExtrasState(formatTarget(hit), fontNames()),
    [formatTarget, fontNames],
  );

  const props = useMemo<TableHeaderMenuProps>(
    () => ({
      onInsertBefore: (hit) => runAxisAction(axisTarget(hit), insertAt('before')),
      onInsertAfter: (hit) => runAxisAction(axisTarget(hit), insertAt('after')),
      onDelete: (hit) => runAxisAction(axisTarget(hit), deleteAxisTarget),
      // 🔴 ADR-739 §61 — «Μορφοποίηση κελιών…»: **ο ίδιος** `formatTarget` με τα εννιά
      // χειριστήρια της γραμμής, δηλαδή ο στόχος κουβαλά το `scope` του άξονα — χωρίς αυτό ο
      // διάλογος θα ισοπέδωνε μια μαρκαρισμένη στήλη σε κελιά. Χωρίς καρτέλα επίτηδες: το Excel
      // ανοίγει στην **τελευταία που είδε ο χρήστης** (δες την κεφαλίδα του store).
      onFormatCells: (hit) => openTableFormatCellsDialog({ target: formatTarget(hit) }),
      resolveState: (hit) => resolveHeaderState(liveTable()?.model ?? null, axisTarget(hit)),
      resolveFormat: (hit) => resolveTableFormatSnapshot(formatTarget(hit)),
      // 🔴 §52 — τα πέντε σώματα **μετακόμισαν** στο `table-format-commands.ts` τη στιγμή που
      // η κορδέλα και το μενού των κελιών ζήτησαν τα ίδια. Το σκεπτικό του καθενός (μεικτό ⇒
      // όλα ναι· ένα πεδίο, τρεις καταστάσεις· η ασυμμετρία του βήματος) ζει εκεί, δίπλα στον
      // κώδικα που το εκτελεί — εδώ μένει μόνο **ποιος** στόχος.
      onToggleFormat: (hit, key) => formatCommands.toggle(formatTarget(hit), key),
      onStepTextHeight: (hit, direction) => formatCommands.stepSize(formatTarget(hit), direction),
      onResetFormat: (hit) => formatCommands.reset(formatTarget(hit)),
      onSetTextColor: (hit, value) => formatCommands.setField(formatTarget(hit), 'textColorHex', value),
      onSetFillColor: (hit, value) => formatCommands.setField(formatTarget(hit), 'fillColorHex', value),
      // §55 — τα τρία νέα τμήματα: η κατάσταση από τη μία ερώτηση, η εγγραφή από τον **ίδιο**
      // γραφέα με τα δύο χρώματα από πάνω. Καμία δεύτερη διαδρομή, καμία δεύτερη ανάγνωση.
      resolveToolbar: toolbarState,
      onSetFormatField: (hit, key, value) => formatCommands.setField(formatTarget(hit), key, value),
      // 🔴 §58 Γ2 — δικός του γραφέας: το `overflow` δεν είναι `keyof TableAxisStyleOverride`.
      onSetOverflow: (hit, value) => formatCommands.setOverflow(formatTarget(hit), value),
      /**
       * ADR-750 Φ3/Φ5 — **όλο** το dropdown περιγραμμάτων σε μία απάντηση.
       *
       * ⚠️ Τα όρια ξαναρωτιούνται μέσα σε **κάθε** χειριστή και ποτέ δεν παγώνουν εδώ: ένα undo
       * που έσβησε τη γραμμή ενόσω το μενού ήταν ανοιχτό σημαίνει «καμία πράξη», ποτέ μαντεψιά
       * για το ποιον άξονα εννοούσε ο χρήστης. Οι δύο σημαίες (`canReset`) είναι στιγμιότυπα
       * **επίτηδες**: απαντιούνται στο άνοιγμα και μετά από κάθε πράξη, όχι σε κάθε απόδοση —
       * διατρέχουν τις ακμές της περιοχής.
       */
      resolveBorderMenu: (hit) => {
        const opened = axisBounds(hit);
        return {
          canReset: opened ? borderActions.canReset(opened) : false,
          canClearDiagonals: opened ? borderActions.canClearDiagonals(opened) : false,
          onApply: (id) => { const b = axisBounds(hit); if (b) borderActions.applyCommand(b, id); },
          onReset: () => { const b = axisBounds(hit); if (b) borderActions.resetBorders(b); },
          onApplyDiagonal: (id) => {
            const b = axisBounds(hit);
            if (b) borderActions.applyDiagonal(b, id);
          },
          resolvePencil: borderActions.resolvePencil,
          // ADR-750 Φ6 — τα όρια ξαναρωτιούνται **εδώ μέσα**, όπως κάθε άλλος χειριστής αυτού
          // του μπλοκ: αν το undo έσβησε τον άξονα, ο διάλογος δεν ανοίγει (αντί να ανοίξει
          // πάνω σε μοντέλο που δεν υπάρχει).
          moreBorders: {
            // 🔴 §60 — **ο ίδιος** στόχος με κάθε άλλη πράξη μορφοποίησης αυτού του μενού. Ήταν
            // `borderActions.resolveDialogTarget(axisBounds(hit))`, που έδινε {όρια, μοντέλο,
            // στυλ} και **έχανε το `scope`** — δηλαδή ο διάλογος, ανοιγμένος πάνω σε
            // μαρκαρισμένη στήλη, θα έγραφε στα κελιά της αντί στη στήλη.
            // 🔴 §61 — το `onCommit` **έφυγε**: έδειχνε στο `applyFormat` **αυτού** του hook, που
            // είναι μετρημένα η **ίδια** ουρά με το `TableFormatPort.commitModel`. Με έναν
            // ξενιστή υπάρχει ένας καλών, άρα η δεύτερη πόρτα δεν έχει πια λόγο ύπαρξης.
            resolveTarget: () => formatTarget(hit),
          },
        };
      },
      /**
       * ADR-755 — η **συγχώνευση ολόκληρου άξονα**. Ίδια σύμβαση με τα περιγράμματα: τα όρια
       * ξαναρωτιούνται μέσα στον χειριστή (undo μπορεί να έσβησε τη γραμμή), η κατάσταση είναι
       * στιγμιότυπο του ανοίγματος και ξαναρωτιέται μετά από κάθε πράξη.
       */
      resolveMergeMenu: (hit) => {
        const opened = axisBounds(hit);
        return {
          state: opened
            ? mergeActions.resolveState(opened)
            : { merged: false, canMerge: false },
          onApply: (id) => {
            const b = axisBounds(hit);
            if (b) void mergeActions.applyCommand(b, id);
          },
        };
      },
      // Το μενού έκλεισε — με ή χωρίς ενέργεια. Η εστίαση επιστρέφει στο κελί, αλλιώς η
      // συνεδρία μένει ζωντανή αλλά κουφή (δες την κεφαλίδα).
      onClosed: restartTableCellCursorSession,
    }),
    [
      runAxisAction, axisTarget, liveTable, formatCommands, formatTarget, axisBounds,
      borderActions, mergeActions, toolbarState, applyFormat,
    ],
  );

  return useMemo(() => ({ ref: menuRef, props }), [props]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Καθαροί βοηθοί
// ──────────────────────────────────────────────────────────────────────────────
//
// ⚠️ Η **κατάσταση των χειριστηρίων** μετακόμισε στο `table-header-format-snapshot.ts` και οι
// **δομικές πράξεις** (σχέδιο, σημαίες, ετικέτες, επιζών δρομέας) στο
// `table-header-axis-actions.ts`: κανένα από τα δύο δεν είναι hook (μηδέν `use*`, μηδέν store,
// μηδέν render) και το αρχείο είχε φτάσει τις 510/500 γραμμές. **Εξαγωγή, ποτέ trim** — δες
// τις κεφαλίδες εκείνων των modules.
