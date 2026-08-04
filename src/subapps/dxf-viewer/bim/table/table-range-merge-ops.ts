/**
 * 🔴 ADR-755 — **η ΕΓΓΡΑΦΗ των συγχωνεύσεων**: οι τέσσερις εντολές του Excel ως καθαρές πράξεις.
 *
 * Καθαρές συναρτήσεις: μηδέν React, μηδέν canvas, μηδέν i18n. Αδελφό αρχείο του
 * `table-range-border-ops.ts` και του `table-cell-diagonal-ops.ts`, με το ίδιο σχήμα (μητρώο
 * εντολών → εφαρμοστής → κατάσταση για το κουμπί).
 *
 * ## 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — «η υποδομή ήταν νεκρή»
 * Το μοντέλο ήξερε συγχωνεύσεις από την πρώτη μέρα, και **ολόκληρη** η ανάγνωση ήταν γραμμένη:
 * ευρετήριο ({@link buildMergeIndex}), διάταξη (`table-layout-place.ts`), παράλειψη εσωτερικών
 * περιγραμμάτων (`table-layout-borders.ts` `sameMerge`), πλοήγηση δρομέα
 * (`table-cell-navigation.ts`), κούμπωμα επιλογής (`table-range-merge-snap.ts`), μεγάλωμα σε
 * εισαγωγή γραμμής (`table-row-column-ops.ts`), μεταφορά περιοχής
 * (`table-range-transfer-plan.ts`), ακόμη και προειδοποίηση επικόλλησης (`skippedMergedCells`).
 *
 * Και όμως το `build-table-entity.ts` έγραφε `merges: []` και **κανείς δεν το άλλαζε ποτέ**:
 * οκτώ αναγνώστες μιας τιμής που ήταν μονίμως κενή. Δεν έλειπε ένα κουμπί — έλειπε η **εγγραφή**.
 * Είναι το ίδιο σχήμα με το «0 σημαίνει *κανείς δεν κοίταξε*, όχι *καθαρό*» των πυλών: ένα
 * πράσινο test πάνω σε αυτή τη διαδρομή θα επιβεβαίωνε μόνο ότι η νεκρή υποδομή παραμένει
 * συνεπής με τον εαυτό της. Γι' αυτό το test αυτού του αρχείου φτάνει μέχρι το `layoutTable`.
 *
 * ## Πού ΔΕΝ ζει η γνώση
 * Το **κούμπωμα** (ποια όρια δίνει μια επιλογή που αγγίζει συγχώνευση) μένει στο
 * `table-range-merge-snap.ts`, όπου ήταν. Εδώ φτάνουν όρια **ήδη** κουμπωμένα· ο φύλακας του
 * βήματος 1 υπάρχει επειδή τα όρια μπορούν να φτάσουν και από δρόμο που δεν κουμπώνει, όχι
 * επειδή η απόφαση ξαναπαίρνεται.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-merge-ops
 * @see bim/table/table-range-merge-snap.ts — το ορθογώνιο ενός span (`mergeSpanBounds`) και το κούμπωμα
 * @see bim/table/table-cell-content.ts — ο μαζικός γραφέας κελιών (`clearPersistedCells`)
 * @see docs/centralized-systems/reference/adrs/ADR-755-table-cell-merge.md
 */

import type {
  CellSpan,
  PersistedTableModel,
  TableCell,
  TableCellAlign,
  TableColumnId,
  TableRowId,
} from '../../types/table';
import type { TableCellRangeBounds } from './table-cell-range';
import type { TableRectBounds } from './table-range-merge-snap';
import { mergeSpanBounds, tableRectsIntersect } from './table-range-merge-snap';
import { cellText, clearPersistedCells, writePersistedCells } from './table-cell-content';
import { indexById } from './table-model-helpers';

// ──────────────────────────────────────────────────────────────────────────────
// Το μητρώο
// ──────────────────────────────────────────────────────────────────────────────

