/**
 * ADR-739 Φάση Δ — Table tool options store (ribbon ⇄ placement).
 *
 * Κρατά τις τρεις επιλογές κατασκευής που το ενεργό εργαλείο `'table'` περνά στο
 * `buildTableEntity` στο κλικ: πλήθος στηλών, πλήθος γραμμών **δεδομένων**, πλάτος
 * στήλης (sheet-mm). Ο builder διαβάζει το **ζωντανό** στιγμιότυπο τη στιγμή της
 * ολοκλήρωσης (`getState()` — καμία συνδρομή, μοτίβο event-time ανάγνωσης του ADR-040),
 * ακριβώς όπως ο αδελφός `opening-info-tag-options-store`.
 *
 * ## Ποιος γράφει (ADR-739 §39)
 * Ο **επιλογέας μεγέθους του κουμπιού «Πίνακας»** στην καρτέλα *Εισαγωγή* —
 * `ui/ribbon/components/table/RibbonTableMenuWidget.tsx`, μέσω του `useTableSizeCommit`.
 *
 * ⚠️ Αυτή η γραμμή έλεγε επί μήνες «η contextual καρτέλα της ribbon τις γράφει». **Δεν
 * γράφτηκε ποτέ**: μέχρι το §39 ο store ήταν **νεκρός** — κανένα UI δεν τον άγγιζε και κάθε
 * πίνακας γεννιόταν αναγκαστικά με τις προεπιλογές. Το σχόλιο περιέγραφε πρόθεση, όχι κώδικα.
 *
 * Επίπεδο (χωρίς επίγνωση είδους): υπάρχει **ένα** εργαλείο πίνακα, άρα δεν υπάρχει
 * φέτα ανά είδος να ζογκλάρει. Το μενού δηλώνει **μέγεθος**, ποτέ περιεχόμενο: ο νέος
 * πίνακας παραμένει εντελώς κενός (απόφαση Giorgio 2026-08-04, βλ. `build-table-entity.ts`).
 *
 * @see bim/table/build-table-entity.ts — ο καταναλωτής (`BuildTableOptions`)
 * @see ui/ribbon/components/table/use-table-size-commit.ts — ο μοναδικός γραφέας
 * @see state/opening-info-tag-options-store.ts — το αδελφό μοτίβο που καθρεφτίζεται εδώ
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §4, §18
 */

import { create } from 'zustand';
import type { Point2D } from '../rendering/types/Types';
import type { TableEntity } from '../types/table-entity';
import {
  DEFAULT_TABLE_COLUMN_COUNT,
  DEFAULT_TABLE_COLUMN_WIDTH_MM,
  DEFAULT_TABLE_DATA_ROW_COUNT,
  buildTableEntity,
  sanitizeTableColumnCount,
  sanitizeTableColumnWidthMm,
  sanitizeTableDataRowCount,
} from '../bim/table/build-table-entity';

interface TableOptionsState {
  readonly columnCount: number;
  /** Γραμμές **δεδομένων** — ο τίτλος και η κεφαλίδα προστίθενται πάντα από τον builder. */
  readonly dataRowCount: number;
  readonly columnWidthMm: number;
  setColumnCount(columnCount: number): void;
  setDataRowCount(dataRowCount: number): void;
  setColumnWidthMm(columnWidthMm: number): void;
}

/**
 * 🔴 Οι setters **καθαρίζουν** — δεν αποθηκεύουν ωμούς αριθμούς.
 *
 * Ο store είναι δημόσιο API και η ribbon τον ταΐζει από αριθμητικά πεδία, όπου
 * `parseFloat('')` = `NaN` είναι το **κανονικό** αποτέλεσμα ενός πεδίου που ο χρήστης
 * άδειασε — όχι εξωτικό σενάριο. Χωρίς καθάρισμα εδώ, ένα `NaN` πλάτος περνά στη διάταξη,
 * βγάζει NaN bbox και — επειδή το `entity-bounds-ssot` **ενώνει** bboxes — δηλητηριάζει τα
 * όρια ΟΛΗΣ της σκηνής· ένα `Infinity` πλήθος στηλών παγώνει την καρτέλα σε άπειρο βρόχο.
 *
 * Ο κανόνας είναι **ένας** και ζει στο `build-table-entity.ts` δίπλα στις προεπιλογές
 * (`sanitizeTable*`): εδώ γίνεται μόνο η κλήση. Το ίδιο φράγμα ξαναμπαίνει και μέσα στον
 * builder (`resolveShape`) γιατί ο store δεν είναι η μόνη πόρτα προς αυτόν — βλ. το
 * σκεπτικό στο `resolveShape`.
 */
export const useTableOptionsStore = create<TableOptionsState>((set) => ({
  columnCount: DEFAULT_TABLE_COLUMN_COUNT,
  dataRowCount: DEFAULT_TABLE_DATA_ROW_COUNT,
  columnWidthMm: DEFAULT_TABLE_COLUMN_WIDTH_MM,
  setColumnCount: (columnCount) => set({ columnCount: sanitizeTableColumnCount(columnCount) }),
  setDataRowCount: (dataRowCount) => set({ dataRowCount: sanitizeTableDataRowCount(dataRowCount) }),
  setColumnWidthMm: (columnWidthMm) =>
    set({ columnWidthMm: sanitizeTableColumnWidthMm(columnWidthMm) }),
}));

/**
 * ADR-739 Φ.Δ — SSoT του mapping «ζωντανό store → `BuildTableOptions`». Χτίζει
 * `TableEntity` με **πάνω-αριστερή γωνία** στο `position` από το ζωντανό στιγμιότυπο
 * (event-time `getState()`, μοτίβο ADR-040 — μηδέν συνδρομή React).
 *
 * Το καταναλώνουν **και οι δύο** διαδρομές: ο builder της ολοκλήρωσης
 * (`drawing-entity-builders.ts`, `case 'table'`) **και** το WYSIWYG φάντασμα
 * (`drawing-preview-generator.ts`) — ώστε να μην μπορούν ποτέ να αποκλίνουν
 * (N.18: ένα mapping, όχι δύο αντίγραφα).
 */
export function buildTableEntityFromLiveOptions(
  position: Point2D,
  id: string,
  layerId: string,
): TableEntity {
  const opts = useTableOptionsStore.getState();
  return buildTableEntity(
    position,
    {
      columnCount: opts.columnCount,
      dataRowCount: opts.dataRowCount,
      columnWidthMm: opts.columnWidthMm,
    },
    id,
    layerId,
  );
}
