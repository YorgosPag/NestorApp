'use client';
/**
 * **Τα συμβάντα του πλέγματος** — πληκτρολόγιο, πεδίο ενεργού κελιού, εγγενές πρόχειρο, δείκτης (ADR-923 §5.10.4 Β1).
 *
 * - Πληκτρολόγιο: `resolveGridKeyIntent` → **μία** καθαρή ενέργεια (`data-grid-actions`). Ό,τι είναι `passthrough`
 *   πηγαίνει στο πεδίο (IME, τόνοι, ελληνικά — ό,τι ξέρει ο browser).
 * - Πρόχειρο: **εγγενή** `copy`/`cut`/`paste` + `clipboardData` (το ίδιο απέδειξε ο DXF, `use-table-range-actions`):
 *   καμία άδεια, κανένα user-gesture, σωστό σε κάθε διάταξη, δωρεάν δεξί κλικ.
 * - Esc δύο σταδίων: `cancel` ⇒ `stopPropagation` + `claimEscape`· σε πλοήγηση το πλήκτρο **φεύγει** (κλείνει ο διάλογος).
 *
 * @module components/ui/data-grid/use-grid-handlers
 */

import { useCallback, useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type PointerEvent } from 'react';

import { claimEscape } from '@/lib/a11y/escape-layers';
import { gridClipboardScope, resolveGridKeyIntent, type GridKeyIntent } from '@/lib/spreadsheet/grid-key-intent';
import type { GridCell } from '@/lib/spreadsheet/grid-navigation';
import { collapsedSelection, extendSelectionTo, rangeOfSelection } from '@/lib/spreadsheet/grid-selection';
import { rangeToGrid } from '@/lib/spreadsheet/paste-plan';
import { formatTsv } from '@/lib/spreadsheet/tsv';

import {
  beginEditing,
  choicesAt,
  clearSelection,
  commitDraft,
  extendCursor,
  fillDown,
  moveCursor,
  pasteText,
  selectAll,
  toggleSelection,
  type GridOutcome,
  type GridSnapshot,
} from './data-grid-actions';
import { applyCellTexts, cellTextOf } from './data-grid-edits';
import type { DataGridProps } from './data-grid-types';
import type { DataGridController } from './use-data-grid';

/** Ποιο κελί είναι κενό — για το `Ctrl+βέλος` (άκρη δεδομένων). */
const emptyProbe = <Row,>(snap: GridSnapshot<Row>) => (cell: GridCell) => cellTextOf(snap.rows, snap.columns)(cell).trim() === '';

/** Πρόθεση → αποτέλεσμα. `null` ⇒ το πλήκτρο δεν είναι δικό μας (passthrough). */
function outcomeOf<Row>(intent: GridKeyIntent, snap: GridSnapshot<Row>): GridOutcome<Row> | null {
  switch (intent.kind) {
    case 'move': {
      const outcome = moveCursor(snap, intent.move, emptyProbe(snap));
      // Tab/Shift+Tab στην άκρη του πλέγματος, χωρίς τίποτα να δεσμευτεί ⇒ το πλήκτρο ΦΕΥΓΕΙ: η εστία βγαίνει
      // από το πλέγμα (APG — αλλιώς παγίδα πληκτρολογίου, WCAG 2.1.2).
      const exits = (intent.move === 'next' || intent.move === 'previous') && outcome.change === null
        && outcome.state.selection === snap.state.selection && snap.state.mode === 'nav';
      return exits ? null : outcome;
    }
    case 'extend': return extendCursor(snap, intent.move, emptyProbe(snap));
    case 'mode': return { state: intent.to === 'nav' ? snap.state : beginEditing(snap, intent.to), change: null };
    case 'cancel': return { state: { ...snap.state, mode: 'nav', draft: '', draftIssue: null }, change: null };
    case 'clear': return clearSelection(snap);
    case 'selectAll': return selectAll(snap);
    case 'fillDown': return fillDown(snap);
    case 'toggle': return snap.columns[snap.state.selection.cursor.col]?.toggle ? toggleSelection(snap) : null;
    case 'suppress': return { state: snap.state, change: null };
    default: return null;
  }
}

export interface GridHandlers {
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onCopy: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onCut: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onCellPointerDown: (cell: GridCell, event: PointerEvent<HTMLElement>) => void;
  readonly onCellPointerEnter: (cell: GridCell) => void;
  readonly onPointerUp: () => void;
  readonly onCellDoubleClick: (cell: GridCell) => void;
  readonly choose: (text: string) => void;
}

