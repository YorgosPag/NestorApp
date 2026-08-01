/**
 * ADR-739 Φάση Δ βήμα 2 — **ποιο κελί είναι το επόμενο**. Καθαρή συνάρτηση, μηδέν React/DOM.
 *
 * Ο πυρήνας της πλοήγησης «σαν Excel» πάνω σε έναν `TableModel`. Ζει δίπλα στη μηχανή
 * διάταξης και **όχι** μέσα στο πληκτρολόγιο, για τον ίδιο λόγο που το
 * `table-cell-edit-session.ts` δεν ξέρει από React: η ίδια ερώτηση («πού πάει το Tab;»)
 * θα τεθεί ξανά από τη 3D όψη, από την επικόλληση TSV (Φ.Δ βήμα 3) και από την επιλογή
 * περιοχής (βήμα 4). Μία απάντηση, δοκιμασμένη χωρίς DOM.
 *
 * ## Τι κάνουν οι μεγάλοι (ερευνήθηκε 2026-08-01, ADR-739 §20.1)
 * - **BricsCAD** (τεκμηριωμένος κλώνος του AutoCAD TABLE in-place editor):
 *   `Tab` → επόμενο κελί ΙΔΙΑΣ γραμμής · `Shift+Tab` → προηγούμενο · `Enter` → επόμενο
 *   κελί ΙΔΙΑΣ στήλης · `Shift+Enter` → προηγούμενο · βέλη → μεταξύ κελιών · `Esc` → έξοδος.
 * - **Excel**: ο κανόνας της **στήλης αγκύρωσης** — μετά από σειρά `Tab`, το `Enter`
 *   κατεβαίνει και επιστρέφει στη στήλη **όπου ξεκίνησε το Tab**, όχι στην τελευταία.
 *   Αυτό είναι το χαρακτηριστικό που ξεχωρίζει τον επαγγελματικό πίνακα· υλοποιείται
 *   εδώ ως {@link TableCursorPosition.anchorColId}.
 * - **WAI-ARIA APG «Grid»**: `Home`/`End` = άκρα γραμμής, `Ctrl+Home`/`Ctrl+End` = άκρα
 *   πλέγματος. Η αναδίπλωση με βέλη είναι **προαιρετική** και μόνο για layout grids — εδώ
 *   τα βέλη **σταματούν** στην άκρη (ο πίνακας είναι δεδομένα, όχι διάταξη).
 *
 * ## Ο ΕΝΑΣ κανόνας που λύνει τις συγχωνεύσεις
 * Κάθε βήμα προχωρά **όσο χρειάζεται ώστε ο ιδιοκτήτης να αλλάξει** (`ownerByCell` του
 * {@link buildMergeIndex}). Ένα κελί 2×2 έχει τέσσερα κλειδιά με τον ίδιο ιδιοκτήτη· το
 * `Tab` μέσα του θα κολλούσε ή θα σταματούσε σε καλυμμένο κελί αν μετρούσαμε δείκτες.
 * Με τον κανόνα «άλλαξε ο ιδιοκτήτης» δεν χρειάζεται καμία ειδική περίπτωση ανά κατεύθυνση,
 * και ο δρομέας κάθεται **πάντα** στην άγκυρα — το μόνο κελί που κρατά περιεχόμενο.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-navigation
 * @see bim/table/table-model-helpers.ts — `buildMergeIndex`, το ευρετήριο που καταναλώνει
 * @see ui/table-cell-editor/use-table-cell-cursor-keys.ts — ο καταναλωτής πληκτρολογίου
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §20
 */

import type { CellKey, TableColumnId, TableModel, TableRowId } from '../../types/table';
import { buildMergeIndex, cellKey, indexById, type MergeIndex } from './table-model-helpers';

/**
 * Η θέση του δρομέα κελιού. Το `anchorColId` **δεν** είναι διακόσμηση: είναι η στήλη στην
 * οποία επιστρέφει το `Enter` (κανόνας Excel). Ταξιδεύει μαζί με τη θέση γιατί κάθε
 * κίνηση αποφασίζει η ίδια αν τη διατηρεί (`Tab`) ή τη μηδενίζει (όλες οι άλλες).
 */
export interface TableCursorPosition {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  readonly anchorColId: TableColumnId;
}

