/**
 * ADR-750 Φ5 (Α2) — **οι διαγώνιες γραμμές κελιού ως καθαρές πράξεις**.
 *
 * Καθαρές συναρτήσεις: μηδέν React, μηδέν canvas, μηδέν i18n. Αδελφό αρχείο του
 * `table-range-border-ops.ts`, **ποτέ επέκτασή του** — και ο λόγος είναι κατηγορικός, όχι
 * οργανωτικός (ADR-750 §6.3):
 *
 * ```
 *   ακμή πλέγματος  →  μοιράζεται με τον γείτονα  →  ζει σε χάρτη ακμών, με ταυτότητα
 *   διαγώνιος       →  ανήκει σε ΕΝΑ κελί, πάντα  →  ζει στο κελί, χωρίς ταυτότητα
 * ```
 *
 * Στο ίδιο μητρώο, η διαγώνιος θα δανειζόταν σημασιολογία διαμοιρασμού που δεν έχει: το
 * `TableBorderCommandPart` μιλά για **πλευρές** (`keyof TableBorders`), και μια διαγώνιος δεν
 * είναι πλευρά καμιάς. Θα χρειαζόταν ένα ψεύτικο έβδομο «side» που κανένα από τα υπόλοιπα
 * σκέλη του μητρώου δεν θα μπορούσε να χειριστεί — δηλαδή μια εξαίρεση σε κάθε `switch`.
 *
 * ## Τι ΜΟΙΡΑΖΕΤΑΙ όμως, και σκόπιμα
 * Το **μολύβι** ({@link resolveTableBorderPencil}, Α20/Α23) και ο **μαζικός γραφέας κελιών**
 * ({@link writePersistedCells}). Οι διαγώνιοι δεν έχουν δικό τους χρώμα ή πάχος: παίρνουν το
 * ίδιο μολύβι με τα περιγράμματα, γιατί ο χρήστης έχει **ένα** μολύβι στο χέρι.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-diagonal-ops
 * @see bim/table/table-range-border-ops.ts — ο αδελφός για τις ακμές πλέγματος
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §6.3 · §19
 */

import type { TableBorderSpec } from '../../types/table-edges';
import type {
  PersistedTableModel,
  TableCell,
  TableCellDiagonals,
  TableColumnId,
  TableRowId,
} from '../../types/table';
import type { TableCellRangeBounds } from './table-cell-range';
import { writePersistedCells } from './table-cell-content';
import { sameBorderSpec } from './table-edge-model';

// ──────────────────────────────────────────────────────────────────────────────
// Το μητρώο
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι ταυτότητες των τεσσάρων. Αγγλικές και σταθερές: είναι **κλειδιά**, όχι ετικέτες.
 *
 * Τέσσερις και όχι δύο διακόπτες: το πάνελ των Φ3/Φ4 είναι `role="menu"` με **εντολές** (Α21),
 * όχι πλέγμα καταστάσεων. Το Excel εκθέτει δύο κουμπιά εναλλαγής επειδή ζει σε modal διάλογο
 * με «ΟΚ»· εδώ κάθε πάτημα **εκτελείται αμέσως**, οπότε το «και τα δύο» και το «κανένα»
 * πρέπει να είναι δικές τους εντολές — αλλιώς ο διαγώνιος σταυρός θα απαιτούσε δύο ανοίγματα
 * μενού και η αφαίρεση θα ήταν αόρατη.
 */
export type TableDiagonalCommandId = 'down' | 'up' | 'cross' | 'clear';

/** Ποιες διαγώνιοι μένουν μετά την εντολή· `clear` σβήνει και τις δύο. */
interface DiagonalCommand {
  readonly id: TableDiagonalCommandId;
  readonly down: boolean;
  readonly up: boolean;
}

