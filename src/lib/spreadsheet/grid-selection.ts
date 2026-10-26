/**
 * =============================================================================
 * ΤΙ ΕΙΝΑΙ ΕΠΙΛΕΓΜΕΝΟ ΣΕ ΕΝΑ ΠΛΕΓΜΑ; — καθαρό μοντέλο (ADR-923 §5.10.4 Β1)
 * =============================================================================
 *
 * Μία επιλογή = **δρομέας** (το ενεργό κελί, εκεί γράφει το πληκτρολόγιο) + **εύρος** από την **άγκυρα** ως την
 * **εστία**. Η άγκυρα είναι συνήθως ο δρομέας· χωρίζουν μόνο όταν το εύρος δεν ξεκινά από το ενεργό κελί
 * (`Ctrl+A`, κεφαλίδα στήλης: όλο το πλέγμα επιλεγμένο, το ενεργό κελί **μένει** εκεί που ήταν — Excel). Ίδια σημασιολογία με το `TableSelectionSpan` του DXF και του Excel: `Shift+βέλος` κουνά **μόνο**
 * την εστία· κάθε απλή κίνηση μαζεύει την επιλογή στον δρομέα. Το εύρος είναι πάντα **ορθογώνιο**
 * (κλειστά διαστήματα) — πολλαπλές περιοχές (`Ctrl+κλικ`) δεν υποστηρίζονται, επίτηδες: η επικόλληση και
 * το `Ctrl+D` του Excel επίσης τις απορρίπτουν.
 *
 * @module lib/spreadsheet/grid-selection
 */

import {
  clampGridCell,
  gridCursorAt,
  moveGridCursor,
  type GridCell,
  type GridCursor,
  type GridMove,
  type GridMoveContext,
  type GridSize,
} from './grid-navigation';

/** Ορθογώνιο εύρος, κλειστά διαστήματα. */
export interface GridRange {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
}

export interface GridSelection {
  readonly cursor: GridCursor;
  /** Η γωνία του εύρους που **δεν** κινείται με `Shift`. */
  readonly anchor: GridCell;
  readonly focus: GridCell;
}

const at = (cell: GridCell): GridCell => ({ row: cell.row, col: cell.col });
const same = (a: GridCell, b: GridCell): boolean => a.row === b.row && a.col === b.col;

export function collapsedSelection(cell: GridCell): GridSelection {
  return { cursor: gridCursorAt(cell), anchor: at(cell), focus: at(cell) };
}

export function rangeOfSelection(selection: GridSelection): GridRange {
  const { anchor, focus } = selection;
  return {
    top: Math.min(anchor.row, focus.row),
    left: Math.min(anchor.col, focus.col),
    bottom: Math.max(anchor.row, focus.row),
    right: Math.max(anchor.col, focus.col),
  };
}

export function rangeRows(range: GridRange): number {
  return range.bottom - range.top + 1;
}

export function rangeCols(range: GridRange): number {
  return range.right - range.left + 1;
}

export function isSingleCell(selection: GridSelection): boolean {
  return same(selection.anchor, selection.focus) && same(selection.anchor, selection.cursor);
}

export function rangeContains(range: GridRange, cell: GridCell): boolean {
  return cell.row >= range.top && cell.row <= range.bottom && cell.col >= range.left && cell.col <= range.right;
}

/** Κάθε κελί του εύρους, γραμμή-γραμμή. */
export function cellsOfRange(range: GridRange): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = range.top; row <= range.bottom; row += 1) {
    for (let col = range.left; col <= range.right; col += 1) cells.push({ row, col });
  }
  return cells;
}

/** Απλή κίνηση: ο δρομέας πάει, η επιλογή μαζεύεται πάνω του. Χωρίς κίνηση ⇒ η ίδια επιλογή (ταυτότητα). */
export function moveSelection(selection: GridSelection, move: GridMove, ctx: GridMoveContext): GridSelection {
  const cursor = moveGridCursor(selection.cursor, move, ctx);
  if (cursor) return { cursor, anchor: at(cursor), focus: at(cursor) };
  return isSingleCell(selection) ? selection : { cursor: selection.cursor, anchor: at(selection.cursor), focus: at(selection.cursor) };
}

/** `Shift+κίνηση`: κουνιέται μόνο η εστία· ο δρομέας μένει. */
export function extendSelection(selection: GridSelection, move: GridMove, ctx: GridMoveContext): GridSelection {
  const moved = moveGridCursor(gridCursorAt(selection.focus), move, ctx);
  if (!moved) return selection;
  return { cursor: selection.cursor, anchor: selection.anchor, focus: at(moved) };
}

/** `Shift+κλικ` / σύρσιμο: η εστία πάει στο κελί. */
export function extendSelectionTo(selection: GridSelection, cell: GridCell): GridSelection {
  if (same(selection.focus, cell)) return selection;
  return { cursor: selection.cursor, anchor: selection.anchor, focus: at(cell) };
}

export function selectWholeGrid(selection: GridSelection, size: GridSize): GridSelection {
  if (size.rows === 0 || size.cols === 0) return selection;
  return { cursor: selection.cursor, anchor: { row: 0, col: 0 }, focus: { row: size.rows - 1, col: size.cols - 1 } };
}

/** Κλικ στην κεφαλίδα στήλης: όλη η στήλη, δρομέας στην πρώτη γραμμή. */
export function selectColumn(col: number, size: GridSize): GridSelection {
  return { cursor: gridCursorAt({ row: 0, col }), anchor: { row: 0, col }, focus: { row: Math.max(size.rows - 1, 0), col } };
}

/** Μετά από αλλαγή διαστάσεων (γραμμές που έφυγαν): η επιλογή μένει μέσα στο πλέγμα. */
export function clampSelection(selection: GridSelection, size: GridSize): GridSelection {
  if (size.rows === 0 || size.cols === 0) return selection;
  const cursor = clampGridCell(selection.cursor, size);
  const anchor = clampGridCell(selection.anchor, size);
  const focus = clampGridCell(selection.focus, size);
  if (same(cursor, selection.cursor) && same(anchor, selection.anchor) && same(focus, selection.focus)) return selection;
  return { cursor: { ...cursor, anchorCol: Math.min(selection.cursor.anchorCol, size.cols - 1) }, anchor, focus };
}