/**
 * Οι κινήσεις που ξέρει ο δρομέας. Ονόματα **πρόθεσης**, όχι πλήκτρων: η αντιστοίχιση
 * πλήκτρου → κίνηση ζει στον καταναλωτή πληκτρολογίου, ώστε αυτό το module να μένει
 * δοκιμάσιμο χωρίς `KeyboardEvent` και επαναχρησιμοποιήσιμο από την επικόλληση (βήμα 3).
 */
export type TableCursorMove =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  /** `Tab` — δεξιά, με **αναδίπλωση** στην αρχή της επόμενης γραμμής (AutoCAD/Word). */
  | 'next'
  /** `Shift+Tab` — αριστερά, με αναδίπλωση στο τέλος της προηγούμενης γραμμής. */
  | 'previous'
  /** `Enter` — κάτω **και** πίσω στη στήλη αγκύρωσης (Excel). */
  | 'commitDown'
  /** `Shift+Enter` — πάνω, με τον ίδιο κανόνα αγκύρωσης. */
  | 'commitUp'
  | 'rowStart'
  | 'rowEnd'
  | 'gridStart'
  | 'gridEnd';

/** Θέση σε **δείκτες** του μοντέλου — εσωτερικό λεξιλόγιο, ποτέ δεν διαρρέει. */
interface CellIndex {
  readonly r: number;
  readonly c: number;
}

/** Ό,τι χρειάζεται μια κίνηση, υπολογισμένο μία φορά ανά κλήση. */
interface NavContext {
  readonly model: TableModel;
  readonly merges: MergeIndex;
  readonly rowIndex: ReadonlyMap<TableRowId, number>;
  readonly colIndex: ReadonlyMap<TableColumnId, number>;
}

function buildContext(model: TableModel): NavContext {
  return {
    model,
    merges: buildMergeIndex(model),
    // `indexById` έρχεται από το `table-model-helpers` και ΔΕΝ ξαναγράφεται εδώ: το ίδιο
    // «ταυτότητα → θέση» χρειάζεται ήδη το `buildMergeIndex`. Το CHECK 3.28 (jscpd) το
    // έπιασε ως clone όταν γεννήθηκε τοπικό αντίγραφο — δες το σχόλιο στην πηγή.
    rowIndex: indexById(model.rows),
    colIndex: indexById(model.columns),
  };
}

/**
 * Ο **ιδιοκτήτης** ενός κελιού: η άγκυρα της συγχώνευσής του, ή ο εαυτός του όταν είναι
 * ελεύθερο. Η μοναδική έννοια ταυτότητας που χρησιμοποιεί η πλοήγηση — δες το σχόλιο
 * «ο ΕΝΑΣ κανόνας» στην κεφαλίδα.
 */
function ownerKeyAt(ctx: NavContext, at: CellIndex): CellKey {
  const key = cellKey(ctx.model.rows[at.r].id, ctx.model.columns[at.c].id);
  return ctx.merges.ownerByCell.get(key) ?? key;
}

/** Η θέση της άγκυρας στην οποία ανήκει ένα κελί — εκεί κάθεται πάντα ο δρομέας. */
function anchorIndexAt(ctx: NavContext, at: CellIndex): CellIndex {
  const span = ctx.merges.anchors.get(ownerKeyAt(ctx, at));
  if (!span) return at;
  const r = ctx.rowIndex.get(span.anchorRowId);
  const c = ctx.colIndex.get(span.anchorColId);
  return r === undefined || c === undefined ? at : { r, c };
}

function isInside(ctx: NavContext, at: CellIndex): boolean {
  return at.r >= 0 && at.r < ctx.model.rows.length && at.c >= 0 && at.c < ctx.model.columns.length;
}

/**
 * Ένα βήμα προς `(dr, dc)` που **προσπερνά ολόκληρη** τη συγχώνευση στην οποία στέκεσαι,
 * και προσγειώνεται στην άγκυρα της επόμενης. `null` στην άκρη του πλέγματος.
 *
 * Ο βρόχος τερματίζει πάντα: κάθε επανάληψη απομακρύνεται κατά ένα κελί από την αφετηρία
 * και ο έλεγχος ορίων κόβει το πολύ μετά από `rows × cols` βήματα.
 */
function stepOut(ctx: NavContext, from: CellIndex, dr: number, dc: number): CellIndex | null {
  const origin = ownerKeyAt(ctx, from);
  let cursor: CellIndex = from;
  for (;;) {
    cursor = { r: cursor.r + dr, c: cursor.c + dc };
    if (!isInside(ctx, cursor)) return null;
    if (ownerKeyAt(ctx, cursor) !== origin) return anchorIndexAt(ctx, cursor);
  }
}

