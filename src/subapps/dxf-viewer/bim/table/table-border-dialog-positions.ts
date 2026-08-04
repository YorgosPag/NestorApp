/**
 * ADR-750 Φ6 — **τι μπορεί να πατηθεί στο proxy preview, και τι δείχνει τώρα**.
 *
 * Το ερωτηματικό μισό του διαλόγου «Περισσότερα περιγράμματα»: καθαρές **αναγνώσεις**, μηδέν
 * μεταλλάξεις (εκείνες ζουν στο `table-border-dialog-draft.ts`). Μηδέν React, μηδέν i18n.
 *
 * ## Οι οκτώ θέσεις είναι ΜΙΑ λίστα, όχι δύο
 * Το widget του Excel έχει έξι ακμές πλέγματος **και** δύο διαγωνίους μέσα στο ίδιο κουτί, και
 * ο χρήστης δεν αντιλαμβάνεται καμία διαφορά: πατά, ανάβει, ξαναπατά, σβήνει. Το **μοντέλο**
 * όμως τις κρατά σε δύο εντελώς διαφορετικά μέρη (χάρτης ακμών έναντι πεδίου κελιού, §6.3).
 *
 * Άρα εδώ γεννιέται **ένα** λεξιλόγιο θέσης που καλύπτει και τα δύο — και **παράγεται** από
 * τα υπάρχοντα (`TableBorderSide` = `keyof TableBorders` · `TableDiagonalDirection`), ποτέ
 * ως τρίτη χειρόγραφη λίστα οκτώ ονομάτων. Την ημέρα που θα μετονομαστεί μία πλευρά, μιλά ο
 * μεταγλωττιστής· μια ανεξάρτητη ένωση θα έμενε πίσω σιωπηλά.
 *
 * ## Οι τρεις καταστάσεις — και γιατί η `mixed` δεν είναι πολυτέλεια
 * Σε επιλογή 3×3 όπου **μερικές** από τις εσωτερικές ακμές έχουν περίγραμμα, ένα widget με
 * δύο καταστάσεις (ανοιχτό/κλειστό) **λέει ψέματα**: όποια από τις δύο κι αν διαλέξει, ο
 * χρήστης βλέπει κάτι που δεν ισχύει, και το πρώτο του κλικ καταστρέφει πληροφορία που δεν
 * ήξερε ότι υπήρχε. Το Excel το λύνει ακριβώς έτσι (γκρίζα, «απροσδιόριστη» ακμή).
 *
 * @module subapps/dxf-viewer/bim/table/table-border-dialog-positions
 * @see bim/table/table-border-dialog-draft.ts — το μεταλλακτικό μισό
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §8.2 · §6.5 · §6.7
 */

import type { TableBorderSpec } from '../../types/table-edges';
import type { PersistedTableModel, TableCell } from '../../types/table';
import type { TableCellRangeBounds } from './table-cell-range';
import { tableRangeCellRefs } from './table-cell-range';
import { buildTableEdgeIndex, sameBorderSpec } from './table-edge-model';
import {
  TABLE_BORDER_EVERY_SIDE,
  tableBorderSideCrossings,
  tableRangeSideEdges,
  type TableBorderSide,
} from './table-range-border-ops';
import {
  TABLE_DIAGONAL_DIRECTIONS,
  type TableDiagonalDirection,
} from './table-cell-diagonal-ops';

// ──────────────────────────────────────────────────────────────────────────────
// Το λεξιλόγιο θέσης
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Το πρόθεμα των διαγωνίων. Χρειάζεται επειδή οι δύο οικογένειες ενώνονται σε **έναν** τύπο
 * και ένα γυμνό `'down'` δίπλα σε `'bottom'` θα ήταν αναγνώσιμο μόνο από όποιον έγραψε τη
 * λίστα. Δεν διαρρέει ποτέ σε χρήστη — είναι κλειδί, όχι ετικέτα (N.11).
 */
const DIAGONAL_POSITION_PREFIX = 'diagonal:';

