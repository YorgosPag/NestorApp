/**
 * =============================================================================
 * ΠΟΥ ΠΑΕΙ Ο ΔΡΟΜΕΑΣ ΕΝΟΣ ΠΛΕΓΜΑΤΟΣ; — καθαρό μοντέλο, χωρίς DOM (ADR-923 §5.10.4 Β1)
 * =============================================================================
 *
 * Το γενικό ισοδύναμο του `moveTableCursor` του DXF (`bim/table/table-cell-navigation.ts`), σε **δείκτες**
 * αντί για ταυτότητες γραμμών/στηλών: το πλέγμα δεδομένων δεν έχει συγχωνεύσεις, άρα δεν χρειάζεται ευρετήριο.
 * Το λεξιλόγιο κινήσεων είναι το **ίδιο** (ονόματα πρόθεσης, όχι πλήκτρων) ώστε ο DXF να μπορεί να περάσει
 * εδώ (`.claude-rules/pending-ratchet-work.md`).
 *
 * | Κίνηση | Συμπεριφορά | Πρότυπο |
 * |---|---|---|
 * | `next` / `previous` | Tab: δεξιά/αριστερά με **αναδίπλωση** γραμμής, κρατά τη στήλη αγκύρωσης | Excel |
 * | `commitDown` / `commitUp` | Enter: κάτω/πάνω **και πίσω στη στήλη αγκύρωσης** | Excel |
 * | `edgeLeft` … `edgeDown` | Ctrl+βέλος: στην **άκρη των δεδομένων** (από γεμάτο ⇒ τελευταίο γεμάτο· από κενό ⇒ επόμενο γεμάτο· αλλιώς άκρη πλέγματος) | Excel (όχι «άκρη πλέγματος» — εκεί ήταν φθηνότερο, όχι σωστό) |
 *
 * @module lib/spreadsheet/grid-navigation
 * @see lib/spreadsheet/grid-selection — η επιλογή πάνω σε αυτές τις κινήσεις
 */

/** Ένα κελί σε δείκτες. */
export interface GridCell {
  readonly row: number;
  readonly col: number;
}

/** Οι διαστάσεις του πλέγματος. */
export interface GridSize {
  readonly rows: number;
  readonly cols: number;
}

/** Η θέση του δρομέα: κελί + η στήλη στην οποία επιστρέφει το `Enter`. */
export interface GridCursor extends GridCell {
  readonly anchorCol: number;
}

export type GridMove =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'next'
  | 'previous'
  | 'commitDown'
  | 'commitUp'
  | 'rowStart'
  | 'rowEnd'
  | 'gridStart'
  | 'gridEnd'
  | 'edgeLeft'
  | 'edgeRight'
  | 'edgeUp'
  | 'edgeDown'
  /** PageUp/PageDown — ένα «παράθυρο» γραμμών (το μέγεθος το δίνει ο καλών: ορατές γραμμές). */
  | 'pageUp'
  | 'pageDown';

/** «Είναι κενό αυτό το κελί;» — μόνο για τις κινήσεις `edge*`. */
export type GridEmptyProbe = (cell: GridCell) => boolean;

export interface GridMoveContext {
  readonly size: GridSize;
  readonly isEmpty?: GridEmptyProbe;
  /** Γραμμές ανά σελίδα (PageUp/PageDown). */
  readonly pageRows?: number;
}

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), Math.max(max, 0));

/** Τα βήματα μιας κατεύθυνσης ακμής. */
const EDGE_STEP: Readonly<Record<'edgeLeft' | 'edgeRight' | 'edgeUp' | 'edgeDown', GridCell>> = {
  edgeLeft: { row: 0, col: -1 },
  edgeRight: { row: 0, col: 1 },
  edgeUp: { row: -1, col: 0 },
  edgeDown: { row: 1, col: 0 },
};

function inside(cell: GridCell, size: GridSize): boolean {
  return cell.row >= 0 && cell.col >= 0 && cell.row < size.rows && cell.col < size.cols;
}

