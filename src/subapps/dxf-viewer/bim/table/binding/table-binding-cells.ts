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
import type { CellWrite, CellWriteTarget, PendingCellWrites } from '../table-cell-content';
import type { ExportableTable, ScheduleCellValue } from '../../schedule/types';
import type { PersistedTableModel, TableCell } from '../../../types/table';

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

/** Το κελί όπως το βλέπει ο γραφέας: ποια τιμή δίνει η πηγή τώρα. */
type FreshByCell = ReadonlyMap<string, ScheduleCellValue>;

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
 * Ποια κελιά γράφονται και με τι — ένα πέρασμα πάνω στις **δεμένες** στήλες × τις γραμμές
 * δεδομένων που η πηγή καλύπτει.
 */
function planWrites(model: PersistedTableModel, table: ExportableTable): {
  targets: CellWriteTarget[];
  fresh: Map<string, ScheduleCellValue>;
  unknownSourceKeys: string[];
  rowCoverage: BoundRowCoverage;
} {
  const sourceKeys = new Set(table.columns.map((column) => column.key));
  const bound = model.columns.flatMap((column) =>
    column.sourceKey === undefined ? [] : [{ colId: column.id, sourceKey: column.sourceKey }]);
  const unknownSourceKeys = bound
    .filter((column) => !sourceKeys.has(column.sourceKey))
    .map((column) => column.sourceKey);

  const dataRows = model.rows.filter((row) => row.rowClass === 'data');
  const covered = Math.min(dataRows.length, table.rows.length);

  const targets: CellWriteTarget[] = [];
  const fresh = new Map<string, ScheduleCellValue>();
  for (let i = 0; i < covered; i += 1) {
    for (const column of bound) {
      if (!sourceKeys.has(column.sourceKey)) continue;
      const target: CellWriteTarget = { rowId: dataRows[i].id, colId: column.colId };
      targets.push(target);
      fresh.set(cellId(target), normalize(table.rows[i].cells[column.sourceKey]));
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
      const next = fresh.get(cellId(target)) ?? null;
      const bound = existing.bound;

      if (bound?.overridden !== true) {
        if (existing.value === next && bound?.sourceValue === next && existing.kind === 'text') return null;
        return { ...existing, kind: 'text', value: next, formula: undefined, bound: { sourceValue: next } };
      }

      // Παρακαμμένο: η ανθρώπινη τιμή δεν αγγίζεται ΠΟΤΕ από εδώ.
      if (bound.sourceValue === next) return null;
      return { ...existing, bound: { sourceValue: next, overridden: true, conflict: true } };
    },
    create: (target) => {
      const next = fresh.get(cellId(target)) ?? null;
      return { kind: 'text', value: next, bound: { sourceValue: next } };
    },
  };
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
    return bound?.overridden === true && bound.sourceValue !== (fresh.get(cellId(target)) ?? null);
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