/**
 * Η ταυτότητα μιας διαγωνίου ως θέση του widget — **παραγόμενη** από το
 * {@link TableDiagonalDirection} με template literal type. Μια χειρόγραφη
 * `'diagonalDown' | 'diagonalUp'` θα ήταν δεύτερη δήλωση των δύο διευθύνσεων.
 */
export type TableDiagonalPositionId = `${typeof DIAGONAL_POSITION_PREFIX}${TableDiagonalDirection}`;

/** Οι **οκτώ** θέσεις: οι έξι πλευρές του πλέγματος + οι δύο διαγώνιοι. */
export type TableBorderDialogPositionId = TableBorderSide | TableDiagonalPositionId;

/** Η ταυτότητα θέσης μιας διεύθυνσης — ο **μοναδικός** νόμιμος κατασκευαστής. */
export function tableDiagonalPositionId(
  direction: TableDiagonalDirection,
): TableDiagonalPositionId {
  return `${DIAGONAL_POSITION_PREFIX}${direction}`;
}

/**
 * Το αντίστροφο· `undefined` όταν η θέση είναι πλευρά πλέγματος. Η **ερώτηση διακλάδωσης**
 * κάθε πράξης: «σε ποιο από τα δύο μέρη του μοντέλου γράφω;»
 */
export function tableDiagonalDirectionOf(
  id: TableBorderDialogPositionId,
): TableDiagonalDirection | undefined {
  for (const direction of TABLE_DIAGONAL_DIRECTIONS) {
    if (tableDiagonalPositionId(direction) === id) return direction;
  }
  return undefined;
}

/** Είναι πλευρά πλέγματος; Ελέγχεται **στη λίστα των έξι**, όχι στη μορφή του κειμένου. */
export function isTableBorderSidePosition(
  id: TableBorderDialogPositionId,
): id is TableBorderSide {
  return TABLE_BORDER_EVERY_SIDE.some((side) => side === id);
}

/**
 * Οι οκτώ θέσεις **στη σειρά του widget**: πρώτα οι έξι πλευρές (όπως τις απαριθμεί ήδη το
 * μητρώο των εντολών), μετά οι δύο διαγώνιοι. Η σειρά ζει στα δεδομένα για τον ίδιο λόγο με
 * το `group` των 13: το component την **αποδίδει**, δεν την ξαναδηλώνει.
 */
export const TABLE_BORDER_DIALOG_POSITIONS: readonly TableBorderDialogPositionId[] = [
  ...TABLE_BORDER_EVERY_SIDE,
  ...TABLE_DIAGONAL_DIRECTIONS.map(tableDiagonalPositionId),
];

// ──────────────────────────────────────────────────────────────────────────────
// Διαθεσιμότητα
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Έχει νόημα αυτή η θέση για τα δεδομένα όρια;
 *
 * 🔴 **Δεν είναι διακόσμηση.** Σε **ένα** κελί δεν υπάρχει «εσωτερική οριζόντια»: δεν υπάρχει
 * τίποτα ανάμεσα. Το Excel γκριζάρει εκεί ακριβώς τα μεσαία κουμπιά και το υπόδειγμα
 * «Εσωτερικά». Ένα κουμπί που φαίνεται ενεργό και δεν κάνει τίποτα είναι **χειρότερο** από
 * κουμπί που λείπει (ίδιο σκεπτικό με την Α19/`hasExplicitTableRangeBorders`): ο χρήστης το
 * πατά, δεν αλλάζει τίποτα, και δεν μαθαίνει ποτέ γιατί.
 *
 * 🔑 **Παράγεται από τη γεωμετρία, δεν ξαναδηλώνεται.** Η απάντηση είναι «έχει η πλευρά έστω
 * μία θέση στον άξονα που διασχίζει;» — δηλαδή ακριβώς το {@link tableBorderSideCrossings},
 * που ήδη δίνει **κενό** για `insideH` σε μία γραμμή. Ένας χειρόγραφος κανόνας
 * (`rows >= 2`) θα ήταν δεύτερη απάντηση στο ίδιο ερώτημα, και θα μπορούσε κάποτε να
 * διαφωνήσει με το τι πράγματι γράφεται.
 *
 * Οι **διαγώνιοι** είναι πάντα διαθέσιμες: ανήκουν σε ένα κελί, και ένα κελί υπάρχει πάντα.
 */
