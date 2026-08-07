/**
 * 🔴 ADR-767 §5 βήμα (3) — **τα δεδομένα της πηγής μπαίνουν στα κελιά**, με τριμερή συγχώνευση.
 *
 * Η αντιστοίχιση είναι αυτή που **υπάρχει ήδη** και δεν εφευρίσκεται εδώ:
 * `TableColumn.sourceKey` ↔ `ScheduleColumnDef.key` ↔ `ExportableTableRow.cells[key]`. Το
 * `col.key` είναι ήδη ο μόνος τρόπος που ένας καταναλωτής βρίσκει κελί — οι τρεις exporters
 * (csv/xlsx/pdf) διαβάζουν **αποκλειστικά** έτσι. Άρα ο δεσμός κουμπώνει χωρίς νέο σχήμα.
 *
 * ## Τι ΔΕΝ κάνει: δομικές πράξεις
 * Γράφει **τιμές σε υπάρχοντα κελιά**. Δεν προσθέτει και δεν σβήνει γραμμές, ακόμη κι όταν η
 * πηγή έχει περισσότερες — η απόκλιση **δηλώνεται** ({@link BoundFillResult.rowCoverage}) αντί
 * να «διορθωθεί». Ο λόγος δεν είναι φειδώ: η εισαγωγή γραμμής αλλάζει **ταυτότητες**, δηλαδή
 * είναι ακριβώς η κλάση που έκλεισε το ADR-764 (Βήμα 1), και το §5 του ADR-767 ορίζει τέσσερα
 * βήματα που δεν την περιλαμβάνουν. Αν την έκανε αυτός ο κώδικας, θα την έκανε ένας
 * μηχανισμός που κανείς δεν κάλεσε, πάνω σε τύπους που δείχνουν σε αυτές τις γραμμές.
 *
 * @module subapps/dxf-viewer/bim/table/binding/table-binding-cells
 * @see bim/table/table-cell-content.ts — `writePersistedCells`, η ΜΙΑ μηχανική τοποθέτησης
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ2
 */

import { writePersistedCells } from '../table-cell-content';
// 🔴 ADR-769 §11 — ο ΕΜΠΡΟΣ δρόμος των μονάδων, τον οποίο ο δεσμός δεν καλούσε ποτέ.
import { formatCellForXlsx } from '../../schedule/exporters/value-formatters';
import type { CellWrite, CellWriteTarget, PendingCellWrites } from '../table-cell-content';
import type {
  ExportableTable,
  ScheduleCellValue,
  ScheduleColumnValueType,
} from '../../schedule/types';
import type { PersistedTableModel, TableCell, TableRow, TableRowId } from '../../../types/table';

/** Πόσες γραμμές δεδομένων έχει ο πίνακας και πόσες έδωσε η πηγή — δήλωση, όχι διόρθωση. */
export interface BoundRowCoverage {
  readonly table: number;
  readonly source: number;
}

export interface BoundFillResult {
  /** 🔴 ΔΕΝ είναι μοντέλο: χρωστά `commitCellWrites` (ADR-764). */
  readonly pending: PendingCellWrites;
  /** `sourceKey` στηλών που η πηγή **δεν** έχει — ρητά ονομασμένα, ποτέ σιωπηλό κενό. */
  readonly unknownSourceKeys: readonly string[];
  /** Κελιά όπου η πηγή άλλαξε **κάτω από** ανθρώπινη παράκαμψη. */
  readonly conflicts: readonly CellWriteTarget[];
  readonly rowCoverage: BoundRowCoverage;
}

/**
 * 🔴 ADR-769 §11 — **δύο τιμές, δύο ερωτήσεις**, και η σύγχυσή τους ήταν το σφάλμα ×1000.
 *
 * - `raw`   — τι έδωσε η **πηγή**, σε μονάδες αποθήκης. Η βάση του CAS (Δ2/Δ3).
 * - `shown` — τι **βλέπει και γράφει ο άνθρωπος**, σε μονάδες οθόνης.
 *
 * Ταυτόσημες σε κάθε στήλη που δεν αλλάζει μονάδα (`text`, `count`) — και ακριβώς γι' αυτό η
 * διαφορά τους έμεινε αόρατη μέχρι να χρειαστεί ο πίνακας συντεταγμένων.
 */
