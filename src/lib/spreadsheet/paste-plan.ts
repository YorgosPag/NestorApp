/**
 * =============================================================================
 * ΤΙ ΓΡΑΦΕΤΑΙ ΠΟΥ, ΟΤΑΝ ΕΠΙΚΟΛΛΑΣ Ή ΓΕΜΙΖΕΙΣ; — καθαρό σχέδιο εγγραφών (ADR-923 §5.10.4 Β1)
 * =============================================================================
 *
 * Παράγει **κείμενα ανά κελί**· την ερμηνεία τους (`parse` της στήλης) την κάνει ο καταναλωτής, ώστε η επικόλληση,
 * η πληκτρολόγηση και η εισαγωγή TSV να περνούν από **την ίδια** γραμματική. Ο αναλυτής είναι ο **υπάρχων**
 * `parseTsv` (RFC 4180 με tab, όπως το γράφει το Excel) — κανένας δεύτερος.
 *
 * ## Κανόνες επικόλλησης
 * | Τι αντιγράφηκε | Επιλογή | Αποτέλεσμα | Πρότυπο |
 * |---|---|---|---|
 * | μία τιμή | οποιαδήποτε | γεμίζει **όλη** την επιλογή | Excel · Sheets |
 * | μπλοκ R×C | πολλαπλάσιο του R×C | **πλακίδια** ως το τέλος της επιλογής | Excel |
 * | μπλοκ R×C | οτιδήποτε άλλο | από την πάνω-αριστερή γωνία· στήλες πέρα από το τέλος **κόβονται** | Sheets (το Excel αρνείται) |
 * | γραμμές πέρα από το τέλος | — | **νέες γραμμές** αν το δέχεται ο καταναλωτής (ως όριο), αλλιώς κόβονται | Glide · Airtable |
 *
 * Κελιά μόνο για ανάγνωση (κληρονομημένα) **παραλείπονται και μετρώνται** — ποτέ σιωπηλά. Η αναφορά λέει τι
 * προσφέρθηκε, τι χώρεσε, τι κόπηκε: ο άνθρωπος μαθαίνει **πάντα** αν κάτι δεν μπήκε.
 *
 * @module lib/spreadsheet/paste-plan
 * @see lib/spreadsheet/tsv — ο αναλυτής
 */

import type { GridCell, GridSize } from './grid-navigation';
import { rangeCols, rangeRows, type GridRange } from './grid-selection';
import { parseTsv, rectangularizeTsvGrid, type TsvGrid } from './tsv';

export interface GridCellText extends GridCell {
  readonly text: string;
}

export interface GridWriteReport {
  readonly offeredRows: number;
  readonly offeredCols: number;
  /** Νέες γραμμές που χρειάζεται η εγγραφή (επικόλληση πέρα από το τέλος). */
  readonly appendedRows: number;
  /** Γραμμές/στήλες του προχείρου που **δεν** χώρεσαν. */
  readonly clippedRows: number;
  readonly clippedCols: number;
  /** Κελιά που παραλείφθηκαν επειδή είναι μόνο για ανάγνωση. */
  readonly skippedReadOnly: number;
}

export interface GridWritePlan {
  readonly cells: readonly GridCellText[];
  /** Τα κελιά που αγγίζει η εγγραφή — ό,τι πρέπει να επιλεγεί μετά (Excel). */
  readonly range: GridRange | null;
  readonly report: GridWriteReport;
}

export interface GridWriteOptions {
  readonly size: GridSize;
  /** Πόσες γραμμές επιτρέπεται να προστεθούν (0 = καμία). */
  readonly appendableRows?: number;
  readonly isReadOnly?: (cell: GridCell) => boolean;
}

const EMPTY_REPORT: GridWriteReport = {
  offeredRows: 0, offeredCols: 0, appendedRows: 0, clippedRows: 0, clippedCols: 0, skippedReadOnly: 0,
};

/** Το πρόχειρο ως ορθογώνιο πλέγμα κειμένων (κενό ⇒ `[]`). */
export function clipboardGrid(text: string): TsvGrid {
  return rectangularizeTsvGrid(parseTsv(text));
}

interface Footprint {
  readonly rows: number;
  readonly cols: number;
  readonly tiled: boolean;
}