export function isTableBorderDialogPositionAvailable(
  id: TableBorderDialogPositionId,
  bounds: TableCellRangeBounds,
): boolean {
  if (!isTableBorderSidePosition(id)) return true;
  return tableBorderSideCrossings(id, bounds).length > 0;
}

/** Οι θέσεις που έχουν νόημα τώρα — η λίστα που αποδίδει ενεργά χειριστήρια το widget. */
export function availableTableBorderDialogPositions(
  bounds: TableCellRangeBounds,
): readonly TableBorderDialogPositionId[] {
  return TABLE_BORDER_DIALOG_POSITIONS.filter((id) =>
    isTableBorderDialogPositionAvailable(id, bounds),
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Η τρέχουσα κατάσταση
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τι δείχνει **τώρα** μια θέση, διαβασμένο από το μοντέλο.
 *
 * ```
 *   absent   →  καμία ρητή γραμμή εδώ (ισχύει η κληρονομιά — επίπεδα 2–4 του §6.5)
 *   uniform  →  ΟΛΕΣ οι ακμές της θέσης έχουν το ΙΔΙΟ μολύβι — και ποιο
 *   mixed    →  διαφωνούν (άλλο μολύβι, ή μερικές ορισμένες και μερικές όχι)
 * ```
 *
 * ⚠️ Το `uniform` με **αόρατο** μολύβι ({@link HIDDEN_TABLE_EDGE}) είναι κανονική, ορατή
 * κατάσταση και **όχι** `absent`: είναι η Α14 («ρητά καμία γραμμή» ≠ «κληρονόμησε»). Το
 * widget οφείλει να τις ξεχωρίζει, αλλιώς ο χρήστης δεν έχει τρόπο να δει ποια από τις δύο
 * ισχύει — δηλαδή θα αναπαράγαμε το παράπονο Π3 μέσα στο ίδιο το εργαλείο που το λύνει.
 */
export type TableBorderDialogPositionState =
  | { readonly kind: 'absent' }
  | { readonly kind: 'uniform'; readonly spec: TableBorderSpec }
  | { readonly kind: 'mixed' };

const ABSENT_STATE: TableBorderDialogPositionState = { kind: 'absent' };
const MIXED_STATE: TableBorderDialogPositionState = { kind: 'mixed' };

/**
 * Η κατάσταση μιας θέσης. Θέση **μη διαθέσιμη** απαντά `absent` — δεν υπάρχει τίποτα να
 * διαβαστεί, και μια εξαίρεση θα ανάγκαζε κάθε καλούντα να ρωτήσει πρώτα τη διαθεσιμότητα.
 */
export function tableBorderDialogPositionState(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  id: TableBorderDialogPositionId,
): TableBorderDialogPositionState {
  return isTableBorderSidePosition(id)
    ? foldSpecs(sideSpecs(model, bounds, id))
    : foldSpecs(diagonalSpecs(model, bounds, id));
}

/**
 * Ολόκληρη η εικόνα του widget με **ένα** πέρασμα — διαθεσιμότητα + κατάσταση ανά θέση.
 *
 * Υπάρχει επειδή το component τις ρωτά **όλες** σε κάθε render: οκτώ ξεχωριστές κλήσεις θα
 * ξανάχτιζαν οκτώ φορές το ευρετήριο ακμών και τον χάρτη κελιών για την ίδια απάντηση.
 */
export function tableBorderDialogSnapshot(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): ReadonlyMap<TableBorderDialogPositionId, TableBorderDialogPositionSlot> {
  const slots = new Map<TableBorderDialogPositionId, TableBorderDialogPositionSlot>();
  for (const id of TABLE_BORDER_DIALOG_POSITIONS) {
    slots.set(id, {
      available: isTableBorderDialogPositionAvailable(id, bounds),
      state: tableBorderDialogPositionState(model, bounds, id),
    });
  }
  return slots;
}

/** Μία θέση, όπως τη βλέπει το widget. */
export interface TableBorderDialogPositionSlot {
  readonly available: boolean;
  readonly state: TableBorderDialogPositionState;
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — η ανάγνωση
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τα μολύβια των ακμών μιας πλευράς, με `undefined` όπου **δεν** υπάρχει ρητή εγγραφή.
 *
 * Η γεωμετρία έρχεται από το {@link tableRangeSideEdges} — τη συνάρτηση που το ίδιο το
 * `table-range-border-ops.ts` τεκμηριώνει ως «η ερώτηση που κάνει το proxy preview της Φ6».
 * Δεύτερη διάσχιση εδώ θα ήταν ακριβώς η σιωπηλή απόκλιση που εκείνο το σχόλιο προλαβαίνει.
 */
function sideSpecs(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  side: TableBorderSide,
): readonly (TableBorderSpec | undefined)[] {
  const index = buildTableEdgeIndex(model.edges);
  return tableRangeSideEdges(model, bounds, side).map((key) => index.get(key));
}

/**
 * Τα μολύβια μιας διαγωνίου σε **κάθε** κελί της περιοχής — και `undefined` για όσα δεν την
 * έχουν, **συμπεριλαμβανομένων** των κελιών που δεν υπάρχουν καν στον αραιό χάρτη.
 *
 * ⚠️ Το τελευταίο είναι η ουσία: «τρία από τα εννέα κελιά έχουν ↘» πρέπει να απαντήσει
 * `mixed`. Μια διάσχιση **μόνο** του `cells` (όπως κάνει σωστά το `hasTableRangeDiagonals`,
 * που ρωτά «υπάρχει έστω μία;») θα έβλεπε τρία ίδια μολύβια και θα έλεγε `uniform` — δηλαδή
 * το widget θα δήλωνε ολόκληρη την επιλογή διαγωνισμένη ενώ τα έξι κελιά είναι καθαρά.
 */
function diagonalSpecs(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  id: TableBorderDialogPositionId,
): readonly (TableBorderSpec | undefined)[] {
  const direction = tableDiagonalDirectionOf(id);
  if (direction === undefined) return [];

  const byRef = new Map<string, TableCell>();
  for (const [rowId, colId, cell] of model.cells) byRef.set(`${rowId} ${colId}`, cell);

  return tableRangeCellRefs(model, bounds).map(
    (ref) => byRef.get(`${ref.rowId} ${ref.colId}`)?.diagonal?.[direction],
  );
}

/**
 * Πολλά μολύβια → μία από τις τρεις καταστάσεις.
 *
 * Κενή είσοδος ⇒ `absent`: μια πλευρά χωρίς καμία ακμή (π.χ. `insideH` σε μία γραμμή) δεν
 * είναι «μεικτή», δεν είναι τίποτα. Η σύγκριση περνά **πάντα** από το {@link sameBorderSpec}
 * — δεύτερη σύγκριση πεδίο-προς-πεδίο εδώ θα ξεχνούσε το επόμενο πεδίο του μολυβιού, όπως
 * παραλίγο να συμβεί με το `doubleGapMm` της Φ5.
 */
function foldSpecs(
  specs: readonly (TableBorderSpec | undefined)[],
): TableBorderDialogPositionState {
  if (specs.length === 0) return ABSENT_STATE;

  const first = specs[0];
  for (const spec of specs) {
    if ((spec === undefined) !== (first === undefined)) return MIXED_STATE;
    if (spec !== undefined && first !== undefined && !sameBorderSpec(first, spec)) {
      return MIXED_STATE;
    }
  }
  return first === undefined ? ABSENT_STATE : { kind: 'uniform', spec: first };
}