/**
 * Οι τέσσερις εντολές, στη σειρά του μενού: πρώτα οι δύο μεμονωμένες (η ↘ πρώτη, όπως στο
 * Excel), μετά ο συνδυασμός, τελευταία η αφαίρεση — η **ίδια** δραματουργία με τις 13 του
 * πλέγματος, όπου το «Χωρίς περίγραμμα» δεν κάθεται ποτέ πρώτο.
 */
export const TABLE_DIAGONAL_COMMANDS: readonly DiagonalCommand[] = [
  { id: 'down', down: true, up: false },
  { id: 'up', down: false, up: true },
  { id: 'cross', down: true, up: true },
  { id: 'clear', down: false, up: false },
];

const COMMANDS_BY_ID: ReadonlyMap<TableDiagonalCommandId, DiagonalCommand> = new Map(
  TABLE_DIAGONAL_COMMANDS.map((command) => [command.id, command]),
);

// ──────────────────────────────────────────────────────────────────────────────
// Οι πράξεις
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Εφαρμόζει μία από τις τέσσερις σε **κάθε** κελί της περιοχής.
 *
 * ## Γιατί γράφονται και τα καλυμμένα κελιά μιας συγχώνευσης
 * Ίδια απάντηση με την **Α16** για τις ακμές: γράφονται όλα, και η **δομή** αποφασίζει τι
 * φαίνεται — η διάταξη εκπέμπει διαγώνιο μόνο για τα **ορατά** κελιά, δηλαδή για τις άγκυρες.
 * Έτσι, όταν λυθεί η συγχώνευση, εμφανίζεται ό,τι ζήτησε ο χρήστης, αντί να έχει χαθεί σιωπηλά.
 *
 * Επιστρέφει το **ίδιο** μοντέλο by-reference όταν καμία τιμή δεν αλλάζει — «ίδια διαγώνιος
 * δεύτερη φορά ⇒ κανένα βήμα undo», η τέταρτη εγγύηση του γραφέα κελιών.
 */
export function applyTableDiagonalCommand(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  commandId: TableDiagonalCommandId,
  pencil: TableBorderSpec,
): PersistedTableModel {
  const command = COMMANDS_BY_ID.get(commandId);
  if (!command) return model;

  const next = buildDiagonals(command, pencil);
  return writePersistedCells(model, cellsInBounds(model, bounds), {
    update: (existing) => (sameDiagonals(existing.diagonal, next) ? null : withDiagonals(existing, next)),
    // Κελί που **δεν υπάρχει** δεν αποκτά εγγραφή για να μείνει χωρίς διαγώνιο: η απουσία
    // εγγραφής ΕΙΝΑΙ ήδη «καμία διαγώνιος». Χωρίς αυτό, το «Χωρίς διαγώνιες» πάνω σε καθαρή
    // περιοχή 500×8 θα γεννούσε 4.000 φαντάσματα και ένα βήμα undo για το τίποτα.
    create: () => (next === undefined ? null : { kind: 'text', value: '', diagonal: next }),
  });
}

/**
 * Έχει η περιοχή **έστω μία** διαγώνιο; — δηλαδή έχει νόημα η «Χωρίς διαγώνιες»;
 *
 * Σταματά στην πρώτη που βρίσκει: για την ερώτηση «υπάρχει;» δεν χρειάζεται πλήρης διάσχιση.
 * Διατρέχει τα **αποθηκευμένα** κελιά και όχι την περιοχή, γιατί ο χάρτης είναι αραιός: σε
 * πίνακα 500×8 με 20 γεμάτα κελιά, η δεύτερη προσέγγιση θα ρωτούσε 4.000 φορές το τίποτα.
 */
