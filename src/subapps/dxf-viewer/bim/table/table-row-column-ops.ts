/**
 * ADR-739 Φ.Δ βήμα 9 — **η ρητή εντολή που έλειπε**: εισαγωγή και διαγραφή γραμμής/στήλης.
 * Καθαρές, αμετάβλητες, μηδέν React/DOM.
 *
 * Το `table-range-clipboard.ts` το είχε δηλώσει ρητά: «Ο πίνακας **ΔΕΝ** μεγαλώνει μόνος
 * του… η προσθήκη γραμμών ανήκει σε **ρητή** εντολή». Αυτό είναι εκείνη η εντολή — ό,τι
 * δεν χώρεσε σε μια επικόλληση, ο χρήστης το χωράει τώρα ο ίδιος, συνειδητά και με undo.
 *
 * ## Το σχήμα είναι το ΙΔΙΟ με τον εγγραφέα κειμένου
 * Παίρνουν {@link PersistedTableModel}, δίνουν {@link PersistedTableModel}, και επιστρέφουν
 * το **ίδιο αντικείμενο by-reference** όταν δεν αλλάζει τίποτα. Αυτή η τελευταία εγγύηση
 * είναι που κάνει το `buildTableModelCommand` να μη γεννήσει εντολή για το τίποτα — δηλαδή
 * κανένα `Ctrl+Z` που δεν αναιρεί τίποτα ορατό (δες `setPersistedCellText`, εγγύηση 4).
 *
 * ## 🔴 Οι τέσσερις αποφάσεις που δεν προκύπτουν από τον κώδικα
 *
 * ### 1. Νέα ταυτότητα: `r7`, όχι `r${θέση}`
 * Οι ταυτότητες είναι **τοπικές στον πίνακα** (`r0…rN` / `c0…cN` — δες `build-table-entity.ts`
 * για το γιατί ο N.6 δεν εφαρμόζεται εδώ). Το προφανές `r${atIndex}` **συγκρούεται**: μια
 * εισαγωγή στη μέση θα γεννούσε δεύτερο `r2`, και ο αραιός χάρτης κελιών θα έδειχνε τα
 * κελιά της παλιάς γραμμής στη νέα. Ο γεννήτορας παίρνει το **μέγιστο επίθεμα +1** και
 * επαληθεύει σε `Set` — ντετερμινιστικός (σταθερό JSON, δοκιμάσιμο), καμία `crypto`.
 *
 * ### 2. Η εισαγωγή ΔΕΝ αγγίζει κανένα κελί — **ούτε καμία ακμή**
 * Ούτε ένα. Ο αραιός χάρτης δείχνει σε ταυτότητες, άρα μια νέα γραμμή στη μέση δεν
 * μετακινεί τίποτα — αυτός ακριβώς είναι ο λόγος που το μοντέλο διάλεξε id αντί για index
 * (`types/table.ts`: «το AutoCAD τα κρατά με index — γι' αυτό εκεί οι τύποι σπάνε»).
 *
 * Το ίδιο ισχύει αυτούσιο για τις ρητές ακμές του ADR-750: περνούν από το spread **χωρίς
 * να τις κοιτάξει κανείς**, και αυτό δεν είναι παράλειψη — είναι το παραδοτέο. Το
 * τεκμηριωμένο παράπονο Π5 του Excel («η εισαγωγή γραμμής καταστρέφει τα περιγράμματα»)
 * είναι εδώ **μη εκφράσιμο**, χωρίς καμία γραμμή κώδικα συντήρησης.
 *
 * ### 3. Συγχωνεύσεις: ο κανόνας του Excel, με **μία** ρητή εξαίρεση
 * Εισαγωγή **αυστηρά μέσα** σε ένα εύρος το μεγαλώνει· εισαγωγή δίπλα του όχι (Excel).
 * Η εξαίρεση είναι η συγχώνευση που κάλυπτε **ολόκληρο** τον άξονα — η γραμμή τίτλου
 * (`buildTitleMerge`). Το μοντέλο μας εκφράζει τον τίτλο ως merge ενώ το AutoCAD τον έχει
 * ως **ιδιότητα κλάσης γραμμής**· χωρίς την εξαίρεση, η πιο συνηθισμένη πράξη όλων
 * («εισαγωγή στήλης δεξιά») θα άφηνε τον τίτλο να σταματά μια στήλη πριν το τέλος. Δηλαδή
 * η εξαίρεση δεν είναι χαλάρωση του κανόνα — είναι η μετάφραση μιας έννοιας που το δικό μας
 * σχήμα δεν έχει.
 *
 * ### 4. Η διαγραφή άγκυρας ΜΕΤΑΦΕΡΕΙ το περιεχόμενο, δεν το σβήνει
 * Ο χρήστης βλέπει **ένα** κελί «ΠΙΝΑΚΑΣ» απλωμένο σε τρεις στήλες· το ότι το κείμενο ζει
 * τεχνικά στην πρώτη είναι εσωτερικό. Διαγραφή της πρώτης στήλης ⇒ η συγχώνευση
 * ξανα-αγκυρώνεται στην επόμενη επιζώσα **μαζί με το περιεχόμενό της**. Η εναλλακτική είναι
 * σιωπηλή απώλεια κειμένου που ο χρήστης δεν είχε τρόπο να προβλέψει.
 *
 * @module subapps/dxf-viewer/bim/table/table-row-column-ops
 * @see bim/table/table-cell-edit-session.ts — η ΜΙΑ διαδρομή commit (ένα undo)
 * @see bim/table/table-cell-order.ts — η σειρά γραμμή × στήλη (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §27.4
 */

