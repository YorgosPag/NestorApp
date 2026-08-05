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
 * ({@link writePersistedCellStyles}). Οι διαγώνιοι δεν έχουν δικό τους χρώμα ή πάχος: παίρνουν το
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
} from '../../types/table';
import { tableRangeCellRefs, type TableCellRangeBounds } from './table-cell-range';
import { writePersistedCellStyles } from './table-cell-content';
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
export interface TableDiagonalCommand {
  readonly id: TableDiagonalCommandId;
  readonly down: boolean;
  readonly up: boolean;
}

/** Οι δύο διευθύνσεις, με τα ονόματα του OOXML. */
export type TableDiagonalDirection = 'down' | 'up';

/**
 * Οι δύο διευθύνσεις **ως δεδομένα**, στη σειρά του Excel (η ↘ πρώτη).
 *
 * Δημόσια επειδή τη ρωτά και ο διάλογος «Περισσότερα περιγράμματα» (Φ6), όπου οι διαγώνιοι
 * είναι **δύο ανεξάρτητες θέσεις** του widget και όχι τέσσερις εντολές. Μια δεύτερη
 * χειρόγραφη `['down', 'up']` εκεί θα ήταν το κλασικό σιωπηλό διπλότυπο: τα δύο μέρη θα
 * μπορούσαν να απαριθμήσουν με άλλη σειρά, και το widget θα ζωγράφιζε τις θέσεις ανάποδα από
 * το μενού χωρίς κανένα test να τα συγκρίνει.
 */
export const TABLE_DIAGONAL_DIRECTIONS: readonly TableDiagonalDirection[] = ['down', 'up'];

/**
 * Μια δέσμη αλλαγών διαγωνίων. **Τρεις** τιμές ανά διεύθυνση, ρητά διακριτές στον τύπο:
 *
 * ```
 *   TableBorderSpec  →  βάλε αυτή τη διαγώνιο με αυτό το μολύβι
 *   null             →  σβήσε την
 *   απόν πεδίο       →  μην την αγγίξεις (ό,τι ίσχυε, ισχύει)
 * ```
 *
 * Η **τρίτη** είναι ο λόγος ύπαρξης του τύπου: χωρίς αυτήν, ο διάλογος της Φ6 δεν θα μπορούσε
 * να ανάψει τη ↗ χωρίς να σβήσει τη ↘ που ο χρήστης είχε ήδη βάλει.
 */
export interface TableDiagonalPatch {
  readonly down?: TableBorderSpec | null;
  readonly up?: TableBorderSpec | null;
}

/**
 * 🔑 **Πού ακριβώς περνά μια διαγώνιος μέσα σε ένα ορθογώνιο** — η μία απάντηση.
 *
 * Τη ρωτούν **δύο** ανεξάρτητοι καλούντες: η διάταξη (με το ορθογώνιο του κελιού) και το
 * **εικονίδιο** του μενού (με το πλέγμα 2×2 του viewBox). Ίδιο σκεπτικό με τα εικονίδια
 * περιγράμματος: το εικονίδιο δεν **μιμείται** την εντολή, εκτελεί την **ίδια** συνάρτηση με
 * άλλα όρια — άρα «το εικονίδιο δείχνει ↘ και η εντολή ζωγραφίζει ↗» δεν είναι απίθανο,
 * είναι **μη εκφράσιμο**.
 *
 * ⚠️ Ο άξονας `y` δείχνει **προς τα κάτω** (σύμβαση `table-layout-types.ts` **και** viewBox
 * του SVG — τυχαία η ίδια, αλλά και οι δύο ισχύουν). Άρα η `up` (↗) **τελειώνει** στο
 * μικρότερο `y`. Γραμμένο μία φορά, εδώ, γιατί είναι ακριβώς το σημείο όπου μια εικασία δίνει
 * καθρεφτισμένο σχέδιο.
 */
export function tableDiagonalCorners(
  direction: TableDiagonalDirection,
  rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): { readonly a: { x: number; y: number }; readonly b: { x: number; y: number } } {
  const left = rect.x;
  const right = rect.x + rect.w;
  const top = rect.y;
  const bottom = rect.y + rect.h;
  return direction === 'down'
    ? { a: { x: left, y: top }, b: { x: right, y: bottom } }
    : { a: { x: left, y: bottom }, b: { x: right, y: top } };
}

/**
 * Οι τέσσερις εντολές, στη σειρά του μενού: πρώτα οι δύο μεμονωμένες (η ↘ πρώτη, όπως στο
 * Excel), μετά ο συνδυασμός, τελευταία η αφαίρεση — η **ίδια** δραματουργία με τις 13 του
 * πλέγματος, όπου το «Χωρίς περίγραμμα» δεν κάθεται ποτέ πρώτο.
 */