export function hasTableRangeDiagonals(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): boolean {
  const inside = new Set(cellsInBounds(model, bounds).map((ref) => `${ref.rowId} ${ref.colId}`));
  if (inside.size === 0) return false;

  for (const [rowId, colId, cell] of model.cells) {
    if (cell.diagonal !== undefined && inside.has(`${rowId} ${colId}`)) return true;
  }
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τα κελιά της περιοχής, κουμπωμένα στα πραγματικά όρια του πίνακα.
 *
 * Μπαγιάτικα όρια (π.χ. μετά από undo που έσβησε γραμμές) **κόβονται** αντί να ρίξουν σφάλμα:
 * ο χρήστης δεν πρέπει να χάσει τον πίνακα επειδή η επιλογή του έδειχνε σε σβησμένη γραμμή —
 * η ίδια ανοχή με το `tableRangeSideEdges`.
 */
function cellsInBounds(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): readonly { readonly rowId: TableRowId; readonly colId: TableColumnId }[] {
  const out: { rowId: TableRowId; colId: TableColumnId }[] = [];
  const lastRow = Math.min(bounds.lastRow, model.rows.length - 1);
  const lastCol = Math.min(bounds.lastCol, model.columns.length - 1);
  for (let r = Math.max(bounds.firstRow, 0); r <= lastRow; r++) {
    for (let c = Math.max(bounds.firstCol, 0); c <= lastCol; c++) {
      out.push({ rowId: model.rows[r].id, colId: model.columns[c].id });
    }
  }
  return out;
}

/**
 * Το `TableCellDiagonals` της εντολής· `undefined` για την «Χωρίς διαγώνιες».
 *
 * Η αφαίρεση δίνει `undefined` και **όχι** `{}`: ένα κενό αντικείμενο θα επιβίωνε σε κάθε
 * `JSON.stringify`, δηλαδή ένας πίνακας που «καθαρίστηκε» θα διέφερε από έναν που δεν είχε
 * ποτέ διαγώνιο — diff, βήμα undo και αποθήκευση, για μηδενική οπτική διαφορά.
 */
function buildDiagonals(
  command: DiagonalCommand,
  pencil: TableBorderSpec,
): TableCellDiagonals | undefined {
  if (!command.down && !command.up) return undefined;
  return {
    ...(command.down ? { down: pencil } : {}),
    ...(command.up ? { up: pencil } : {}),
  };
}

/** Το κελί με τις νέες διαγωνίους — το πεδίο **αφαιρείται** όταν δεν υπάρχουν. */
function withDiagonals(cell: TableCell, diagonal: TableCellDiagonals | undefined): TableCell {
  if (diagonal === undefined) {
    const { diagonal: _dropped, ...rest } = cell;
    return rest;
  }
  return { ...cell, diagonal };
}

/**
 * Ίδιες διαγώνιοι; Ο έλεγχος περνά και από τα **δύο** μολύβια, γιατί μια εντολή μπορεί να
 * αλλάζει μόνο το μολύβι («ίδια ↘, αλλά τώρα κόκκινη») — και τότε πρέπει να γραφτεί.
 */
function sameDiagonals(
  a: TableCellDiagonals | undefined,
  b: TableCellDiagonals | undefined,
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return samePen(a.down, b.down) && samePen(a.up, b.up);
}

/**
 * «Ίδιο μολύβι;» **δανεισμένο**, με μόνη προσθήκη τη μία κατάσταση που η διαγώνιος έχει και η
 * ακμή όχι: την **απουσία** («αυτή η διαγώνιος δεν υπάρχει»).
 *
 * ⚠️ Δεύτερη σύγκριση πεδίο-προς-πεδίο εδώ θα ήταν sibling clone του {@link sameBorderSpec}
 * (CHECK 3.28, N.18) — και, χειρότερα, θα ξεχνούσε το επόμενο πεδίο που θα προστεθεί στο
 * μολύβι. Το `doubleGapMm` της Φ5 είναι ήδη το προηγούμενο: μπήκε στο `sameBorderSpec` και
 * ένα αντίγραφο εδώ θα το είχε χάσει σιωπηλά.
 */
function samePen(a: TableBorderSpec | undefined, b: TableBorderSpec | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return sameBorderSpec(a, b);
}
