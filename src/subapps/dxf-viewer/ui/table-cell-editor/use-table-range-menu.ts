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
import { columnLetter } from '@/lib/spreadsheet/column-letter';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  resolveTableSelectionBounds,
  type TableCellRangeBounds,
  type TableCellRef,
  type TableSelectionSpan,
} from '../../bim/table/table-cell-range';
import {
  tableEventWorldPoint,
  tablePointerHitAtWorld,
} from './table-cell-pointer-hit';
import {
  getTableCellCursor,
  restartTableCellCursorSession,
} from '../../state/table-cell-cursor-store';
import { useLiveTable } from './use-live-table';
import { useTableBorderActions } from './use-table-border-actions';
import {
  getTableRangeMenuPort,
  setTableRangeMenuPort,
  type TableRangeMenuPort,
} from './table-range-menu-port';
import type {
  TableRangeContextMenuHandle,
  TableRangeMenuProps,
  TableRangeMenuTarget,
} from '../components/TableRangeContextMenu';
import type { TableModel } from '../../types/table';
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
  const borderActions = useTableBorderActions({ levelManager, liveTable });

  /** Ο στόχος του δεξιού κλικ· `null` όταν δεν έπεσε σε κελί ζωντανού πίνακα. */
  const resolveTarget = useCallback(
    (clientX: number, clientY: number): TableRangeMenuTarget | null => {
      const live = liveTable();
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!live || !container || !transform) return null;

      const world = tableEventWorldPoint({ clientX, clientY }, container, transform);
      if (!world) return null;
      const hit = tablePointerHitAtWorld(live, world, transform.scale);
      // Ζώνη δείκτη και διαχωριστικό στηλών έχουν **δικούς τους** χειριστές σε προηγούμενη
      // προτεραιότητα· εδώ απαντάμε μόνο για κελιά.
      if (!hit || hit.where !== 'cell') return null;

      const model = resolveTableModel(live.model);
      const bounds = tableBorderTargetBounds(
        model,
        { rowId: hit.cell.rowId, colId: hit.cell.colId },
        getTableCellCursor()?.selection,
      );
      if (!bounds) return null;

      return {
        bounds,
        label: rangeLabel(bounds),
        canReset: borderActions.canReset(bounds),
        canClearDiagonals: borderActions.canClearDiagonals(bounds),
      };
    },
    [liveTable, containerRef, transformRef, borderActions],
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
      // Το μενού έκλεισε — η εστίαση επιστρέφει στο κελί, αλλιώς η συνεδρία μένει ζωντανή στο
      // store αλλά κουφή στην οθόνη (ίδια σύμβαση με το μενού των ζωνών).
      onClosed: restartTableCellCursorSession,
    }),
    [borderActions],
  );

  return useMemo(() => ({ ref: menuRef, props }), [props]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Καθαροί βοηθοί
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τα όρια που θα βαφτούν: η τρέχουσα επιλογή αν το κελί ανήκει σε αυτήν, αλλιώς το κελί μόνο
 * του. Και τα δύο περνούν από τον **ΕΝΑ** δρόμο ερμηνείας επιλογής (Α22, δες την κεφαλίδα).
 *
 * Η επιλογή περνά ως **όρισμα** και δεν διαβάζεται από το store εδώ μέσα: έτσι ο κανόνας Α22
 * είναι καθαρή συνάρτηση και ελέγχεται με τέσσερα σχήματα σε τέσσερις γραμμές, αντί να απαιτεί
 * στημένο store και προσποιητό δρομέα. Ο καλών κάνει την **μία** ανάγνωση, τη στιγμή του
 * συμβάντος (ADR-040 κανόνας #2).
 *
 * `null` όταν το κελί δεν υπάρχει στο μοντέλο — μπαγιάτικη αναφορά μετά από undo.
 */
export function tableBorderTargetBounds(
  model: TableModel,
  cell: TableCellRef,
  selection: TableSelectionSpan | null | undefined,
): TableCellRangeBounds | null {
  const cellBounds = resolveTableSelectionBounds(model, { from: cell, to: cell, kind: 'range' });
  if (!cellBounds) return null;

  const selected = selection ? resolveTableSelectionBounds(model, selection) : null;
  return selected && contains(selected, cellBounds) ? selected : cellBounds;
}

/** Περιέχει το `outer` ολόκληρο το `inner`; Σύγκριση ορθογωνίων σε δείκτες, τίποτα άλλο. */
function contains(outer: TableCellRangeBounds, inner: TableCellRangeBounds): boolean {
  return (
    outer.firstRow <= inner.firstRow
    && outer.lastRow >= inner.lastRow
    && outer.firstCol <= inner.firstCol
    && outer.lastCol >= inner.lastCol
  );
}

/**
 * `C3` για ένα κελί, `B2:D4` για περιοχή — **η γλώσσα του χρήστη** (Α5: δεν μαθαίνει ποτέ τη
 * λέξη «ακμή»). Το γράμμα βγαίνει από το ίδιο SSoT με τις ζώνες δείκτη (`columnLetter`), ώστε
 * ο τίτλος του μενού να λέει ακριβώς ό,τι δείχνει η λωρίδα από πάνω.
 */
export function rangeLabel(bounds: TableCellRangeBounds): string {
  const start = cellName(bounds.firstRow, bounds.firstCol);
  const end = cellName(bounds.lastRow, bounds.lastCol);
  return start === end ? start : `${start}:${end}`;
}

function cellName(rowIndex: number, colIndex: number): string {
  return `${columnLetter(colIndex)}${rowIndex + 1}`;
}