/** Οι ταυτότητες των τεσσάρων. Αγγλικές και σταθερές: είναι **κλειδιά**, όχι ετικέτες. */
export type TableMergeCommandId = 'mergeCenter' | 'mergeAcross' | 'merge' | 'unmerge';

/**
 * Τι κάνει μια εντολή, σε **τρεις ορθογώνιες ερωτήσεις** αντί για τέσσερις κλάδους `switch`.
 *
 * Η κατάργηση δεν είναι «η πέμπτη περίπτωση»: είναι το `joins: false` — δηλαδή ακριβώς η ίδια
 * πράξη με τα υπόλοιπα βήματα (καθάρισε ό,τι τέμνεται) χωρίς το τελευταίο (γράψε το νέο).
 */
export interface TableMergeCommand {
  readonly id: TableMergeCommandId;
  /** Γράφει νέα συγχώνευση; `false` **μόνο** για την κατάργηση. */
  readonly joins: boolean;
  /** Μία συγχώνευση **ανά γραμμή** της περιοχής, αντί για μία συνολικά. */
  readonly perRow: boolean;
  /** Κεντράρει **οριζόντια** την άγκυρα — ποτέ κάθετα (δες {@link centeredAlign}). */
  readonly center: boolean;
}

/**
 * Οι τέσσερις, στη σειρά του Excel: πρώτη η σύνθετη που είναι και η προεπιλογή του κουμπιού,
 * τελευταία η κατάργηση — η **ίδια** δραματουργία με τις 13 του πλέγματος και τις 4 των
 * διαγωνίων, όπου η αφαίρεση δεν κάθεται ποτέ πρώτη.
 */
export const TABLE_MERGE_COMMANDS: readonly TableMergeCommand[] = [
  { id: 'mergeCenter', joins: true, perRow: false, center: true },
  { id: 'mergeAcross', joins: true, perRow: true, center: false },
  { id: 'merge', joins: true, perRow: false, center: false },
  { id: 'unmerge', joins: false, perRow: false, center: false },
];

const COMMANDS_BY_ID: ReadonlyMap<TableMergeCommandId, TableMergeCommand> = new Map(
  TABLE_MERGE_COMMANDS.map((command) => [command.id, command]),
);

/**
 * Η **προεπιλογή του κουμπιού** όταν δεν υπάρχει ήδη συγχώνευση.
 *
 * Ονομασμένη σταθερά και όχι γραμμένη στο JSX: το κύριο μισό του split button και το toggle
 * του toolbar πρέπει να συμφωνούν πάντα για το τι κάνει «σκέτο κλικ», και δύο σημεία που
 * γράφουν `'mergeCenter'` είναι δύο σημεία που μπορούν κάποτε να μη συμφωνούν.
 */
export const TABLE_MERGE_PRIMARY_COMMAND: TableMergeCommandId = 'mergeCenter';

// ──────────────────────────────────────────────────────────────────────────────
// Ανάγνωση — τι δείχνει το κουμπί
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τι ξέρει το χειριστήριο για την **τρέχουσα** περιοχή.
 *
 * Δύο ορθογώνιες ερωτήσεις, όχι μία: «υπάρχει συγχώνευση να καταργηθεί;» και «υπάρχει κάτι
 * να συγχωνευτεί;». Σε περιοχή 1×1 **χωρίς** συγχώνευση και οι δύο είναι ψευδείς — και είναι
 * σωστό: εκεί καμία από τις τέσσερις εντολές δεν έχει νόημα.
 */
export interface TableMergeState {
  /** Η περιοχή αγγίζει έστω μία συγχώνευση ⇒ η **κατάργηση** έχει τι να κάνει. */
  readonly merged: boolean;
  /** Η περιοχή έχει ≥ 2 κελιά ⇒ η **συγχώνευση** έχει τι να κάνει. */
  readonly canMerge: boolean;
}

/** Η κατάσταση του χειριστηρίου για μια περιοχή. Απαντιέται στο **άνοιγμα**, όχι σε κάθε απόδοση. */
export function tableMergeState(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): TableMergeState {
  const rect = clampToGrid(model, bounds);
  if (!rect) return { merged: false, canMerge: false };
  return {
    merged: intersectingSpans(model, rect).length > 0,
    canMerge: rect.lastRow > rect.firstRow || rect.lastCol > rect.firstCol,
  };
}

