/**
 * **Οι ενέργειες του πλέγματος** πάνω σε ένα στιγμιότυπο — καθαρές, χωρίς React (ADR-923 §5.10.4 Β1).
 *
 * Κάθε συνάρτηση παίρνει *τι είναι τώρα* (γραμμές · στήλες · επιλογή · κατάσταση γραφής) και επιστρέφει *τι
 * γίνεται*: νέα κατάσταση ελέγχου και, αν άλλαξαν δεδομένα, **μία** αλλαγή για τον καταναλωτή. Το hook απλώς
 * εφαρμόζει — έτσι η σημασιολογία του Excel δοκιμάζεται χωρίς jsdom.
 *
 * @module components/ui/data-grid/data-grid-actions
 */

import { gridCursorAt, type GridMove, type GridSize } from '@/lib/spreadsheet/grid-navigation';
import type { GridEditMode } from '@/lib/spreadsheet/grid-key-intent';
import {
  clampSelection,
  collapsedSelection,
  extendSelection,
  moveSelection,
  rangeOfSelection,
  selectWholeGrid,
  type GridSelection,
} from '@/lib/spreadsheet/grid-selection';
import { clipboardGrid, planFillDown, planPaste } from '@/lib/spreadsheet/paste-plan';

import {
  applyCellTexts,
  cellTextOf,
  clearRange,
  isCellWritable,
  readOnlyProbe,
  toggleRange,
  type AppliedEdits,
  type EditContext,
} from './data-grid-edits';
import type { DataGridChange, DataGridColumn, DataGridEditKind } from './data-grid-types';

export interface GridControlState {
  readonly selection: GridSelection;
  readonly mode: GridEditMode;
  /** Ό,τι γράφεται στο ενεργό κελί (μόνο σε `enter` / `edit`). */
  readonly draft: string;
  /** Μήνυμα όταν το `draft` δεν ερμηνεύεται — το κελί **μένει** σε γραφή (Excel: «η τιμή δεν είναι έγκυρη»). */
  readonly draftIssue: string | null;
}

export interface GridSnapshot<Row> extends EditContext<Row> {
  readonly rows: readonly Row[];
  readonly state: GridControlState;
  readonly editable: boolean;
  readonly pageRows: number;
}

export interface GridOutcome<Row> {
  readonly state: GridControlState;
  readonly change: DataGridChange<Row> | null;
}

export const INITIAL_GRID_STATE: GridControlState = {
  selection: collapsedSelection({ row: 0, col: 0 }),
  mode: 'nav',
  draft: '',
  draftIssue: null,
};

/** Χωρίς δηλωμένο `maxRows`, το ταβάνι μιας επικόλλησης που προσθέτει γραμμές (μία λάθος επικόλληση δεν γεννά 1 εκατ.). */
export const DEFAULT_MAX_GRID_ROWS = 10_000;

export const sizeOf = <Row>(snap: GridSnapshot<Row>): GridSize => ({ rows: snap.rows.length, cols: snap.columns.length });

const navState = (selection: GridSelection): GridControlState => ({ selection, mode: 'nav', draft: '', draftIssue: null });

function changeOf<Row>(kind: DataGridEditKind, applied: AppliedEdits<Row>, report: DataGridChange<Row>['report'] = null): DataGridChange<Row> | null {
  if (!applied.changed && applied.rejected.length === 0 && report === null) return null;
  return { rows: applied.rows, kind, rejected: applied.rejected, report };
}

/** Το κελί του δρομέα είναι εγγράψιμο; */
export function cursorWritable<Row>(snap: GridSnapshot<Row>): boolean {
  const { cursor } = snap.state.selection;
  return snap.editable && isCellWritable(snap.columns[cursor.col], snap.rows[cursor.row]);
}

/** **Δέσμευση** του `draft` στο κελί του δρομέα. Απόρριψη ⇒ μένει σε γραφή με το μήνυμα. */
export function commitDraft<Row>(snap: GridSnapshot<Row>): GridOutcome<Row> & { readonly committed: boolean } {
  const { state } = snap;
  if (state.mode === 'nav') return { state, change: null, committed: true };
  const { cursor } = state.selection;
  const applied = applyCellTexts(snap.rows, [{ row: cursor.row, col: cursor.col, text: state.draft }], snap);
  const issue = applied.rejected[0]?.issue ?? null;
  if (issue !== null) return { state: { ...state, draftIssue: issue }, change: null, committed: false };
  return { state: navState(state.selection), change: changeOf('type', applied), committed: true };
}

