/**
 * 🔴 ADR-767 §5 — **Η ΑΝΑΝΕΩΣΗ**: η μία διαδρομή από την πηγή στα κελιά.
 *
 * ```
 * «ΑΝΑΝΕΩΣΗ»  (μόνο ρητή ενέργεια — Δ3· ο πίνακας δεν ξαναγεμίζει ΠΟΤΕ μόνος του)
 *    ├─ (1) ΕΠΙΛΥΣΗ      sourceRef ──► ExportableTable      [ΚΑΜΙΑ νέα παραγωγή δεδομένων]
 *    ├─ (2) ΑΠΟΤΥΠΩΜΑ    fingerprint(…) ──► νέο revision
 *    │        └─ ΙΔΙΟ με το αποθηκευμένο ⇒ early cutoff: ΤΕΛΟΣ, τίποτα δεν αλλάζει
 *    ├─ (3) ΓΡΑΦΗ        cells[row][col.sourceKey]          [ΠΟΤΕ πάνω σε παράκαμψη]
 *    └─ (4) ΕΠΑΝΑΫΠΟΛΟΓΙΣΜΟΣ  commitCellWrites(...)         [ADR-764 — ΥΠΟΧΡΕΩΤΙΚΟ]
 * ```
 *
 * ## Γιατί ΜΟΝΟ με ρητή ενέργεια (Δ3)
 * Δεν γεννιέται δεύτερη μηχανική: είναι **ακριβώς** το idiom που εφαρμόζει ήδη το ADR-745 (pull
 * με ρητό trigger). Η απάντηση στο «ποιος κηρύσσει *άλλαξα*;» γίνεται: **κανείς ενεργά — ο
 * πίνακας ξαναρωτάει όταν του ζητηθεί.** Συνέπεια που πρέπει να ειπωθεί: ο μετρητής του
 * `SceneStore` (ανά level) **δεν χρειάζεται** να γίνει ανά οντότητα για τη Φ.ΣΤ. Αυτό είναι
 * ερώτημα της Φ.Η — ⛔ μην το χτίσεις προληπτικά.
 *
 * ## 🔑 Το βήμα (4) είναι δωρεάν — και υποχρεωτικό
 * Το ADR-764 έκλεισε την κλάση «γραφή χωρίς επαναϋπολογισμό»· γι' αυτό ήταν το Βήμα 1. Ο
 * resolver **δεν** επιτρέπεται να παραδώσει μοντέλο χωρίς `commitCellWrites`, και δεν μπορεί:
 * ο γραφέας επιστρέφει `PendingCellWrites`, που **δεν είναι μοντέλο**. Το έκτο δείγμα της §47
 * δεν είναι απαγορευμένο — είναι μη εκφράσιμο.
 *
 * @module subapps/dxf-viewer/bim/table/binding/table-binding-refresh
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §5
 */

import { commitCellWrites } from '../formula/table-formula-engine';
import type { TableFormulaWorkbook } from '../formula/table-formula-workbook';
import { fingerprintExportableTable } from './table-binding-fingerprint';
import { resolveTableSource } from './table-source-resolver';
import { applyBoundSourceToCells, hasBoundColumns } from './table-binding-cells';
import type { BoundRowCoverage } from './table-binding-cells';
import type { TableSourceContext, TableSourceResolution } from './table-source-resolver';
import type { CellWriteTarget } from '../table-cell-content';
import type { PersistedTableModel, TableBinding } from '../../../types/table';

export interface TableBindingRefreshInput {
  /**
   * 🔴 ADR-833 Φάση 7 — **το βιβλίο ταξιδεύει με το αίτημα**, όπως ήδη ο στόχος (ADR-769 Α22).
   * Η ανανέωση γράφει κελιά και **χρεώνεται** τον επαναϋπολογισμό (§47.5)· ένας τύπος που
   * διαβάζει άλλο φύλλο δεν επιτρέπεται να γίνει `#REF!` επειδή η γέφυρα δεδομένων δεν ήξερε
   * ότι υπάρχουν άλλα φύλλα.
   */
  readonly book: TableFormulaWorkbook;
  readonly model: PersistedTableModel;
  readonly binding: TableBinding;
  readonly context: TableSourceContext;
}