/**
 * Πόσα κελιά **με περιεχόμενο** θα χαθούν αν εκτελεστεί η εντολή.
 *
 * Ο αριθμός τροφοδοτεί τον διάλογο επιβεβαίωσης: η οδηγία της Nielsen Norman για καταστροφικές
 * ενέργειες ζητά *«Delete 3 issues?»* αντί για «Are you sure?» — ο χρήστης δεν μπορεί να κρίνει
 * ρίσκο που δεν του μετρήθηκε. Το Excel ρωτά **χωρίς** αριθμό· εδώ το κόστος του είναι μηδέν,
 * γιατί τα κελιά που χάνονται τα ξέρουμε ούτως ή άλλως (είναι αυτά ακριβώς που θα αδειάσουν).
 *
 * `0` για την **κατάργηση**: το ξήλωμα μιας συγχώνευσης δεν σβήνει ποτέ τίποτα — το περιεχόμενο
 * ζει ήδη ολόκληρο στην άγκυρα.
 */
export function tableMergeDiscardedCells(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  commandId: TableMergeCommandId,
): number {
  const plan = planMerge(model, bounds, commandId);
  if (!plan) return 0;

  const discarded = new Set(plan.covered.map(keyOf));
  if (discarded.size === 0) return 0;

  let count = 0;
  for (const [rowId, colId, cell] of model.cells) {
    if (discarded.has(`${rowId} ${colId}`) && hasContent(cell)) count += 1;
  }
  return count;
}

// ──────────────────────────────────────────────────────────────────────────────
// Η πράξη
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Εφαρμόζει μία από τις τέσσερις εντολές πάνω στην περιοχή.
 *
 * ## Τα τρία βήματα, με αυτή τη σειρά
 * 1. **Καθάρισε** κάθε υπάρχουσα συγχώνευση που τέμνει την περιοχή. Χωρίς αυτό, μια δεύτερη
 *    συγχώνευση πάνω σε υπάρχουσα θα άφηνε **δύο** άγκυρες να διεκδικούν τα ίδια κελιά, και το
 *    {@link buildMergeIndex} θα έδινε αποτέλεσμα που εξαρτάται από τη **σειρά** του πίνακα.
 * 2. **Γράψε** τη νέα (ή τις νέες, στο `mergeAcross`) — παραλείποντας κάθε 1×1, που δεν είναι
 *    συγχώνευση και το ευρετήριο ούτως ή άλλως την αγνοεί.
 * 3. **Άδειασε** τα καλυμμένα κελιά και, αν η εντολή το ζητά, **κεντράρισε** την άγκυρα.
 *
 * ## 🔴 Γιατί τα καλυμμένα κελιά ΑΔΕΙΑΖΟΥΝ — αντίθετα από τις διαγωνίους
 * Η Α16 του ADR-750 λέει για τα περιγράμματα και τις διαγωνίους: «γράφονται **όλα**, και η
 * **δομή** αποφασίζει τι φαίνεται· έτσι, όταν λυθεί η συγχώνευση, εμφανίζεται ό,τι ζήτησε ο
 * χρήστης». Εδώ ισχύει το αντίστροφο, και η διαφορά είναι κατηγορική: εκείνα είναι
 * **μορφοποίηση**, αυτό είναι **περιεχόμενο**.
 *
 * Κείμενο που «κρύβεται» κάτω από μια συγχώνευση και ξαναεμφανίζεται μήνες αργότερα σε ένα
 * ξήλωμα είναι δεδομένο-φάντασμα: δεν βγαίνει σε καμία εξαγωγή, δεν το βρίσκει καμία
 * αναζήτηση, και ο χρήστης έχει προ πολλού πιστέψει ότι δεν υπάρχει. Γι' αυτό το Excel το
 * πετά **ρητά** — και γι' αυτό ακριβώς προειδοποιεί πρώτα ({@link tableMergeDiscardedCells}).
 *
 * Επιστρέφει το **ίδιο** μοντέλο by-reference όταν τίποτα δεν αλλάζει: «ίδια συγχώνευση δεύτερη
 * φορά ⇒ κανένα βήμα undo».
 *
 * @param anchorAlign Η στοίχιση που **ισχύει σήμερα** στο κελί-άγκυρα, επιλυμένη από το στυλ.
 *   Χρειάζεται μόνο η `mergeCenter` και μόνο για να κρατήσει την **κάθετη** ζώνη — δες
 *   {@link centeredAlign} για το γιατί δεν μαντεύεται.
 */