function useKeyboard<Row>(grid: DataGridController<Row>, props: DataGridProps<Row>) {
  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.nativeEvent.isComposing) return;
    const snap = grid.snapshot();
    const intent = resolveGridKeyIntent(event.key, event, snap.state.mode);
    if (intent.kind === 'history') {
      event.preventDefault();
      (intent.direction === 'undo' ? props.onUndo : props.onRedo)?.();
      return;
    }
    if (intent.kind === 'openChoices') {
      if (choicesAt(snap)) { event.preventDefault(); grid.setChoicesOpen(true); }
      return;
    }
    if (intent.kind === 'move' && intent.move === 'commitDown' && snap.state.mode === 'nav' && props.onActivateRow && !snap.editable) {
      event.preventDefault();
      const row = snap.rows[snap.state.selection.cursor.row];
      if (row !== undefined) props.onActivateRow(row, snap.state.selection.cursor.row);
      return;
    }
    const outcome = outcomeOf(intent, snap);
    if (!outcome) return;
    event.preventDefault();
    if (intent.kind === 'cancel') { event.stopPropagation(); claimEscape(event.nativeEvent, 'ui/data-grid'); }
    grid.apply(outcome);
  }, [grid, props]);
}

function useClipboard<Row>(grid: DataGridController<Row>) {
  const copyRange = useCallback((event: ClipboardEvent<HTMLElement>): boolean => {
    const snap = grid.snapshot();
    if (gridClipboardScope(snap.state.mode) !== 'range' || snap.rows.length === 0) return false;
    event.preventDefault();
    event.clipboardData.setData('text/plain', formatTsv(rangeToGrid(rangeOfSelection(snap.state.selection), cellTextOf(snap.rows, snap.columns))));
    return true;
  }, [grid]);
  const onCopy = useCallback((event: ClipboardEvent<HTMLElement>) => { copyRange(event); }, [copyRange]);
  const onCut = useCallback((event: ClipboardEvent<HTMLElement>) => {
    if (copyRange(event)) grid.apply(clearSelection(grid.snapshot(), 'cut'));
  }, [copyRange, grid]);
  const onPaste = useCallback((event: ClipboardEvent<HTMLElement>) => {
    const snap = grid.snapshot();
    if (gridClipboardScope(snap.state.mode) !== 'range') return;
    event.preventDefault();
    grid.apply(pasteText(snap, event.clipboardData.getData('text/plain')));
  }, [grid]);
  return { onCopy, onCut, onPaste };
}

function usePointer<Row>(grid: DataGridController<Row>) {
  const dragging = useRef(false);
  const onCellPointerDown = useCallback((cell: GridCell, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const snap = grid.snapshot();
    const committed = commitDraft(snap);
    if (!committed.committed) return;
    grid.hasFocus.current = true;
    const selection = event.shiftKey ? extendSelectionTo(committed.state.selection, cell) : collapsedSelection(cell);
    grid.apply({ state: { ...committed.state, selection }, change: committed.change });
    dragging.current = true;
  }, [grid]);
  const onCellPointerEnter = useCallback((cell: GridCell) => {
    if (!dragging.current) return;
    const snap = grid.snapshot();
    grid.setState({ ...snap.state, selection: extendSelectionTo(snap.state.selection, cell) });
  }, [grid]);
  const onPointerUp = useCallback(() => { dragging.current = false; }, []);
  const onCellDoubleClick = useCallback((cell: GridCell) => {
    const snap = grid.snapshot();
    if (snap.editable) grid.setState(beginEditing({ ...snap, state: { ...snap.state, selection: collapsedSelection(cell) } }, 'edit'));
    else if (snap.rows[cell.row] !== undefined) grid.hasFocus.current = true;
  }, [grid]);
  return { onCellPointerDown, onCellPointerEnter, onPointerUp, onCellDoubleClick };
}

export function useGridHandlers<Row>(grid: DataGridController<Row>, props: DataGridProps<Row>): GridHandlers {
  const onKeyDown = useKeyboard(grid, props);
  const clipboard = useClipboard(grid);
  const pointer = usePointer(grid);
  const onInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const snap = grid.snapshot();
    const typed = event.target.value;
    if (snap.state.mode === 'nav') grid.setState(beginEditing(snap, 'enter', typed));
    else grid.setState({ ...snap.state, draft: typed, draftIssue: null });
  }, [grid]);
  const choose = useCallback((text: string) => {
    const snap = grid.snapshot();
    const { cursor } = snap.state.selection;
    const applied = applyCellTexts(snap.rows, [{ row: cursor.row, col: cursor.col, text }], snap);
    grid.setChoicesOpen(false);
    grid.apply({ state: { ...snap.state, mode: 'nav', draft: '', draftIssue: applied.rejected[0]?.issue ?? null },
      change: applied.changed ? { rows: applied.rows, kind: 'choose', rejected: applied.rejected, report: null } : null });
  }, [grid]);
  return { onKeyDown, onInputChange, ...clipboard, ...pointer, choose };
}