/** Το πρώτο (`dc = +1`) ή τελευταίο (`dc = -1`) κελί μιας γραμμής, ως άγκυρα. */
function rowEdge(ctx: NavContext, r: number, dc: 1 | -1): CellIndex {
  const c = dc === 1 ? 0 : ctx.model.columns.length - 1;
  return anchorIndexAt(ctx, { r, c });
}

/** `Tab` / `Shift+Tab` — οριζόντια κίνηση με **αναδίπλωση γραμμής**, όπως στο Word/AutoCAD. */
function wrapHorizontally(ctx: NavContext, from: CellIndex, forward: boolean): CellIndex | null {
  const inRow = stepOut(ctx, from, 0, forward ? 1 : -1);
  if (inRow) return inRow;
  const nextRow = stepOut(ctx, from, forward ? 1 : -1, 0);
  if (!nextRow) return null;
  return rowEdge(ctx, nextRow.r, forward ? 1 : -1);
}

/**
 * `Enter` / `Shift+Enter` — κατακόρυφη κίνηση **στη στήλη αγκύρωσης** (Excel).
 *
 * Η στήλη αλλάζει πρώτη και η γραμμή μετά, ώστε ο κανόνας «άλλαξε ο ιδιοκτήτης» να
 * μετρηθεί από το κελί της αγκύρωσης — αλλιώς ένα `Enter` από συγχωνευμένο κελί θα
 * μετρούσε το ύψος της **δικής του** συγχώνευσης αντί εκείνης της στήλης προορισμού.
 */
function commitVertically(
  ctx: NavContext,
  from: CellIndex,
  anchorColId: TableColumnId,
  forward: boolean,
): CellIndex | null {
  const anchorCol = ctx.colIndex.get(anchorColId);
  const start = anchorCol === undefined ? from : anchorIndexAt(ctx, { r: from.r, c: anchorCol });
  return stepOut(ctx, start, forward ? 1 : -1, 0);
}

/** Η κίνηση σε δείκτες· `null` όταν δεν υπάρχει προορισμός (άκρη πλέγματος). */
function resolveMove(
  ctx: NavContext,
  from: CellIndex,
  anchorColId: TableColumnId,
  move: TableCursorMove,
): CellIndex | null {
  switch (move) {
    case 'left': return stepOut(ctx, from, 0, -1);
    case 'right': return stepOut(ctx, from, 0, 1);
    case 'up': return stepOut(ctx, from, -1, 0);
    case 'down': return stepOut(ctx, from, 1, 0);
    case 'next': return wrapHorizontally(ctx, from, true);
    case 'previous': return wrapHorizontally(ctx, from, false);
    case 'commitDown': return commitVertically(ctx, from, anchorColId, true);
    case 'commitUp': return commitVertically(ctx, from, anchorColId, false);
    case 'rowStart': return rowEdge(ctx, from.r, 1);
    case 'rowEnd': return rowEdge(ctx, from.r, -1);
    case 'gridStart': return rowEdge(ctx, 0, 1);
    case 'gridEnd': return rowEdge(ctx, ctx.model.rows.length - 1, -1);
  }
}

/**
 * Μόνο το `Tab`/`Shift+Tab` **διατηρεί** τη στήλη αγκύρωσης — αυτό ακριβώς είναι ο κανόνας
 * του Excel: η αγκύρωση θυμάται πού **ξεκίνησε η σειρά από Tab**, οπότε κάθε άλλη κίνηση
 * (βέλος, Enter, Home, κλικ) ορίζει νέα αφετηρία.
 *
 * Το `Enter` επίσης τη διατηρεί, ώστε διαδοχικά `Enter` να μένουν στην ίδια στήλη αντί να
 * ολισθαίνουν — αλλιώς ο κανόνας θα ίσχυε μόνο για το πρώτο.
 */
function keepsAnchor(move: TableCursorMove): boolean {
  return move === 'next' || move === 'previous' || move === 'commitDown' || move === 'commitUp';
}

