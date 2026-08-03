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
 * @see bim/table/table-row-column-ops.ts — ΤΙ κάνει η κάθε εντολή (καθαρό)
 */

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { columnLetter } from '@/lib/spreadsheet/column-letter';
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
import {
  canDeleteTableColumn,
  canDeleteTableRow,
  canInsertTableColumn,
  canInsertTableRow,
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
} from '../../bim/table/table-row-column-ops';
import {
  clearAxisStyleOverride,
  nextBooleanFormat,
  resolveAxisFormat,
  setAxisStyleField,
} from '../../bim/table/table-axis-style-ops';
import {
  resolveAxisFormatSnapshot,
  type FormatTarget,
} from './table-header-format-snapshot';
import { getAllLayers } from '../../stores/LayerStore';
import { stepAxisTextHeight } from '../../bim/table/table-text-height-scale';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  resolveTableSelectionBounds,
  wholeAxisSelection,
  type TableCellRangeBounds,
} from '../../bim/table/table-cell-range';
import { useTableBorderActions } from './use-table-border-actions';
import { tableCursorAt, type TableCursorPosition } from '../../bim/table/table-cell-navigation';
import {
  getTableCellCursor,
  restartTableCellCursorSession,
  setTableCellCursor,
} from '../../state/table-cell-cursor-store';
import { useLiveTable } from './use-live-table';
import {
  getTableHeaderMenuPort,
  setTableHeaderMenuPort,
  type TableHeaderMenuPort,
} from './table-header-menu-port';
import { useLiveTableMutation, useTableModelCommit } from './use-table-model-commit';
import { useCommandHistory } from '../../core/commands';
import type { PersistedTableModel } from '../../types/table';
import type { TableCellRef } from '../../bim/table/table-cell-range';
import type {
  TableHeaderContextMenuHandle,
  TableHeaderMenuProps,
} from '../components/TableHeaderContextMenu';
import type { TableHeaderMenuState } from '../components/TableHeaderMenuItems';
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

  // Η ΙΔΙΑ διαδρομή commit με το πρόχειρο· η οντότητα περνά ως όρισμα κλήσης, γιατί εδώ
  // διαβάζεται με getter τη στιγμή της ενέργειας.
  const commitModel = useTableModelCommit({ levelManager, execute });

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
   * Η μία διαδρομή κάθε ενέργειας: καθαρή πράξη πάνω στο **ζωντανό** μοντέλο, μία εντολή,
   * και μετά ο δρομέας τοποθετείται σε κελί που **υπάρχει**.
   *
   * Χωρίς την τελευταία κίνηση, μια διαγραφή θα άφηνε τον δρομέα πάνω σε σβησμένη γραμμή:
   * ο επεξεργαστής θα ξεμοντάριζε (`target` → `null`) και η συνεδρία θα γινόταν αδρανής —
   * ζωντανή στο store, κουφή στην οθόνη.
   */
  const apply = useCallback(
    (mutate: (model: PersistedTableModel) => PersistedTableModel, pick: SurvivorPick) => {
      const cursor = getTableCellCursor();
      const live = liveTable();
      if (!live || !cursor) return;
      const nextModel = mutate(live.model);
      if (nextModel === live.model) return;
      if (!commitModel(live, nextModel)) return;
      const position = survivingCursor(nextModel, cursor.position, pick);
      if (position) setTableCellCursor(live.id, position, 'nav');
    },
    [liveTable, commitModel],
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

  const borderActions = useTableBorderActions({ levelManager, liveTable });

  /**
   * ADR-750 Φ3 — τα **όρια** που αντιστοιχούν σε μια ζώνη δείκτη: ολόκληρη η στήλη ή γραμμή.
   *
   * 🔑 Περνά υποχρεωτικά από το {@link wholeAxisSelection}, που είναι **ο ΕΝΑΣ ορισμός** της
   * «ολόκληρης στήλης/γραμμής» (ADR-739 §27.16 Ε2). Ο πειρασμός εδώ είναι μια γραμμή αριθμητικής
   * (`firstRow: 0, lastRow: rows.length - 1`) — που θα ήταν **τέταρτος** ορισμός της ίδιας
   * έννοιας και θα έχανε σιωπηλά ό,τι μάθει κάποτε ο πρώτος.
   *
   * ⚠️ Το **resolved** μοντέλο και όχι το `live.model`: οι συναρτήσεις περιοχής δηλώνουν
   * `TableModel` (κελιά ως `Map`), ενώ η οντότητα κρατά `PersistedTableModel` (κελιά ως
   * ακολουθία). Το `resolveTableModel` είναι cached σε `WeakMap` πάνω στο ίδιο το persisted
   * αντικείμενο, άρα η μετατροπή κοστίζει μία αναζήτηση.
   */
  const axisBounds = useCallback(
    (hit: TableIndicatorHit): TableCellRangeBounds | null => {
      const live = liveTable();
      if (!live) return null;
      const model = resolveTableModel(live.model);
      const selection = wholeAxisSelection(model, hit);
      return selection ? resolveTableSelectionBounds(model, selection) : null;
    },
    [liveTable],
  );

  /** Ο άξονας + το στυλ + το μοντέλο, τη στιγμή της κλήσης· `null` χωρίς ζωντανό πίνακα. */
  const formatTarget = useCallback(
    (hit: TableIndicatorHit): FormatTarget | null => {
      const live = liveTable();
      if (!live) return null;
      return {
        model: live.model,
        style: resolveTableStyle(live),
        axis: hit.axis,
        id: hit.axis === 'row' ? hit.rowId : hit.colId,
        // ADR-739 Φ.Ε/Φ4 — τα χρώματα του σχεδίου διαβάζονται με **getter τη στιγμή του
        // συμβάντος** (ADR-040 κανόνας #2), ποτέ με συνδρομή: αυτό το hook καλείται μέσα από
        // τον `CanvasSection`, όπου κάθε συνδρομή γίνεται re-render του orchestrator.
        layerColors: getAllLayers().map((layer) => layer.color),
      };
    },
    [liveTable],
  );

  const props = useMemo<TableHeaderMenuProps>(
    () => ({
      onInsertBefore: (hit) =>
        hit.axis === 'row'
          ? apply((m) => insertTableRow(m, hit.index), { rowIndex: hit.index })
          : apply((m) => insertTableColumn(m, hit.index), { colIndex: hit.index }),
      onInsertAfter: (hit) =>
        hit.axis === 'row'
          ? apply((m) => insertTableRow(m, hit.index + 1), { rowIndex: hit.index + 1 })
          : apply((m) => insertTableColumn(m, hit.index + 1), { colIndex: hit.index + 1 }),
      onDelete: (hit) =>
        hit.axis === 'row'
          ? apply((m) => deleteTableRow(m, hit.rowId), { rowIndex: hit.index })
          : apply((m) => deleteTableColumn(m, hit.colId), { colIndex: hit.index }),
      resolveState: (hit) => resolveHeaderState(liveTable()?.model ?? null, hit),
      resolveFormat: (hit) => resolveAxisFormatSnapshot(formatTarget(hit)),
      onToggleFormat: (hit, key) => {
        const target = formatTarget(hit);
        if (!target) return;
        const { model, style, axis, id } = target;
        const next = nextBooleanFormat(resolveAxisFormat(model, style, axis, id, key));
        applyFormat((m) => setAxisStyleField(m, axis, id, key, next));
      },
      onStepTextHeight: (hit, direction) => {
        const target = formatTarget(hit);
        if (!target) return;
        applyFormat((m) => stepAxisTextHeight(m, target.style, target.axis, target.id, direction));
      },
      onResetFormat: (hit) => {
        const target = formatTarget(hit);
        if (!target) return;
        applyFormat((m) => clearAxisStyleOverride(m, target.axis, target.id));
      },
      // ADR-739 Φ.Ε/Φ4 + Φ4β — ρητό χρώμα, «Αυτόματο» και «Κανένα γέμισμα» είναι η **ίδια**
      // πράξη με άλλο όρισμα: `hex` γράφει, `undefined` αφαιρεί το πεδίο (κληρονομιά), `null`
      // γράφει «ρητά κανένα». Ξεχωριστές συναρτήσεις («clearTextColor», «setNoFill») θα ήταν
      // δεύτερος και τρίτος δρόμος για την ίδια εγγραφή — και κάποιος από αυτούς θα ξεχνούσε
      // κάποτε το no-op by-reference που κρατά καθαρό το ιστορικό αναιρέσεων.
      onSetTextColor: (hit, value) => {
        const target = formatTarget(hit);
        if (!target) return;
        applyFormat((m) => setAxisStyleField(m, target.axis, target.id, 'textColorHex', value));
      },
      onSetFillColor: (hit, value) => {
        const target = formatTarget(hit);
        if (!target) return;
        applyFormat((m) => setAxisStyleField(m, target.axis, target.id, 'fillColorHex', value));
      },
      // ADR-750 Φ3 — μπαγιάτικα όρια (undo που έσβησε τη γραμμή ενόσω ήταν ανοιχτό το μενού)
      // σημαίνουν «καμία πράξη», ποτέ μαντεψιά για το ποιον άξονα εννοούσε ο χρήστης.
      onApplyBorder: (hit, commandId) => {
        const bounds = axisBounds(hit);
        if (bounds) borderActions.applyCommand(bounds, commandId);
      },
      onResetBorders: (hit) => {
        const bounds = axisBounds(hit);
        if (bounds) borderActions.resetBorders(bounds);
      },
      resolveCanResetBorders: (hit) => {
        const bounds = axisBounds(hit);
        return bounds ? borderActions.canReset(bounds) : false;
      },
      // Το μενού έκλεισε — με ή χωρίς ενέργεια. Η εστίαση επιστρέφει στο κελί, αλλιώς η
      // συνεδρία μένει ζωντανή αλλά κουφή (δες την κεφαλίδα).
      onClosed: restartTableCellCursorSession,
    }),
    [apply, liveTable, applyFormat, formatTarget, axisBounds, borderActions],
  );

  return useMemo(() => ({ ref: menuRef, props }), [props]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Καθαροί βοηθοί
// ──────────────────────────────────────────────────────────────────────────────
//
// ⚠️ Η **κατάσταση των χειριστηρίων** μετακόμισε στο `table-header-format-snapshot.ts`: δεν
// είναι hook τίποτα από εκείνα (μηδέν `use*`, μηδέν store, μηδέν render) και το αρχείο είχε
// φτάσει τις 481/500 γραμμές. Εξαγωγή, ποτέ trim — δες την κεφαλίδα εκείνου του module.

/** Ποιον άξονα καρφώνει η πράξη· ο άλλος κληρονομείται από τον τρέχοντα δρομέα. */
interface SurvivorPick {
  readonly rowIndex?: number;
  readonly colIndex?: number;
}

/** Οι σημαίες + η ετικέτα, απαντημένες τη στιγμή που ανοίγει το μενού. */
export function resolveHeaderState(
  model: PersistedTableModel | null,
  hit: TableIndicatorHit,
): TableHeaderMenuState {
  const label = tableHeaderLabel(hit);
  if (!model) return { label, canInsert: false, canDelete: false };
  return hit.axis === 'row'
    ? { label, canInsert: canInsertTableRow(model), canDelete: canDeleteTableRow(model) }
    : { label, canInsert: canInsertTableColumn(model), canDelete: canDeleteTableColumn(model) };
}

/**
 * Το κελί όπου κάθεται ο δρομέας **μετά** την πράξη.
 *
 * Ο δείκτης κόβεται στα νέα όρια: διαγραφή της τελευταίας γραμμής αφήνει δείκτη εκτός
 * πλέγματος, και ο δρομέας πρέπει να πέσει στη νέα τελευταία — όπως σε κάθε φύλλο
 * υπολογισμού. Το `-1` του `findIndex` (η γραμμή του δρομέα ήταν αυτή που σβήστηκε) περνά
 * από το ίδιο κόψιμο και καταλήγει στην πρώτη.
 */
export function survivingCursor(
  model: PersistedTableModel,
  current: TableCellRef,
  pick: SurvivorPick,
): TableCursorPosition | null {
  if (model.rows.length === 0 || model.columns.length === 0) return null;
  const rowIndex = pick.rowIndex ?? model.rows.findIndex((row) => row.id === current.rowId);
  const colIndex = pick.colIndex ?? model.columns.findIndex((col) => col.id === current.colId);
  const row = model.rows[clampIndex(rowIndex, model.rows.length)];
  const column = model.columns[clampIndex(colIndex, model.columns.length)];
  return tableCursorAt(row.id, column.id);
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}

/**
 * `A` / `B` για στήλη, `1` / `2` για γραμμή — **η ίδια ονομασία** που ζωγραφίζει η ζώνη
 * (`tableColumnTicks` / `tableRowTicks`), από το ίδιο SSoT γράμματος.
 */
export function tableHeaderLabel(hit: TableIndicatorHit): string {
  return hit.axis === 'column' ? columnLetter(hit.index) : String(hit.index + 1);
}