interface BoundFreshValue {
  readonly raw: ScheduleCellValue;
  readonly shown: ScheduleCellValue;
}

/** Το κελί όπως το βλέπει ο γραφέας: ποια τιμή δίνει η πηγή τώρα, στις δύο όψεις της. */
type FreshByCell = ReadonlyMap<string, BoundFreshValue>;

/**
 * 🔴 **Η ΑΝΤΙΣΤΟΙΧΙΣΗ ΓΡΑΜΜΩΝ, ΣΕ ΕΝΑ ΣΗΜΕΙΟ** — η σειρά των γραμμών `data` **είναι** η σειρά
 * των γραμμών της πηγής (ADR-767 §5 βήμα 3· ADR-769 Δ3 «εντοπισμός με θέση»).
 *
 * Εξήχθη (ADR-769) επειδή η Φ.Η χρειάζεται την **αντίστροφη** ανάγνωση: «σε ποια γραμμή της
 * πηγής αντιστοιχεί αυτό το `rowId`;». Δύο υλοποιήσεις του ίδιου φίλτρου θα ήταν δύο ορισμοί
 * του «ποια γραμμή είναι δεδομένο» — και η πρώτη φορά που θα διαφωνούσαν, ο πίνακας θα
 * **μετακινούσε λάθος κορυφή**, δηλαδή η ακριβώς η βλάβη που το Δ3 υπάρχει για να αποκλείσει.
 */
export function boundDataRows(model: PersistedTableModel): readonly TableRow[] {
  return model.rows.filter((row) => row.rowClass === 'data');
}

/**
 * Ο δείκτης αυτής της γραμμής **μέσα στις γραμμές δεδομένων** — δηλαδή ο δείκτης της
 * αντίστοιχης γραμμής της πηγής. `-1` όταν η γραμμή δεν είναι δεδομένο (κεφαλίδα, σύνολο)
 * ή δεν υπάρχει: ρητό, ποτέ `0` που θα διαβαζόταν ως «η πρώτη».
 */
export function boundSourceRowIndex(model: PersistedTableModel, rowId: TableRowId): number {
  return boundDataRows(model).findIndex((row) => row.id === rowId);
}

const cellId = (target: CellWriteTarget): string => `${target.rowId} ${target.colId}`;

/**
 * 🔴 ADR-720 / §8 #8 — **κενό μένει κενό**.
 *
 * Ένας παραγωγός μπορεί να δώσει `undefined` (κλειδί που δεν γράφτηκε) ή `NaN` (διαίρεση χωρίς
 * δεδομένα). Και τα δύο σημαίνουν «δεν υπάρχει μέτρηση». Γράφοντάς τα ως `0` θα δηλώναμε
 * μέτρηση που κανείς δεν πήρε — και αυτό το `0` ρέει σε πίνακα συντεταγμένων που **υπογράφεται**
 * ή σε ποσότητα που γίνεται **τιμή**.
 */
function normalize(value: ScheduleCellValue | undefined): ScheduleCellValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