export const TABLE_DIAGONAL_COMMANDS: readonly TableDiagonalCommand[] = [
  { id: 'down', down: true, up: false },
  { id: 'up', down: false, up: true },
  { id: 'cross', down: true, up: true },
  { id: 'clear', down: false, up: false },
];

const COMMANDS_BY_ID: ReadonlyMap<TableDiagonalCommandId, TableDiagonalCommand> = new Map(
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

  // Κάθε εντολή ονομάζει **και τις δύο** διευθύνσεις (γι' αυτό υπάρχουν τέσσερις και όχι δύο),
  // οπότε η μετάφραση σε δέσμη είναι ολική: ό,τι δεν κρατά η εντολή, σβήνεται ρητά.
  return setTableRangeDiagonals(model, bounds, {
    down: command.down ? pencil : null,
    up: command.up ? pencil : null,
  });
}

/**
 * ADR-750 Φ6 — **μία διεύθυνση τη φορά**, για τον διάλογο «Περισσότερα περιγράμματα».
 *
 * Απόν πεδίο ⇒ «μην αγγίξεις αυτή τη διαγώνιο»· `null` ⇒ «σβήσε την»· μολύβι ⇒ «βάλ' την».
 *
 * ## Γιατί η δέσμη είναι η πρωτόγονη πράξη και οι τέσσερις εντολές παράγωγό της
 * Το μενού των Φ3/Φ5 λέει πάντα και για τις δύο («↘» σημαίνει *και* «όχι ↗»), ο διάλογος όμως
 * έχει **δύο ανεξάρτητους διακόπτες**: πατώντας ↗ δεν επιτρέπεται να χαθεί μια ↘ που ο χρήστης
 * είχε ήδη βάλει. Ένας δεύτερος γραφέας για την ανεξάρτητη περίπτωση θα ήταν sibling clone
 * (CHECK 3.28 / N.18) — και, χειρότερα, δύο απαντήσεις στο «πότε μένει κελί χωρίς πεδίο
 * `diagonal`». Εδώ η γενικότερη πράξη είναι η **μία**, και οι εντολές τη ζητούν ολικά.
 *
 * Οι εγγυήσεις του {@link writePersistedCellStyles} μένουν αυτούσιες: ένα πέρασμα, ντετερμινιστική
 * σειρά, και το **ίδιο** μοντέλο by-reference όταν καμία τιμή δεν αλλάζει.
 */
export function setTableRangeDiagonals(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  patch: TableDiagonalPatch,
): PersistedTableModel {
  if (patch.down === undefined && patch.up === undefined) return model;

  return writePersistedCellStyles(model, tableRangeCellRefs(model, bounds), {
    update: (existing) => {
      const next = patchDiagonals(existing.diagonal, patch);
      return sameDiagonals(existing.diagonal, next) ? null : withDiagonals(existing, next);
    },
    // Κελί που **δεν υπάρχει** δεν αποκτά εγγραφή για να μείνει χωρίς διαγώνιο: η απουσία
    // εγγραφής ΕΙΝΑΙ ήδη «καμία διαγώνιος». Χωρίς αυτό, το «Χωρίς διαγώνιες» πάνω σε καθαρή
    // περιοχή 500×8 θα γεννούσε 4.000 φαντάσματα και ένα βήμα undo για το τίποτα.
    create: () => {
      const next = patchDiagonals(undefined, patch);
      return next === undefined ? null : { kind: 'text', value: '', diagonal: next };
    },
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
  const inside = new Set(tableRangeCellRefs(model, bounds).map((ref) => `${ref.rowId} ${ref.colId}`));
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
 * Οι διαγώνιοι **μετά** τη δέσμη· `undefined` όταν δεν μένει καμία.
 *
 * Η αφαίρεση δίνει `undefined` και **όχι** `{}`: ένα κενό αντικείμενο θα επιβίωνε σε κάθε
 * `JSON.stringify`, δηλαδή ένας πίνακας που «καθαρίστηκε» θα διέφερε από έναν που δεν είχε
 * ποτέ διαγώνιο — diff, βήμα undo και αποθήκευση, για μηδενική οπτική διαφορά.
 */
function patchDiagonals(
  current: TableCellDiagonals | undefined,
  patch: TableDiagonalPatch,
): TableCellDiagonals | undefined {
  const down = pickDiagonal(current?.down, patch.down);
  const up = pickDiagonal(current?.up, patch.up);
  if (down === undefined && up === undefined) return undefined;
  return {
    ...(down !== undefined ? { down } : {}),
    ...(up !== undefined ? { up } : {}),
  };
}

/** Απόν σκέλος ⇒ ό,τι ίσχυε· `null` ⇒ τίποτα· μολύβι ⇒ το μολύβι. Τρεις είσοδοι, μία έξοδος. */
function pickDiagonal(
  current: TableBorderSpec | undefined,
  requested: TableBorderSpec | null | undefined,
): TableBorderSpec | undefined {
  if (requested === undefined) return current;
  return requested ?? undefined;
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