import type {
  CellSpan,
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableColumnId,
  TableRow,
  TableRowId,
} from '../../types/table';
import { canGrowTableGrid } from './table-capacity';
import { indexById, insertionIndexFor, type TableAxis } from './table-cell-order';
// 🔴 ADR-833 Φάση 4 — ο ΕΝΑΣ γεννήτορας τοπικής ταυτότητας πίνακα (N.18: η εξαγωγή έγινε
// ΠΡΙΝ γεννηθεί ο τρίτος κλώνος, όπως στα `stamp-table-chrome-rect` / `stamp-table-control-disc`).
import { nextPrefixedId } from './table-next-id';
import { rebuildTableEdgesOnDelete } from './table-edge-model';
import { dropTableRowLink } from './table-row-link-model';
import { cellKey } from './table-model-helpers';
import { recalculateAllTableFormulas } from './formula/table-formula-engine';
import type { TableFormulaWorkbook } from './formula/table-formula-workbook';
import { healTableFormulaRefsOnDelete } from './formula/table-formula-structural-heal';

const ID_PREFIX: Readonly<Record<TableAxis, string>> = { row: 'r', column: 'c' };

// ──────────────────────────────────────────────────────────────────────────────
// Ταυτότητες
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Η επόμενη ελεύθερη ταυτότητα του άξονα — δες την Απόφαση 1 στην κεφαλίδα.
 *
 * 🔴 **ADR-833 Φάση 4 — το σώμα ΜΕΤΑΚΟΜΙΣΕ, δεν αντιγράφηκε.** Το μοτίβο «μέγιστο+1 με
 * βρόχο επαλήθευσης» απέκτησε **τρίτο** καταναλωτή (η προσθήκη φύλλου εργασίας), και το
 * `types/table-worksheet.ts` είχε γράψει **από πριν** ότι τότε εξάγεται σε κοινό SSoT. Ζει
 * πλέον στο {@link nextPrefixedId} — μαζί με την αιτιολόγηση του βρόχου, που είναι ακριβώς
 * το κομμάτι που ξεχνά κάθε δεύτερο αντίγραφο.
 *
 * Εδώ μένει **μόνο** η γνώση που ανήκει στον άξονα: ποιο πρόθεμα φοράει ο καθένας.
 */