/**
 * 🔴 ADR-769 §11 — **Η ΜΟΝΑΔΑ ΤΗΣ ΟΘΟΝΗΣ, ΟΧΙ ΤΗΣ ΑΠΟΘΗΚΗΣ.**
 *
 * ## Το σφάλμα που κλείνει (μετρημένο με εκτέλεση, 08/08)
 * Μέχρι σήμερα ο δεσμός έγραφε στο κελί την **ωμή** τιμή της πηγής. Ο πίνακας συντεταγμένων
 * έδειχνε `391698400` — χιλιοστά — ενώ το **CSV και το PDF του ίδιου πίνακα** έδειχναν
 * `391698.400`. Δύο απαντήσεις στο «τι λέει αυτό το κελί», και η μία πάει στο παραδοτέο.
 *
 * Το ADR-769 Δ4 το ανέδειξε επειδή η γραφή **απαιτεί** την απάντηση: ο χρήστης γράφει ό,τι
 * βλέπει, οπότε αν η οθόνη λέει χιλιοστά και ο αντίστροφος μετατροπέας περιμένει μέτρα, κάθε
 * επεξεργασία πολλαπλασιάζει επί **1000**, σιωπηλά, σε πίνακα που **υπογράφεται**.
 *
 * ## Γιατί `formatCellForXlsx` και όχι `formatCellForDisplay`
 * Ο πρώτος κρατά **αριθμό** (`391698.4`), ο δεύτερος δίνει **κείμενο** (`"391698.400"`).
 * Αριθμός σημαίνει ότι οι τύποι (`SUM`) εξακολουθούν να αθροίζουν τη στήλη και ότι η
 * μορφοποίηση των δεκαδικών μένει δουλειά του ADR-760 (`numberFormat`), όπου ανήκει — αντί να
 * ψηθεί στο περιεχόμενο. 🏆 Και είναι **ο ίδιος** που ο `parseCellToStore` δηλώνει ρητά
 * αντίστροφό του: ο κύκλος ήταν σχεδιασμένος σωστά, έλειπε το μισό του.
 *
 * ⚠️ Το {@link TableCellBinding.sourceValue} μένει **ωμό** — είναι η βάση σύγκρισης με φρέσκια
 * ανάγνωση **της πηγής** (Δ2, merge base). Μορφοποιημένη βάση θα σύγκρινε μήλα με πορτοκάλια
 * και θα κήρυσσε σύγκρουση σε κάθε refresh.
 */
function shownValue(raw: ScheduleCellValue, valueType: ScheduleColumnValueType): ScheduleCellValue {
  return formatCellForXlsx(raw, valueType);
}

/**
 * Ποια κελιά γράφονται και με τι — ένα πέρασμα πάνω στις **δεμένες** στήλες × τις γραμμές
 * δεδομένων που η πηγή καλύπτει.
 */
function planWrites(model: PersistedTableModel, table: ExportableTable): {
  targets: CellWriteTarget[];
  fresh: Map<string, BoundFreshValue>;
  unknownSourceKeys: string[];
  rowCoverage: BoundRowCoverage;
} {
  const sourceColumns = new Map(table.columns.map((column) => [column.key, column]));
  const bound = model.columns.flatMap((column) =>
    column.sourceKey === undefined ? [] : [{ colId: column.id, sourceKey: column.sourceKey }]);
  const unknownSourceKeys = bound
    .filter((column) => !sourceColumns.has(column.sourceKey))
    .map((column) => column.sourceKey);

  const dataRows = boundDataRows(model);
  const covered = Math.min(dataRows.length, table.rows.length);

  const targets: CellWriteTarget[] = [];
  const fresh = new Map<string, BoundFreshValue>();
  for (let i = 0; i < covered; i += 1) {
    for (const column of bound) {
      const sourceColumn = sourceColumns.get(column.sourceKey);
      if (sourceColumn === undefined) continue;
      const target: CellWriteTarget = { rowId: dataRows[i].id, colId: column.colId };
      targets.push(target);
      const raw = normalize(table.rows[i].cells[column.sourceKey]);
      fresh.set(cellId(target), { raw, shown: shownValue(raw, sourceColumn.valueType) });
    }
  }

  return {
    targets,
    fresh,
    unknownSourceKeys,
    rowCoverage: { table: dataRows.length, source: table.rows.length },
  };
}

