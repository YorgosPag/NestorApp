/**
 * 🏆 ADR-767 Δ2 — **η παράκαμψη ΔΕΝ σπάει τον δεσμό** (μοντέλο Figma).
 *
 * Ο χρήστης ξεκλειδώνει ρητά ένα δεμένο κελί (η χειρονομία του AutoCAD, όπου το ξεκλείδωμα
 * είναι συνειδητή πράξη) και γράφει. Αλλά τότε, σε αντίθεση με κάθε μεγάλο:
 *
 * - η τιμή αποθηκεύεται **ΠΑΝΩ** από τον δεσμό, ποτέ **αντί** αυτού — ο δεσμός επιβιώνει
 * - η παράκαμψη είναι **ορατή** (δεν μαντεύεται — ADR-745 Α4)
 * - υπάρχει **«Επαναφορά στην πηγή»**, ανά κελί *και* συνολικά (Figma: per-property reset +
 *   «Reset all changes»)
 * - αν η πηγή αλλάξει από κάτω, ο πίνακας **δηλώνει σύγκρουση** — δεν σβήνει σιωπηλά καμία
 *   από τις δύο τιμές
 *
 * ## Γιατί αυτό είναι καλύτερο από το status quo
 * Το **Excel** σβήνει τον τύπο σιωπηλά μόλις πληκτρολογήσεις πάνω του. Το **AutoCAD**, μετά το
 * ξεκλείδωμα, σε πατάει στο επόμενο `DATALINKUPDATE`. Και τα δύο είναι δυαδικά: *ή
 * κλειδωμένο-και-ασφαλές ή γραμμένο-και-αποσυνδεδεμένο*. Κρατώντας **και τις δύο** πληροφορίες,
 * ο δεσμός μένει ζωντανός για μελλοντική συμφιλίωση αντί να γίνει απώλεια.
 *
 * ⚠️ Όλες οι πράξεις που αλλάζουν **περιεχόμενο** επιστρέφουν {@link PendingCellWrites} — χρωστούν
 * `commitCellWrites` (ADR-764). Μόνο η {@link keepOverrideOverSource} επιστρέφει σκέτο μοντέλο,
 * και αυτό είναι δηλωμένη σημασιολογία: αγγίζει **μόνο** μεταδεδομένα δεσμού, καμία τιμή.
 *
 * @module subapps/dxf-viewer/bim/table/binding/table-binding-override
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ2
 */

import { writePersistedCells, writePersistedCellStyles } from '../table-cell-content';
import type { CellWriteTarget, PendingCellWrites } from '../table-cell-content';
import type { ScheduleCellValue } from '../../schedule/types';
import type {
  PersistedTableModel,
  TableCell,
  TableColumnId,
  TableRowId,
} from '../../../types/table';

/** Κελιά που έχουν **ανθρώπινη** παράκαμψη — ο στόχος κάθε συνολικής πράξης. */
function overriddenTargets(model: PersistedTableModel): CellWriteTarget[] {
  return model.cells
    .filter(([, , cell]) => cell.bound?.overridden === true)
    .map(([rowId, colId]) => ({ rowId, colId }));
}

/**
 * Ο χρήστης ξεκλειδώνει και γράφει: η τιμή μπαίνει **πάνω** από τον δεσμό.
 *
 * Η βάση ({@link TableCellBinding.sourceValue}) μένει **άθικτη** — αυτή είναι όλη η ουσία: είναι
 * το merge base απέναντι στο οποίο θα κριθεί η επόμενη ανανέωση. Τυχόν εκκρεμής σύγκρουση
 * καθαρίζει, γιατί ο άνθρωπος μόλις αποφάσισε βλέποντας **και τις δύο** τιμές.
 *
 * Κελί **χωρίς** δεσμό δεν αγγίζεται: η παράκαμψη είναι έννοια που υπάρχει μόνο πάνω σε δεσμό,
 * και ένα ελεύθερο κελί γράφεται ούτως ή άλλως από τη συνηθισμένη διαδρομή.
 */
export function overrideBoundCell(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
  value: ScheduleCellValue,
): PendingCellWrites {
  return writePersistedCells(model, [{ rowId, colId }], {
    update: (existing) => {
      const bound = existing.bound;
      if (bound === undefined) return null;
      return {
        ...existing,
        kind: 'text',
        value,
        formula: undefined,
        bound: { sourceValue: bound.sourceValue, overridden: true },
      };
    },
    create: () => null,
  });
}

/** Η κοινή πράξη «ξαναγίνε ό,τι λέει η πηγή» — ένα σώμα, δύο σημεία εισόδου. */
function toSourceValue(existing: TableCell): TableCell | null {
  const bound = existing.bound;
  if (bound === undefined || bound.overridden !== true) return null;
  return {
    ...existing,
    kind: 'text',
    value: bound.sourceValue,
    formula: undefined,
    bound: { sourceValue: bound.sourceValue },
  };
}

/**
 * **Επαναφορά στην πηγή — ένα κελί.** Η τιμή γίνεται ξανά της πηγής και το κελί ξανακλειδώνει.
 */
export function resetBoundCellToSource(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
): PendingCellWrites {
  return writePersistedCells(model, [{ rowId, colId }], {
    update: toSourceValue,
    create: () => null,
  });
}

/**
 * **Επαναφορά στην πηγή — ολόκληρος ο πίνακας** (το «Reset all changes» της Figma).
 *
 * Χωρίς καμία παράκαμψη επιστρέφει το **ίδιο** μοντέλο by-reference: η τέταρτη εγγύηση του
 * γραφέα ταξιδεύει αυτούσια, άρα καμία χειρονομία δεν γεννά βήμα undo για το τίποτα.
 */
export function resetAllBoundCellsToSource(model: PersistedTableModel): PendingCellWrites {
  return writePersistedCells(model, overriddenTargets(model), {
    update: toSourceValue,
    create: () => null,
  });
}

/**
 * **«Κράτα το δικό μου»** — η δεύτερη νόμιμη λύση μιας σύγκρουσης.
 *
 * Καθαρίζει **μόνο** τη σήμανση σύγκρουσης· η ανθρώπινη τιμή και ο δεσμός μένουν. Η βάση
 * παραμένει η **φρέσκια** τιμή της πηγής, ώστε μια μελλοντική αλλαγή της να ξαναδηλωθεί —
 * αλλιώς ο χρήστης θα έβλεπε την ίδια σύγκρουση για πάντα, ή θα έχανε την επόμενη.
 *
 * Επιστρέφει σκέτο μοντέλο επειδή **καμία τιμή δεν αλλάζει**: κανένας τύπος δεν γίνεται
 * μπαγιάτικος, άρα δεν χρωστάει επαναϋπολογισμό. Το ίδιο επιχείρημα με το
 * `writePersistedCellStyles` — και εκφρασμένο με τον ίδιο τρόπο, ως **τύπος επιστροφής**.
 */
export function keepOverrideOverSource(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
): PersistedTableModel {
  return writePersistedCellStyles(model, [{ rowId, colId }], {
    update: (existing) => {
      const bound = existing.bound;
      if (bound?.conflict !== true) return null;
      return { ...existing, bound: { sourceValue: bound.sourceValue, overridden: true } };
    },
    create: () => null,
  });
}