function nextAxisId(existingIds: readonly string[], axis: TableAxis): string {
  return nextPrefixedId(existingIds, ID_PREFIX[axis]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Συγχωνεύσεις — μία υλοποίηση για τους δύο άξονες
// ──────────────────────────────────────────────────────────────────────────────

function spanAnchorId(span: CellSpan, axis: TableAxis): string {
  return axis === 'row' ? span.anchorRowId : span.anchorColId;
}

function spanSize(span: CellSpan, axis: TableAxis): number {
  return axis === 'row' ? span.rowSpan : span.colSpan;
}

function withSpan(span: CellSpan, axis: TableAxis, anchorId: string, size: number): CellSpan {
  return axis === 'row'
    ? { ...span, anchorRowId: anchorId, rowSpan: size }
    : { ...span, anchorColId: anchorId, colSpan: size };
}

/**
 * Τα εύρη μετά από **εισαγωγή** στη θέση `atIndex` — Απόφαση 3 της κεφαλίδας.
 *
 * `ids` είναι η σειρά **πριν** την εισαγωγή: οι άγκυρες δείχνουν σε ταυτότητες, άρα
 * μετακινούνται δωρεάν και το μόνο ερώτημα είναι αν το εύρος μεγαλώνει.
 */
function growSpansOnInsert(
  spans: readonly CellSpan[],
  axis: TableAxis,
  ids: readonly string[],
  atIndex: number,
): readonly CellSpan[] {
  const order = indexById(ids.map((id) => ({ id })));
  return spans.map((span) => {
    const anchorIndex = order.get(spanAnchorId(span, axis));
    if (anchorIndex === undefined) return span;
    const size = spanSize(span, axis);
    const coversWholeAxis = anchorIndex === 0 && size >= ids.length;
    const lastIndex = anchorIndex + size - 1;
    const insertedInside = atIndex > anchorIndex && atIndex <= lastIndex;
    // Η εξαίρεση: μια συγχώνευση ολόκληρου άξονα δέχεται και την εισαγωγή **ακριβώς μετά**
    // το δεξί/κάτω άκρο της, γιατί «ολόκληρος ο άξονας» είναι η ιδιότητα που βλέπει ο χρήστης.
    const appendedToWhole = coversWholeAxis && atIndex === lastIndex + 1;
    if (!insertedInside && !appendedToWhole) return span;
    return withSpan(span, axis, spanAnchorId(span, axis), size + 1);
  });
}

/** Ένα εύρος που ξανα-αγκυρώθηκε: από ποιο κελί σε ποιο μετακομίζει το περιεχόμενο. */
interface AnchorMove {
  readonly fromRowId: TableRowId;
  readonly fromColId: TableColumnId;
  readonly toRowId: TableRowId;
  readonly toColId: TableColumnId;
}

interface ShrinkResult {
  readonly spans: readonly CellSpan[];
  /** Απόφαση 4 — το περιεχόμενο ακολουθεί την άγκυρα. */
  readonly anchorMoves: readonly AnchorMove[];
}

/**
 * Τα εύρη μετά από **διαγραφή** της θέσης `removedIndex`.
 *
 * Τρεις καταστάσεις: εκτός εύρους (αμετάβλητο), μέσα στο εύρος (−1), πάνω στην άγκυρα
 * (−1 **και** ξανα-αγκύρωση στην επόμενη επιζώσα + μετακόμιση περιεχομένου). Εύρος που
 * εκφυλίζεται σε μηδέν παύει να υπάρχει· εύρος `1×1` επίσης — δεν είναι συγχώνευση
 * (`buildMergeIndex` το αγνοεί ήδη, αλλά δεν αφήνουμε σκουπίδια στη σκηνή).
 */
function shrinkSpansOnDelete(
  spans: readonly CellSpan[],
  axis: TableAxis,
  ids: readonly string[],
  removedIndex: number,
): ShrinkResult {
  const order = indexById(ids.map((id) => ({ id })));
  const kept: CellSpan[] = [];
  const anchorMoves: AnchorMove[] = [];

  for (const span of spans) {
    const anchorIndex = order.get(spanAnchorId(span, axis));
    if (anchorIndex === undefined) continue; // ορφανή άγκυρα — δεν επιβιώνει της πράξης
    const size = spanSize(span, axis);
    if (removedIndex < anchorIndex || removedIndex > anchorIndex + size - 1) {
      kept.push(span);
      continue;
    }

    const nextSize = size - 1;
    if (nextSize < 1) continue;

    if (removedIndex !== anchorIndex) {
      kept.push(withSpan(span, axis, spanAnchorId(span, axis), nextSize));
      continue;
    }

    // Η άγκυρα σβήνεται: η επόμενη θέση του άξονα γίνεται η νέα άγκυρα.
    const nextAnchorId = ids[anchorIndex + 1];
    if (nextAnchorId === undefined) continue;
    const moved = withSpan(span, axis, nextAnchorId, nextSize);
    if (moved.rowSpan === 1 && moved.colSpan === 1) continue;
    kept.push(moved);
    anchorMoves.push({
      fromRowId: span.anchorRowId,
      fromColId: span.anchorColId,
      toRowId: moved.anchorRowId,
      toColId: moved.anchorColId,
    });
  }

  return { spans: kept, anchorMoves };
}

// ──────────────────────────────────────────────────────────────────────────────
// Φράγματα — η ΜΙΑ αρχή χωρητικότητας, ρωτημένη πριν από την πράξη
// ──────────────────────────────────────────────────────────────────────────────
//
// 🔴 ADR-833 Φ5Β — **η ερώτηση άλλαξε, και μαζί της η μονάδα.** Μέχρι τη Φάση 5Β τα δύο
// φράγματα ρωτούσαν **ανά άξονα** (`γραμμές δεδομένων ≤ 1000`, `στήλες ≤ 256`), δηλαδή ένα
// **ζεύγος διαστάσεων** — που το §5.6.4 απέδειξε δύο φορές ότι δεν προστατεύει τίποτα.
// Πλέον ρωτούν το **ΠΥΚΝΟ ΓΙΝΟΜΕΝΟ** (`table-capacity`), γιατί αυτό ακριβώς πληρώνει το
// `placeCells`: ~32 µs ανά πυκνό κελί, σε **κάθε** δεσμευμένη αλλαγή.
//
// ⚠️ Και μετρά **ΟΛΕΣ** τις γραμμές, όχι μόνο τις `data`: ο τίτλος και η κεφαλίδα περνούν
// κι εκείνοι από τον βρόχο της διάταξης. Ο παλιός μετρητής `dataRowCount` έφυγε γι' αυτόν
// ακριβώς τον λόγο — μετρούσε τη σωστή ποσότητα για **λάθος** ερώτηση.

/**
 * ADR-739 §27.17 — το `count` είναι **το πλήθος της πράξης**, όχι διακοσμητικό.
 *
 * Με τρεις στήλες μαρκαρισμένες, η ερώτηση δεν είναι «χωράει άλλη μία;» αλλά «χωρούν και οι
 * τρεις;». Το φράγμα ρωτιέται **μία** φορά, πριν από την πρώτη μεταβολή (δες
 * `table-row-column-bulk-ops.ts`: όλα ή τίποτα) — αλλιώς μια εισαγωγή θα σταματούσε στη μέση
 * και θα άφηνε βήμα undo που δεν αναιρεί αυτό που ζήτησε ο χρήστης.
 *
 * Η προεπιλογή `1` κρατά **αναλλοίωτους** τους δύο υπάρχοντες καλούντες (μενού ζωνών με έναν
 * άξονα, χειριστήριο «+»): ο ίδιος ορισμός, με ρητό πλήθος όταν χρειάζεται.
 */
export function canInsertTableRow(model: PersistedTableModel, count = 1): boolean {
  return count >= 1 && canGrowTableGrid(model, { rows: count });
}

export function canInsertTableColumn(model: PersistedTableModel, count = 1): boolean {
  return count >= 1 && canGrowTableGrid(model, { columns: count });
}

/** Μηδέν γραμμές = πίνακας χωρίς ύψος = αόρατη οντότητα (ίδιο σκεπτικό με το `sanitizeCount`). */
export function canDeleteTableRow(model: PersistedTableModel, count = 1): boolean {
  return count >= 1 && model.rows.length > count;
}

export function canDeleteTableColumn(model: PersistedTableModel, count = 1): boolean {
  return count >= 1 && model.columns.length > count;
}

// ──────────────────────────────────────────────────────────────────────────────
// Εισαγωγή
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Νέα γραμμή στη θέση `atIndex` (η υπάρχουσα εκεί κατεβαίνει). Ο δείκτης **κόβεται** στα
 * όρια αντί να πετάει σφάλμα — ίδια στάση με το `sanitizeCount`.
 *
 * 🔴 **Πάντα `rowClass: 'data'`.** Οι κλάσεις `title`/`header` είναι δομικά μοναδικές στο
 * μοντέλο του `ACAD_TABLE` (μία ζώνη τίτλου, μία κεφαλίδας) και το στυλ τις ζωγραφίζει ως
 * τέτοιες· μια δεύτερη γραμμή τίτλου θα εμφανιζόταν ως τίτλος και ο χρήστης **δεν έχει
 * σήμερα κανέναν τρόπο** να την ξαναχαρακτηρίσει. Χωρίς `heightMm` ⇒ το ύψος το δίνει το
 * στυλ, όπως σε κάθε νέα γραμμή του εργοστασίου.
 */
export function insertTableRow(
  book: TableFormulaWorkbook,
  model: PersistedTableModel,
  atIndex: number,
): PersistedTableModel {
  if (!canInsertTableRow(model)) return model;

  const at = clampIndex(atIndex, model.rows.length);
  const ids = model.rows.map((row) => row.id);
  const template = model.rows[Math.min(at, model.rows.length - 1)];
  const row: TableRow = {
    id: nextAxisId(ids, 'row'),
    rowClass: 'data',
    // ADR-739 Φ.Ε (Α2) — η μορφοποίηση κληρονομείται από τη γραμμή **αναφοράς**, όπως στο
    // Excel. Το `heightMm` και το `borderTop` ΔΕΝ: το πρώτο είναι γεωμετρία που ο χρήστης
    // ρύθμισε για συγκεκριμένο περιεχόμενο, το δεύτερο είναι ο δείκτης «εδώ αρχίζουν τα
    // σύνολα» — αντιγραμμένος, θα ζωγράφιζε δεύτερη γραμμή συνόλων που δεν υπάρχει.
    ...(template?.styleOverride ? { styleOverride: template.styleOverride } : {}),
  };

  const rows = model.rows.slice();
  rows.splice(at, 0, row);

  // Απόφαση 2: κανένα κελί δεν αγγίζεται — η σειρά γραμμή × στήλη διατηρείται αυτούσια,
  // αφού η νέα γραμμή είναι κενή και οι υπόλοιπες κρατούν τη σχετική τους σειρά.
  return recalculateAllTableFormulas(book, {
    ...model,
    rows,
    merges: growSpansOnInsert(model.merges, 'row', ids, at),
  });
}

/**
 * Νέα στήλη στη θέση `atIndex` (η υπάρχουσα εκεί μετακινείται δεξιά).
 *
 * Κληρονομεί `sizing` / `valueType` / `align` / `overflow` από τη στήλη **αναφοράς** (αυτή
 * που πατήθηκε), όπως το Excel κληρονομεί τη μορφοποίηση του γείτονα: αλλιώς το πλάτος θα
 * «πηδούσε» στο προεπιλεγμένο και ο χρήστης θα το ξαναέφτιαχνε κάθε φορά.
 *
 * ⚠️ Το `sourceKey` **ποτέ** δεν αντιγράφεται: είναι δεσμός δεδομένων (`bound`/`live` mode)
 * και δύο στήλες που διαβάζουν το ίδιο κλειδί πηγής είναι πραγματικό σφάλμα, όχι διευκόλυνση.
 */
export function insertTableColumn(
  book: TableFormulaWorkbook,
  model: PersistedTableModel,
  atIndex: number,
): PersistedTableModel {
  if (!canInsertTableColumn(model)) return model;

  const at = clampIndex(atIndex, model.columns.length);
  const ids = model.columns.map((column) => column.id);
  const template = model.columns[Math.min(at, model.columns.length - 1)];
  const column: TableColumn = {
    id: nextAxisId(ids, 'column'),
    sizing: template.sizing,
    valueType: template.valueType,
    align: template.align,
    ...(template.overflow ? { overflow: template.overflow } : {}),
    // ADR-739 Φ.Ε (Α2) — **ρίσκο 5 του §28.7**: αυτή η λίστα είναι ρητή, άρα ένα ξεχασμένο
    // πεδίο δεν το πιάνει κανένας μεταγλωττιστής. Χωρίς το `styleOverride`, η πιο ορατή
    // ακολουθία όλων — «βάφω τη στήλη → εισαγωγή δεξιά» — γεννά **άβαφη** στήλη, δηλαδή
    // αποτυγχάνει ακριβώς ο λόγος που επιλέχθηκε το μοντέλο επιπέδου άξονα.
    ...(template.styleOverride ? { styleOverride: template.styleOverride } : {}),
  };

  const columns = model.columns.slice();
  columns.splice(at, 0, column);

  return recalculateAllTableFormulas(book, {
    ...model,
    columns,
    merges: growSpansOnInsert(model.merges, 'column', ids, at),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Διαγραφή
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Σβήνει τη γραμμή και **ό,τι ζούσε μέσα της**. Άγνωστη ταυτότητα ή τελευταία γραμμή ⇒ το
 * ίδιο μοντέλο by-reference (καμία εντολή, κανένα βήμα undo).
 *
 * Οι ρητές ακμές ακολουθούν τον **ίδιο** κανόνα με το περιεχόμενο (Απόφαση 4): το σύνορο
 * μετακομίζει στην επόμενη επιζώσα γραμμή αντί να εξαφανιστεί — αλλιώς η διαγραφή της
 * πρώτης γραμμής θα έσβηνε το **πάνω πλαίσιο του πίνακα**. Ο κανόνας ζει ολόκληρος στο
 * `table-edge-model.ts`.
 */
export function deleteTableRow(
  book: TableFormulaWorkbook,
  model: PersistedTableModel,
  rowId: TableRowId,
): PersistedTableModel {
  const at = model.rows.findIndex((row) => row.id === rowId);
  if (at < 0 || !canDeleteTableRow(model)) return model;

  // 🔴 ADR-764 (Α) — **ΠΡΙΝ** την αφαίρεση: μόνο όσο η σβησμένη ταυτότητα βρίσκεται ακόμη στη
  // σειρά είναι γνώσιμος ο επιζών γείτονας, δηλαδή μόνο τώρα μπορεί ένα `=SUM(A1:A4)` να γίνει
  // `=SUM(A1:A3)`. Ίδια αρχή με τον `heirId` των ακμών, μια γραμμή πιο κάτω.
  const healed = healTableFormulaRefsOnDelete(model, 'row', rowId);
  const ids = model.rows.map((row) => row.id);
  const { spans, anchorMoves } = shrinkSpansOnDelete(model.merges, 'row', ids, at);
  const rows = model.rows.filter((row) => row.id !== rowId);
  const next = { ...healed, rows, merges: spans };

  // ADR-764 (Β) — και **ΜΕΤΑ** την αφαίρεση: ό,τι δείχνει σε ταυτότητα που δεν ζει πια
  // αποτιμάται `#REF!`. Μαζί με το (Α) είναι **μία** μεταβολή, άρα ένα βήμα undo.
  return recalculateAllTableFormulas(book, {
    ...next,
    cells: rebuildCells(next, healed.cells, (entry) => entry[0] !== rowId, anchorMoves),
    edges: rebuildTableEdgesOnDelete(next, model.edges, 'row', rowId, model.rows[at + 1]?.id),
    // ADR-739 Επίπεδο Β — ο δεσμός φεύγει μαζί με τη γραμμή, **χωρίς** κληρονόμο. Ο κανόνας
    // (και γιατί διαφέρει από τις ακμές) ζει ολόκληρος στο `table-row-link-model.ts`.
    rowLinks: dropTableRowLink(model.rowLinks, rowId),
  });
}

/** Το ίδιο για στήλη — ίδιες τέσσερις εγγυήσεις (κελιά, εύρη, ακμές, ταυτότητα by-reference). */
export function deleteTableColumn(
  book: TableFormulaWorkbook,
  model: PersistedTableModel,
  colId: TableColumnId,
): PersistedTableModel {
  const at = model.columns.findIndex((column) => column.id === colId);
  if (at < 0 || !canDeleteTableColumn(model)) return model;

  // ADR-764 (Α) και (Β) — δες `deleteTableRow`, ίδια σειρά και για τον ίδιο λόγο.
  const healed = healTableFormulaRefsOnDelete(model, 'column', colId);
  const ids = model.columns.map((column) => column.id);
  const { spans, anchorMoves } = shrinkSpansOnDelete(model.merges, 'column', ids, at);
  const columns = model.columns.filter((column) => column.id !== colId);
  const next = { ...healed, columns, merges: spans };

  return recalculateAllTableFormulas(book, {
    ...next,
    cells: rebuildCells(next, healed.cells, (entry) => entry[1] !== colId, anchorMoves),
    edges: rebuildTableEdgesOnDelete(
      next,
      model.edges,
      'column',
      colId,
      model.columns[at + 1]?.id,
    ),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Κοινά
// ──────────────────────────────────────────────────────────────────────────────

function clampIndex(value: number, length: number): number {
  if (!Number.isFinite(value)) return length;
  return Math.min(Math.max(Math.trunc(value), 0), length);
}

/**
 * Τα κελιά μετά από διαγραφή: πετάει όσα ζούσαν στη σβησμένη γραμμή/στήλη και **μετακομίζει**
 * όσα ήταν άγκυρες συγχωνεύσεων που επέζησαν (Απόφαση 4).
 *
 * Το φιλτράρισμα είναι ρητό και δεν αφήνεται στη σιωπηλή παράλειψη του
 * `toPersistedTableModel`: αυτή η διαδρομή δεν περνά από εκεί, και ένα κελί-ζόμπι θα
 * ξανα-εμφανιζόταν αν κάποτε ξαναγεννιόταν ταυτότητα με το ίδιο όνομα.
 */
function rebuildCells(
  source: Pick<PersistedTableModel, 'rows' | 'columns'>,
  cells: readonly TableCellEntry[],
  survives: (entry: TableCellEntry) => boolean,
  anchorMoves: readonly AnchorMove[],
): readonly TableCellEntry[] {
  // `cellKey` και όχι χειροποίητο αλφαριθμητικό: είναι η δηλωμένη **μόνη** νόμιμη πηγή
  // κλειδιού, και μαζί της έρχεται η εγγύηση σειράς σκελών (γραμμή, στήλη) από τον compiler.
  const moved = new Map<string, TableCellEntry>();
  for (const move of anchorMoves) {
    const found = cells.find(([r, c]) => r === move.fromRowId && c === move.fromColId);
    if (found) moved.set(cellKey(move.toRowId, move.toColId), [move.toRowId, move.toColId, found[2]]);
  }

  // Τα κελιά που **επιζούν** κρατούν τη σειρά τους· η σχετική διάταξη γραμμή × στήλη δεν
  // αλλάζει όταν αφαιρείται μια ολόκληρη γραμμή/στήλη.
  const kept = cells.filter((entry) => survives(entry) && !moved.has(cellKey(entry[0], entry[1])));

  let result = kept;
  for (const entry of moved.values()) {
    const at = insertionIndexFor(source, result, entry[0], entry[1]);
    const withMoved = result.slice();
    withMoved.splice(at, 0, entry);
    result = withMoved;
  }
  return result;
}