/**
 * Το επόμενο κελί, ή `null` όταν η κίνηση δεν έχει προορισμό (ο δρομέας μένει όπου είναι —
 * ποτέ αναδίπλωση από την τελευταία στην πρώτη γραμμή, ποτέ αυτόματη νέα γραμμή).
 *
 * ⚠️ Η **μη**-δημιουργία γραμμής στο `Tab` του τελευταίου κελιού είναι συνειδητή απόφαση,
 * όχι παράλειψη: το Word/FigJam προσθέτουν γραμμή, το Excel/AutoCAD όχι. Ο πίνακας εδώ
 * είναι **οντότητα σχεδίου** με μοντέλο που εξάγεται σε DXF — μια σιωπηλή μεταβολή
 * μοντέλου από πλήκτρο πλοήγησης θα ήταν μη-αναστρέψιμη έκπληξη σε undo stack CAD.
 * Η προσθήκη γραμμής ανήκει σε ρητή εντολή (Φ.Δ, εργαλείο πίνακα).
 *
 * @param model το μοντέλο· η πλοήγηση **δεν** το μεταβάλλει ποτέ
 * @param from η τρέχουσα θέση· άγνωστο row/col id ⇒ `null` (μπαγιάτικος δρομέας)
 */
export function moveTableCursor(
  model: TableModel,
  from: TableCursorPosition,
  move: TableCursorMove,
): TableCursorPosition | null {
  const ctx = buildContext(model);
  const r = ctx.rowIndex.get(from.rowId);
  const c = ctx.colIndex.get(from.colId);
  if (r === undefined || c === undefined) return null;

  const target = resolveMove(ctx, anchorIndexAt(ctx, { r, c }), from.anchorColId, move);
  if (!target) return null;

  const rowId = model.rows[target.r].id;
  const colId = model.columns[target.c].id;
  if (rowId === from.rowId && colId === from.colId) return null;

  return { rowId, colId, anchorColId: keepsAnchor(move) ? from.anchorColId : colId };
}

/**
 * Ο δρομέας σε ένα κελί που μόλις δείχτηκε (κλικ / διπλό κλικ), με **νέα** στήλη
 * αγκύρωσης. Ένα κλικ ξεκινά καινούρια σειρά καταχώρισης — δες {@link keepsAnchor}.
 */
export function tableCursorAt(rowId: TableRowId, colId: TableColumnId): TableCursorPosition {
  return { rowId, colId, anchorColId: colId };
}

/**
 * ADR-739 Φ.Δ βήμα 4 — το **πρώτο** κελί του πίνακα: εκεί προσγειώνεσαι όταν μπαίνεις
 * στη λειτουργία πίνακα **χωρίς να δείξεις κελί** (`Enter` / `F2` / εντολή `TABLEDIT`).
 *
 * Περνά από το {@link anchorIndexAt}, όπως **κάθε** άλλη κίνηση: ο δρομέας δεν επιτρέπεται
 * ποτέ να καθίσει σε **καλυμμένο** κελί — από εκεί καμία κίνηση δεν θα μπορούσε να τον
 * βγάλει, γιατί το `moveTableCursor` απορρίπτει μπαγιάτικη αφετηρία.
 *
 * ⚠️ **Ειλικρίνεια για την κάλυψη**: με το σημερινό μοντέλο συγχώνευσης — ορθογώνια spans
 * αγκυρωμένα **πάνω-αριστερά** — μια συγχώνευση που καλύπτει το `(0,0)` οφείλει να είναι
 * αγκυρωμένη ΣΤΟ `(0,0)`. Άρα η κλήση είναι σήμερα **ταυτοτική** και κανένα test δεν μπορεί
 * να την πυροδοτήσει. Μένει επειδή είναι η **ίδια** ερώτηση με κάθε άλλη κίνηση και κοστίζει
 * μία αναζήτηση· αν το μοντέλο αποκτήσει ποτέ μη-ορθογώνιες ή μη-πάνω-αριστερά αγκυρωμένες
 * συγχωνεύσεις, αυτή η γραμμή είναι η διαφορά ανάμεσα σε «δουλεύει» και «ο δρομέας κολλάει
 * στο πρώτο κελί». Δεν είναι νεκρός κώδικας — είναι ο **αναλλοίωτος** γραμμένος μία φορά.
 *
 * `null` μόνο για πίνακα χωρίς γραμμές ή χωρίς στήλες — που δεν έχει κελί να δείξει.
 */
export function tableFirstCursorPosition(model: TableModel): TableCursorPosition | null {
  if (model.rows.length === 0 || model.columns.length === 0) return null;
  const ctx = buildContext(model);
  const at = anchorIndexAt(ctx, { r: 0, c: 0 });
  return tableCursorAt(model.rows[at.r].id, model.columns[at.c].id);
}