export function applyTableMergeCommand(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  commandId: TableMergeCommandId,
  anchorAlign: TableCellAlign,
): PersistedTableModel {
  const plan = planMerge(model, bounds, commandId);
  if (!plan) return model;

  // 🔴 Η σύγκριση είναι **σημασιολογική**, όχι «άγγιξα κάτι;». Η ίδια συγχώνευση δεύτερη φορά
  // αφαιρεί ένα span και γράφει ισοδύναμο: μετρημένο ως «αλλαγή» θα γεννούσε βήμα undo που δεν
  // αναιρεί τίποτα ορατό — ακριβώς η τέταρτη εγγύηση του γραφέα κελιών, ένα επίπεδο ψηλότερα.
  const mergesChanged = !sameSpans(plan.removed, plan.added);
  const nextMerges = mergesChanged
    ? [...model.merges.filter((span) => !plan.removed.includes(span)), ...plan.added]
    : model.merges;

  const afterCells = writeCells(model, plan, anchorAlign);
  if (!mergesChanged && afterCells === model) return model;
  return mergesChanged ? { ...afterCells, merges: nextMerges } : afterCells;
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — το σχέδιο
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ό,τι θα συμβεί, υπολογισμένο **μία** φορά.
 *
 * Το ίδιο σχέδιο τροφοδοτεί και τη μέτρηση («πόσα κελιά χάνονται;») και την εκτέλεση. Δύο
 * ξεχωριστοί υπολογισμοί θα ήταν δύο ευκαιρίες να διαφωνήσουν — δηλαδή ένας διάλογος που
 * προειδοποιεί για 3 κελιά ενώ σβήνονται 5.
 */
interface MergePlan {
  /** Υπάρχουσες συγχωνεύσεις που φεύγουν (by-reference στα στοιχεία του `model.merges`). */
  readonly removed: readonly CellSpan[];
  /** Νέες συγχωνεύσεις που γράφονται· κενό για την κατάργηση. */
  readonly added: readonly CellSpan[];
  /** Τα κελιά που θα **καλυφθούν** — αδειάζουν, γιατί το περιεχόμενο ζει στην άγκυρα. */
  readonly covered: readonly CellRef[];
  /** Οι άγκυρες που θα **κεντραριστούν**· κενό όταν η εντολή δεν κεντράρει. */
  readonly centered: readonly CellRef[];
}

interface CellRef {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
}

/** `null` όταν η εντολή δεν υπάρχει ή η περιοχή δεν πέφτει καθόλου μέσα στο πλέγμα. */
function planMerge(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  commandId: TableMergeCommandId,
): MergePlan | null {
  const command = COMMANDS_BY_ID.get(commandId);
  if (!command) return null;
  const rect = clampToGrid(model, bounds);
  if (!rect) return null;

  const removed = intersectingSpans(model, rect);
  const planned = command.joins ? plannedSpans(model, rect, command) : [];

  const covered: CellRef[] = [];
  const centered: CellRef[] = [];
  for (const { rect: spanRect } of planned) {
    for (let r = spanRect.firstRow; r <= spanRect.lastRow; r += 1) {
      for (let c = spanRect.firstCol; c <= spanRect.lastCol; c += 1) {
        const ref = { rowId: model.rows[r].id, colId: model.columns[c].id };
        if (r === spanRect.firstRow && c === spanRect.firstCol) {
          if (command.center) centered.push(ref);
        } else {
          covered.push(ref);
        }
      }
    }
  }

  return { removed, added: planned.map((entry) => entry.span), covered, centered };
}

/**
 * Οι νέες συγχωνεύσεις της εντολής: **μία** για το ορθογώνιο, ή **μία ανά γραμμή** για το
 * `mergeAcross`.
 *
 * Τα 1×1 πέφτουν εδώ και όχι στον αναγνώστη: το {@link buildMergeIndex} τα αγνοεί ήδη, αλλά
 * γραμμένα στο μοντέλο θα ταξίδευαν σε κάθε αποθήκευση, θα εμφανίζονταν σε κάθε diff και θα
 * έκαναν το «συγχώνευσε μία στήλη κατά γραμμές» να γράφει N άχρηστες εγγραφές. Η
 * `mergeAcross` πάνω σε **μία** στήλη είναι ακριβώς αυτή η περίπτωση, και είναι φυσιολογική
 * κίνηση χρήστη — όχι ακραία.
 */
function plannedSpans(
  model: PersistedTableModel,
  rect: TableCellRangeBounds,
  command: TableMergeCommand,
): readonly PlannedSpan[] {
  const colSpan = rect.lastCol - rect.firstCol + 1;
  const anchorColId = model.columns[rect.firstCol].id;

  if (!command.perRow) {
    const rowSpan = rect.lastRow - rect.firstRow + 1;
    if (rowSpan === 1 && colSpan === 1) return [];
    return [{
      span: { anchorRowId: model.rows[rect.firstRow].id, anchorColId, rowSpan, colSpan },
      rect,
    }];
  }

  if (colSpan === 1) return [];
  const planned: PlannedSpan[] = [];
  for (let r = rect.firstRow; r <= rect.lastRow; r += 1) {
    planned.push({
      span: { anchorRowId: model.rows[r].id, anchorColId, rowSpan: 1, colSpan },
      rect: { firstRow: r, lastRow: r, firstCol: rect.firstCol, lastCol: rect.lastCol },
    });
  }
  return planned;
}

/**
 * Μια σχεδιαζόμενη συγχώνευση **μαζί με το ορθογώνιό της**.
 *
 * Το ορθογώνιο ταξιδεύει δίπλα στο span αντί να ξαναϋπολογιστεί από το {@link mergeSpanBounds}:
 * εκείνο ψάχνει την άγκυρα σε ευρετήριο, ενώ εδώ οι δείκτες είναι ήδη στο χέρι — μια
 * `mergeAcross` πάνω σε 500 γραμμές θα έκανε 500 αναζητήσεις για κάτι που μόλις μετρήσαμε.
 * Είναι επίσης εξ ορισμού μέσα στο κουμπωμένο `rect`, άρα δεν χρειάζεται δεύτερη περικοπή.
 */
interface PlannedSpan {
  readonly span: CellSpan;
  readonly rect: TableCellRangeBounds;
}

/** Οι υπάρχουσες συγχωνεύσεις που **αγγίζουν** το ορθογώνιο — αυτές που φεύγουν. */
function intersectingSpans(
  model: PersistedTableModel,
  rect: TableRectBounds,
): readonly CellSpan[] {
  if (model.merges.length === 0) return [];
  const rowIndex = indexById(model.rows);
  const colIndex = indexById(model.columns);

  return model.merges.filter((span) => {
    const spanRect = mergeSpanBounds(model, rowIndex, colIndex, span);
    return spanRect !== null && tableRectsIntersect(rect, spanRect);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — η εγγραφή κελιών
// ──────────────────────────────────────────────────────────────────────────────

/** Άδειασμα των καλυμμένων + κεντράρισμα των αγκυρών, σε **δύο** περάσματα του μαζικού γραφέα. */
function writeCells(
  model: PersistedTableModel,
  plan: MergePlan,
  anchorAlign: TableCellAlign,
): PersistedTableModel {
  const emptied = clearPersistedCells(model, plan.covered);
  if (plan.centered.length === 0) return emptied;

  const align = centeredAlign(anchorAlign);
  return writePersistedCells(emptied, plan.centered, {
    update: (existing) =>
      existing.styleOverride?.align === align
        ? null
        : { ...existing, styleOverride: { ...existing.styleOverride, align } },
    // Κενό κελί **αποκτά** εγγραφή εδώ, σε αντίθεση με το άδειασμα: η στοίχιση είναι κατάσταση
    // που ο χρήστης ζήτησε ρητά και πρέπει να επιβιώσει, ακόμη κι αν πληκτρολογήσει αργότερα.
    create: () => ({ kind: 'text', value: '', styleOverride: { align } }),
  });
}

/**
 * 🔑 Η κεντραρισμένη μορφή μιας στοίχισης — **μόνο το οριζόντιο γράμμα αλλάζει**.
 *
 * Το `TableCellAlign` είναι μία τιμή 9 θέσεων (`TL`…`BR`), δηλαδή η κάθετη και η οριζόντια
 * συνιστώσα ζουν στο **ίδιο** πεδίο. Το Excel «Συγχώνευση και κεντράρισμα» αγγίζει μόνο την
 * οριζόντια· γράφοντας σκέτο `'MC'` θα σέρναμε μαζί και μια κάθετη απόφαση που κανείς δεν
 * ζήτησε — μια συγχωνευμένη κεφαλίδα με στοίχιση κορυφής (`TL`) θα κατέβαινε ξαφνικά στη μέση.
 *
 * Γι' αυτό η σημερινή στοίχιση φτάνει ως **όρισμα** αντί να μαντεύεται: τα presets δίνουν
 * `'ML'` σε άλλες κλάσεις γραμμής και `'TL'` σε άλλες (`table-style-presets.ts`), οπότε δεν
 * υπάρχει «η προεπιλογή» να γραφτεί εδώ ως σταθερά.
 */
function centeredAlign(align: TableCellAlign): TableCellAlign {
  return `${align.charAt(0)}C` as TableCellAlign;
}

/**
 * Τα όρια, κομμένα στο πραγματικό πλέγμα· `null` όταν δεν μένει τίποτα.
 *
 * Μπαγιάτικα όρια (επιλογή που δείχνει σε γραμμή σβησμένη από undo) **κόβονται** αντί να
 * ρίξουν σφάλμα — η ίδια ανοχή με το `cellsInBounds` των διαγωνίων και με το
 * `tableRangeSideEdges`.
 */
function clampToGrid(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): TableCellRangeBounds | null {
  const firstRow = Math.max(bounds.firstRow, 0);
  const firstCol = Math.max(bounds.firstCol, 0);
  const lastRow = Math.min(bounds.lastRow, model.rows.length - 1);
  const lastCol = Math.min(bounds.lastCol, model.columns.length - 1);
  if (lastRow < firstRow || lastCol < firstCol) return null;
  return { firstRow, lastRow, firstCol, lastCol };
}

/**
 * Ίδιο **σύνολο** συγχωνεύσεων; Σύγκριση κατά τιμή, ανεξάρτητη σειράς.
 *
 * Η ταυτότητα by-reference δεν αρκεί εδώ: τα `added` είναι πάντα φρέσκα αντικείμενα, οπότε μια
 * εντολή που ξαναγράφει ό,τι υπάρχει ήδη θα φαινόταν πάντα «αλλαγή».
 */
function sameSpans(a: readonly CellSpan[], b: readonly CellSpan[]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(spanKey));
  return keys.size === b.length && b.every((span) => keys.has(spanKey(span)));
}

const spanKey = (span: CellSpan): string =>
  `${span.anchorRowId} ${span.anchorColId} ${span.rowSpan} ${span.colSpan}`;

/** Έχει το κελί κάτι να χάσει; Κενό κείμενο **και** χωρίς τύπο ⇒ όχι. */
function hasContent(cell: TableCell): boolean {
  return cell.kind === 'formula' || cellText(cell) !== '';
}

const keyOf = (ref: CellRef): string => `${ref.rowId} ${ref.colId}`;
