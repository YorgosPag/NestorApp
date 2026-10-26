/**
 * **Από σχέδιο κελιών σε νέες γραμμές** — καθαρό, χωρίς React (ADR-923 §5.10.4 Β1).
 *
 * Το `paste-plan` λέει *ποιο κείμενο πάει σε ποιο κελί*· εδώ κάθε κείμενο περνά από το `parse` **της στήλης του**.
 * Απόρριψη ⇒ το κελί μένει ως ήταν και καταγράφεται (ποτέ σιωπηλά). Γραμμές πέρα από το τέλος γεννιούνται με
 * το `createRow` του καταναλωτή, ως το `maxRows`.
 *
 * @module components/ui/data-grid/data-grid-edits
 */

import type { GridCell } from '@/lib/spreadsheet/grid-navigation';
import { cellsOfRange, type GridRange } from '@/lib/spreadsheet/grid-selection';
import type { GridCellText } from '@/lib/spreadsheet/paste-plan';

import type { DataGridColumn, DataGridRejection } from './data-grid-types';

export interface AppliedEdits<Row> {
  readonly rows: readonly Row[];
  readonly rejected: readonly DataGridRejection[];
  /** `false` ⇒ καμία γραμμή δεν άλλαξε (ο καταναλωτής δεν γράφει ιστορικό). */
  readonly changed: boolean;
}

export interface EditContext<Row> {
  readonly columns: readonly DataGridColumn<Row>[];
  readonly createRow?: (index: number) => Row;
  readonly maxRows?: number;
}

/** Γράφεται αυτό το κελί; (στήλη με `parse`, χωρίς κλείδωμα για τη γραμμή). */
export function isCellWritable<Row>(column: DataGridColumn<Row> | undefined, row: Row | undefined): boolean {
  if (!column?.parse) return false;
  return row === undefined || !column.lock?.(row);
}

/** Ο ανιχνευτής «μόνο για ανάγνωση» του σχεδίου επικόλλησης. Γραμμή που δεν υπάρχει ακόμη = γράφεται. */
export function readOnlyProbe<Row>(rows: readonly Row[], columns: readonly DataGridColumn<Row>[]) {
  return (cell: GridCell): boolean => !isCellWritable(columns[cell.col], rows[cell.row]);
}

/** Το κείμενο ενός κελιού (αντιγραφή, `Ctrl+D`, κενό για `Ctrl+βέλος`). */
export function cellTextOf<Row>(rows: readonly Row[], columns: readonly DataGridColumn<Row>[]) {
  return (cell: GridCell): string => {
    const row = rows[cell.row];
    const column = columns[cell.col];
    return row !== undefined && column ? column.text(row) : '';
  };
}

function grownRows<Row>(rows: readonly Row[], cells: readonly GridCellText[], ctx: EditContext<Row>): Row[] {
  const next = [...rows];
  const wanted = cells.reduce((max, cell) => Math.max(max, cell.row + 1), rows.length);
  const ceiling = Math.min(wanted, ctx.maxRows ?? Number.POSITIVE_INFINITY);
  if (!ctx.createRow) return next;
  for (let index = rows.length; index < ceiling; index += 1) next.push(ctx.createRow(index));
  return next;
}

/** **Εφαρμογή** κειμένων ανά κελί μέσα από το `parse` κάθε στήλης. */
export function applyCellTexts<Row>(rows: readonly Row[], cells: readonly GridCellText[], ctx: EditContext<Row>): AppliedEdits<Row> {
  const next = grownRows(rows, cells, ctx);
  const rejected: DataGridRejection[] = [];
  let changed = next.length !== rows.length;
  for (const cell of cells) {
    const column = ctx.columns[cell.col];
    const row = next[cell.row];
    const parse = column?.parse;
    if (row === undefined || !column || !parse || !isCellWritable(column, row)) continue;
    const parsed = parse(cell.text, row);
    if (!parsed.ok) {
      rejected.push({ row: cell.row, columnId: column.id, text: cell.text, issue: parsed.issue });
      continue;
    }
    if (parsed.row !== row) {
      next[cell.row] = parsed.row;
      changed = true;
    }
  }
  return { rows: changed ? next : rows, rejected, changed };
}

/** `Delete`: κάθε εγγράψιμο κελί του εύρους παίρνει `''`. */
export function clearRange<Row>(rows: readonly Row[], range: GridRange, ctx: EditContext<Row>): AppliedEdits<Row> {
  const cells = cellsOfRange(range).map((cell) => ({ ...cell, text: '' }));
  return applyCellTexts(rows, cells, { ...ctx, createRow: undefined });
}

/** `Space` σε διακόπτη: εναλλάσσονται τα εγγράψιμα κελιά-διακόπτες του εύρους. */
export function toggleRange<Row>(rows: readonly Row[], range: GridRange, columns: readonly DataGridColumn<Row>[]): AppliedEdits<Row> {
  const next = [...rows];
  let changed = false;
  for (const cell of cellsOfRange(range)) {
    const column = columns[cell.col];
    const row = next[cell.row];
    if (!column?.toggle || row === undefined || !isCellWritable(column, row)) continue;
    next[cell.row] = column.toggle(row);
    changed = true;
  }
  return { rows: changed ? next : rows, rejected: [], changed };
}