/** Πόσο χώρο πιάνει η επικόλληση (πριν από το κόψιμο στα όρια). */
function footprintOf(grid: TsvGrid, target: GridRange): Footprint {
  const blockRows = grid.length;
  const blockCols = grid[0]?.length ?? 0;
  const rows = rangeRows(target);
  const cols = rangeCols(target);
  const single = blockRows === 1 && blockCols === 1;
  const multiple = rows % blockRows === 0 && cols % blockCols === 0 && (rows > blockRows || cols > blockCols);
  if (single || multiple) return { rows, cols, tiled: true };
  return { rows: blockRows, cols: blockCols, tiled: false };
}

function writeCells(grid: TsvGrid, target: GridRange, fit: { rows: number; cols: number }, isReadOnly: (cell: GridCell) => boolean) {
  const cells: GridCellText[] = [];
  let skipped = 0;
  for (let r = 0; r < fit.rows; r += 1) {
    for (let c = 0; c < fit.cols; c += 1) {
      const cell = { row: target.top + r, col: target.left + c };
      if (isReadOnly(cell)) { skipped += 1; continue; }
      cells.push({ ...cell, text: grid[r % grid.length][c % grid[0].length] });
    }
  }
  return { cells, skipped };
}

/** **Το σχέδιο μιας επικόλλησης** πάνω στην επιλογή `target`. */
export function planPaste(grid: TsvGrid, target: GridRange, options: GridWriteOptions): GridWritePlan {
  if (grid.length === 0 || (grid[0]?.length ?? 0) === 0) return { cells: [], range: null, report: EMPTY_REPORT };
  const footprint = footprintOf(grid, target);
  const roomRows = options.size.rows - target.top + Math.max(options.appendableRows ?? 0, 0);
  const roomCols = options.size.cols - target.left;
  const fit = { rows: Math.min(footprint.rows, Math.max(roomRows, 0)), cols: Math.min(footprint.cols, Math.max(roomCols, 0)) };
  const { cells, skipped } = writeCells(grid, target, fit, options.isReadOnly ?? (() => false));
  const appendedRows = Math.max(target.top + fit.rows - options.size.rows, 0);
  const range = fit.rows > 0 && fit.cols > 0
    ? { top: target.top, left: target.left, bottom: target.top + fit.rows - 1, right: target.left + fit.cols - 1 }
    : null;
  const report: GridWriteReport = {
    offeredRows: grid.length,
    offeredCols: grid[0].length,
    appendedRows,
    clippedRows: footprint.tiled ? 0 : footprint.rows - fit.rows,
    clippedCols: footprint.tiled ? 0 : footprint.cols - fit.cols,
    skippedReadOnly: skipped,
  };
  return { cells, range, report };
}

/**
 * **`Ctrl+D`** (Excel): επιλογή μίας γραμμής ⇒ αντιγράφει τη γραμμή **από πάνω**· πολλών ⇒ την **πρώτη** της
 * επιλογής προς τις υπόλοιπες. Τα κείμενα πηγής τα δίνει ο καταναλωτής (`format` της στήλης — ό,τι θα αντέγραφε).
 */
export function planFillDown(
  target: GridRange,
  textAt: (cell: GridCell) => string,
  isReadOnly: (cell: GridCell) => boolean = () => false,
): GridWritePlan {
  const sourceRow = rangeRows(target) === 1 ? target.top - 1 : target.top;
  const firstTarget = rangeRows(target) === 1 ? target.top : target.top + 1;
  if (sourceRow < 0 || firstTarget > target.bottom) return { cells: [], range: null, report: EMPTY_REPORT };
  const cells: GridCellText[] = [];
  let skipped = 0;
  for (let row = firstTarget; row <= target.bottom; row += 1) {
    for (let col = target.left; col <= target.right; col += 1) {
      if (isReadOnly({ row, col })) { skipped += 1; continue; }
      cells.push({ row, col, text: textAt({ row: sourceRow, col }) });
    }
  }
  return {
    cells,
    range: target,
    report: { ...EMPTY_REPORT, offeredRows: 1, offeredCols: rangeCols(target), skippedReadOnly: skipped },
  };
}

/** Το εύρος ως πλέγμα κειμένων για αντιγραφή (`formatTsv` το κάνει πρόχειρο). */
export function rangeToGrid(range: GridRange, textAt: (cell: GridCell) => string): string[][] {
  const grid: string[][] = [];
  for (let row = range.top; row <= range.bottom; row += 1) {
    const line: string[] = [];
    for (let col = range.left; col <= range.right; col += 1) line.push(textAt({ row, col }));
    grid.push(line);
  }
  return grid;
}