/**
 * 🏆 **Η τριμερής συγχώνευση** (Δ2), ως `CellWrite`.
 *
 * | Κατάσταση κελιού | Φρέσκια πηγή vs βάση | Αποτέλεσμα |
 * |---|---|---|
 * | χωρίς δεσμό / χωρίς παράκαμψη | — | γράφεται η φρέσκια τιμή· η βάση ανανεώνεται |
 * | με παράκαμψη | **ίδια** | `null` ⇒ **τίποτα δεν αλλάζει**, καμία ενόχληση |
 * | με παράκαμψη | **άλλαξε** | σύγκρουση: η ανθρώπινη τιμή μένει, η βάση γίνεται η φρέσκια |
 *
 * Η μεσαία γραμμή είναι ο λόγος που κρατάμε βάση: χωρίς αυτήν, **κάθε** refresh θα κήρυσσε
 * σύγκρουση σε κάθε παρακαμμένο κελί — αφού η παράκαμψη εξ ορισμού διαφέρει από την πηγή — και
 * η ένδειξη θα γινόταν θόρυβος μέσα σε μια μέρα.
 */
function boundCellWrite(fresh: FreshByCell): CellWrite {
  return {
    update: (existing, target) => {
      const { raw, shown } = freshAt(fresh, target);
      const bound = existing.bound;

      if (bound?.overridden !== true) {
        if (existing.value === shown && bound?.sourceValue === raw && existing.kind === 'text') return null;
        return { ...existing, kind: 'text', value: shown, formula: undefined, bound: { sourceValue: raw } };
      }

      // Παρακαμμένο: η ανθρώπινη τιμή δεν αγγίζεται ΠΟΤΕ από εδώ.
      if (bound.sourceValue === raw) return null;
      return { ...existing, bound: { sourceValue: raw, overridden: true, conflict: true } };
    },
    create: (target) => {
      const { raw, shown } = freshAt(fresh, target);
      return { kind: 'text', value: shown, bound: { sourceValue: raw } };
    },
  };
}

/** Κελί εκτός κάλυψης ⇒ **κενό και στις δύο όψεις** — ποτέ ωμό σε μία και κενό στην άλλη. */
function freshAt(fresh: FreshByCell, target: CellWriteTarget): BoundFreshValue {
  return fresh.get(cellId(target)) ?? { raw: null, shown: null };
}

/** Ποια παρακαμμένα κελιά θα βρουν **άλλη** τιμή στην πηγή — υπολογισμένο πριν τη γραφή. */
function findConflicts(
  model: PersistedTableModel,
  targets: readonly CellWriteTarget[],
  fresh: FreshByCell,
): CellWriteTarget[] {
  const cells = new Map<string, TableCell>(
    model.cells.map(([rowId, colId, cell]) => [cellId({ rowId, colId }), cell]),
  );
  return targets.filter((target) => {
    const bound = cells.get(cellId(target))?.bound;
    // Η σύγκρουση κρίνεται στην **ωμή** τιμή: η βάση συγκρίνεται με την πηγή, όχι με την οθόνη.
    return bound?.overridden === true && bound.sourceValue !== freshAt(fresh, target).raw;
  });
}

/**
 * Εφαρμόζει τα δεδομένα της πηγής στα δεμένα κελιά του μοντέλου.
 *
 * Επιστρέφει {@link PendingCellWrites} και **όχι** μοντέλο: η γραφή περιεχομένου χρωστά
 * επαναϋπολογισμό, και ο τύπος το επιβάλλει αντί να το θυμάται ο καλών (ADR-764).
 */
export function applyBoundSourceToCells(
  model: PersistedTableModel,
  table: ExportableTable,
): BoundFillResult {
  const plan = planWrites(model, table);
  return {
    pending: writePersistedCells(model, plan.targets, boundCellWrite(plan.fresh)),
    unknownSourceKeys: plan.unknownSourceKeys,
    conflicts: findConflicts(model, plan.targets, plan.fresh),
    rowCoverage: plan.rowCoverage,
  };
}

/** Έχει έστω μία στήλη που τρέφεται από πηγή; Αλλιώς η ανανέωση δεν έχει πού να γράψει. */
export function hasBoundColumns(model: PersistedTableModel): boolean {
  return model.columns.some((column) => column.sourceKey !== undefined);
}