function stepOf(cell: GridCell, step: GridCell): GridCell {
  return { row: cell.row + step.row, col: cell.col + step.col };
}

/**
 * **Ctrl+βέλος του Excel.** Από γεμάτο κελί με γεμάτο γείτονα ⇒ το τελευταίο γεμάτο της σειράς· αλλιώς ⇒ το
 * επόμενο γεμάτο· αν δεν υπάρχει ⇒ η άκρη του πλέγματος. Χωρίς `isEmpty` = κάθε κελί γεμάτο ⇒ άκρη.
 */
export function edgeOf(from: GridCell, step: GridCell, size: GridSize, isEmpty: GridEmptyProbe = () => false): GridCell {
  const first = stepOf(from, step);
  if (!inside(first, size)) return from;
  let cursor = first;
  if (!isEmpty(from) && !isEmpty(first)) {
    while (inside(stepOf(cursor, step), size) && !isEmpty(stepOf(cursor, step))) cursor = stepOf(cursor, step);
    return cursor;
  }
  while (isEmpty(cursor) && inside(stepOf(cursor, step), size)) cursor = stepOf(cursor, step);
  return cursor;
}

function wrapNext(from: GridCell, size: GridSize, direction: 1 | -1): GridCell {
  const flat = from.row * size.cols + from.col + direction;
  const last = size.rows * size.cols - 1;
  if (flat < 0 || flat > last) return from;
  return { row: Math.floor(flat / size.cols), col: flat % size.cols };
}

function targetOf(from: GridCursor, move: GridMove, ctx: GridMoveContext): GridCell {
  const { size } = ctx;
  const lastRow = size.rows - 1;
  const lastCol = size.cols - 1;
  const page = Math.max(1, ctx.pageRows ?? 10);
  switch (move) {
    case 'left': return { row: from.row, col: clamp(from.col - 1, lastCol) };
    case 'right': return { row: from.row, col: clamp(from.col + 1, lastCol) };
    case 'up': return { row: clamp(from.row - 1, lastRow), col: from.col };
    case 'down': return { row: clamp(from.row + 1, lastRow), col: from.col };
    case 'next': return wrapNext(from, size, 1);
    case 'previous': return wrapNext(from, size, -1);
    case 'commitDown': return { row: clamp(from.row + 1, lastRow), col: from.anchorCol };
    case 'commitUp': return { row: clamp(from.row - 1, lastRow), col: from.anchorCol };
    case 'rowStart': return { row: from.row, col: 0 };
    case 'rowEnd': return { row: from.row, col: lastCol };
    case 'gridStart': return { row: 0, col: 0 };
    case 'gridEnd': return { row: lastRow, col: lastCol };
    case 'pageUp': return { row: clamp(from.row - page, lastRow), col: from.col };
    case 'pageDown': return { row: clamp(from.row + page, lastRow), col: from.col };
    default: return edgeOf(from, EDGE_STEP[move], size, ctx.isEmpty);
  }
}

function keepsAnchor(move: GridMove): boolean {
  return move === 'next' || move === 'previous' || move === 'commitDown' || move === 'commitUp';
}

/** Η νέα θέση του δρομέα — `null` όταν δεν κουνιέται (άκρη, κενό πλέγμα). */
export function moveGridCursor(from: GridCursor, move: GridMove, ctx: GridMoveContext): GridCursor | null {
  if (ctx.size.rows === 0 || ctx.size.cols === 0) return null;
  const target = targetOf(from, move, ctx);
  if (target.row === from.row && target.col === from.col) return null;
  return { ...target, anchorCol: keepsAnchor(move) ? from.anchorCol : target.col };
}

export function gridCursorAt(cell: GridCell): GridCursor {
  return { row: cell.row, col: cell.col, anchorCol: cell.col };
}

/** Το κελί μέσα στα όρια — μετά από αφαίρεση γραμμών ο δρομέας δεν μένει ποτέ στο κενό. */
export function clampGridCell(cell: GridCell, size: GridSize): GridCell {
  return { row: clamp(cell.row, size.rows - 1), col: clamp(cell.col, size.cols - 1) };
}