/**
 * 🏆 **Early cutoff** (Δ5 · Salsa «backdating»): τα δεδομένα βγήκαν ίδια ⇒ **τίποτα δεν αλλάζει.**
 *
 * Το `model` και το `binding` επιστρέφονται **by-reference**. Δεν είναι βελτιστοποίηση:
 * καινούριο αντικείμενο σημαίνει βήμα undo για το τίποτα και ακύρωση κάθε `WeakMap` που κρέμεται
 * από το μοντέλο (§8 #2) — και, το κυριότερο, σημαίνει ένδειξη «άλλαξε» που ο χρήστης θα μάθει
 * να αγνοεί.
 */
export interface TableBindingUnchanged {
  readonly status: 'unchanged';
  readonly model: PersistedTableModel;
  readonly binding: TableBinding;
}

export interface TableBindingRefreshed {
  readonly status: 'refreshed';
  readonly model: PersistedTableModel;
  /** Με **νέο** `revision` — το αποτύπωμα των δεδομένων που μόλις γράφτηκαν. */
  readonly binding: TableBinding;
  /** Παρακαμμένα κελιά που βρήκαν **άλλη** τιμή στην πηγή. Δηλώνονται, ποτέ δεν πατιούνται. */
  readonly conflicts: readonly CellWriteTarget[];
  /** `sourceKey` στηλών που η πηγή δεν έχει. */
  readonly unknownSourceKeys: readonly string[];
  readonly rowCoverage: BoundRowCoverage;
}

/** Η πηγή δεν απάντησε — το μοντέλο **δεν αγγίζεται** και ο λόγος λέγεται. */
export interface TableBindingUnresolved {
  readonly status: 'unresolved';
  readonly model: PersistedTableModel;
  readonly binding: TableBinding;
  readonly reason: Exclude<TableSourceResolution['status'], 'resolved'>;
}

/**
 * Ο πίνακας δηλώνει δεσμό αλλά **καμία στήλη του δεν έχει `sourceKey`** — δεν υπάρχει πού να
 * γραφτούν τα δεδομένα.
 *
 * Ρητή κατάσταση και όχι «πέτυχε χωρίς αλλαγές»: είναι διαμόρφωση που ο χρήστης πρέπει να
 * διορθώσει (να πει ποια στήλη διαβάζει τι), όχι φυσιολογική έκβαση.
 */
export interface TableBindingNoBoundColumns {
  readonly status: 'no-bound-columns';
  readonly model: PersistedTableModel;
  readonly binding: TableBinding;
}

export type TableBindingRefreshResult =
  | TableBindingUnchanged
  | TableBindingRefreshed
  | TableBindingUnresolved
  | TableBindingNoBoundColumns;

/**
 * Εκτελεί τα τέσσερα βήματα του §5. Καθαρή συνάρτηση: μηδέν store, μηδέν I/O, μηδέν ρολόι.
 *
 * ⚠️ Το early cutoff ελέγχεται **πριν** τη γραφή, με το αποτύπωμα — όχι μετά, συγκρίνοντας
 * μοντέλα. Έτσι η ακριβή διαδρομή (γραφή + επαναϋπολογισμός γράφου τύπων) δεν τρέχει καν όταν
 * δεν υπάρχει λόγος.
 */
export function refreshTableBinding(input: TableBindingRefreshInput): TableBindingRefreshResult {
  const { model, binding, context } = input;

  const resolution = resolveTableSource(binding.sourceRef, context);
  if (resolution.status !== 'resolved') {
    return { status: 'unresolved', model, binding, reason: resolution.status };
  }
  if (!hasBoundColumns(model)) return { status: 'no-bound-columns', model, binding };

  const revision = fingerprintExportableTable(resolution.table);
  if (revision === binding.revision) return { status: 'unchanged', model, binding };

  const fill = applyBoundSourceToCells(model, resolution.table);
  return {
    status: 'refreshed',
    model: commitCellWrites(input.book, fill.pending),
    binding: { ...binding, revision },
    conflicts: fill.conflicts,
    unknownSourceKeys: fill.unknownSourceKeys,
    rowCoverage: fill.rowCoverage,
  };
}