/** Κίνηση (με δέσμευση πρώτα, αν γράφεις). Δέσμευση που απέτυχε ⇒ **καμία** κίνηση. */
export function moveCursor<Row>(snap: GridSnapshot<Row>, move: GridMove, isEmpty?: (cell: { row: number; col: number }) => boolean): GridOutcome<Row> {
  const committed = commitDraft(snap);
  if (!committed.committed) return committed;
  const rows = committed.change?.rows ?? snap.rows;
  const ctx = { size: { rows: rows.length, cols: snap.columns.length }, isEmpty, pageRows: snap.pageRows };
  return { state: navState(moveSelection(committed.state.selection, move, ctx)), change: committed.change };
}

export function extendCursor<Row>(snap: GridSnapshot<Row>, move: GridMove, isEmpty?: (cell: { row: number; col: number }) => boolean): GridOutcome<Row> {
  const ctx = { size: sizeOf(snap), isEmpty, pageRows: snap.pageRows };
  return { state: { ...snap.state, selection: extendSelection(snap.state.selection, move, ctx) }, change: null };
}

/** `F2` / διπλό κλικ / έναρξη γραφής: το `draft` ξεκινά από το κείμενο του κελιού (`edit`) ή από ό,τι γράφτηκε (`enter`). */
export function beginEditing<Row>(snap: GridSnapshot<Row>, mode: Exclude<GridEditMode, 'nav'>, typed?: string): GridControlState {
  if (!cursorWritable(snap)) return snap.state;
  const draft = typed ?? (snap.state.mode === 'nav' ? cellTextOf(snap.rows, snap.columns)(snap.state.selection.cursor) : snap.state.draft);
  return { ...snap.state, mode, draft, draftIssue: null };
}

export function selectAll<Row>(snap: GridSnapshot<Row>): GridOutcome<Row> {
  return { state: { ...snap.state, selection: selectWholeGrid(snap.state.selection, sizeOf(snap)) }, change: null };
}

export function clearSelection<Row>(snap: GridSnapshot<Row>, kind: DataGridEditKind = 'clear'): GridOutcome<Row> {
  if (!snap.editable) return { state: snap.state, change: null };
  const applied = clearRange(snap.rows, rangeOfSelection(snap.state.selection), snap);
  return { state: snap.state, change: changeOf(kind, applied) };
}

export function fillDown<Row>(snap: GridSnapshot<Row>): GridOutcome<Row> {
  if (!snap.editable) return { state: snap.state, change: null };
  const range = rangeOfSelection(snap.state.selection);
  const plan = planFillDown(range, cellTextOf(snap.rows, snap.columns), readOnlyProbe(snap.rows, snap.columns));
  return { state: snap.state, change: changeOf('fill', applyCellTexts(snap.rows, plan.cells, snap), plan.report) };
}

export function toggleSelection<Row>(snap: GridSnapshot<Row>): GridOutcome<Row> {
  if (!snap.editable) return { state: snap.state, change: null };
  const applied = toggleRange(snap.rows, rangeOfSelection(snap.state.selection), snap.columns);
  return { state: snap.state, change: changeOf('toggle', applied) };
}

/** **Επικόλληση** από το πρόχειρο, πάνω στην επιλογή — η επιλογή γίνεται ό,τι γράφτηκε (Excel). */
export function pasteText<Row>(snap: GridSnapshot<Row>, text: string): GridOutcome<Row> {
  if (!snap.editable) return { state: snap.state, change: null };
  const appendable = snap.createRow ? Math.max((snap.maxRows ?? DEFAULT_MAX_GRID_ROWS) - snap.rows.length, 0) : 0;
  const plan = planPaste(clipboardGrid(text), rangeOfSelection(snap.state.selection), {
    size: sizeOf(snap),
    appendableRows: appendable,
    isReadOnly: readOnlyProbe(snap.rows, snap.columns),
  });
  const applied = applyCellTexts(snap.rows, plan.cells, { ...snap, maxRows: snap.maxRows ?? DEFAULT_MAX_GRID_ROWS });
  const selection = plan.range
    ? { cursor: gridCursorAt({ row: plan.range.top, col: plan.range.left }), anchor: { row: plan.range.top, col: plan.range.left }, focus: { row: plan.range.bottom, col: plan.range.right } }
    : snap.state.selection;
  return { state: navState(selection), change: changeOf('paste', applied, plan.report) };
}

/** Μετά από αλλαγή γραμμών από έξω (αποθήκευση, διαγραφή): η επιλογή μένει μέσα στο πλέγμα. */
export function reconcileState<Row>(snap: GridSnapshot<Row>): GridControlState {
  const selection = clampSelection(snap.state.selection, sizeOf(snap));
  return selection === snap.state.selection ? snap.state : { ...snap.state, selection };
}

/** Οι στήλες με τις οποίες γίνεται μια επιλογή (`Alt+↓`). */
export function choicesAt<Row>(snap: GridSnapshot<Row>): DataGridColumn<Row> | null {
  const { cursor } = snap.state.selection;
  const column = snap.columns[cursor.col];
  return column?.choices && cursorWritable(snap) ? column : null;
}
