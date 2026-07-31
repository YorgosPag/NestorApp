/**
 * ADR-739 Φάση Δ — Table tool options store (ribbon ⇄ placement).
 *
 * Κρατά τις τρεις επιλογές κατασκευής που το ενεργό εργαλείο `'table'` περνά στο
 * `buildTableEntity` στο κλικ: πλήθος στηλών, πλήθος γραμμών **δεδομένων**, πλάτος
 * στήλης (sheet-mm). Η contextual καρτέλα της ribbon τις γράφει· ο builder διαβάζει το
 * **ζωντανό** στιγμιότυπο τη στιγμή της ολοκλήρωσης (`getState()` — καμία συνδρομή,
 * μοτίβο event-time ανάγνωσης του ADR-040), ακριβώς όπως ο αδελφός
 * `opening-info-tag-options-store`.
 *
 * Επίπεδο (χωρίς επίγνωση είδους): υπάρχει **ένα** εργαλείο πίνακα, άρα δεν υπάρχει
 * φέτα ανά είδος να ζογκλάρει.
 *
 * @see bim/table/build-table-entity.ts — ο καταναλωτής (`BuildTableOptions`)
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

export const useTableOptionsStore = create<TableOptionsState>((set) => ({
  columnCount: DEFAULT_TABLE_COLUMN_COUNT,
  dataRowCount: DEFAULT_TABLE_DATA_ROW_COUNT,
  columnWidthMm: DEFAULT_TABLE_COLUMN_WIDTH_MM,
  setColumnCount: (columnCount) => set({ columnCount }),
  setDataRowCount: (dataRowCount) => set({ dataRowCount }),
  setColumnWidthMm: (columnWidthMm) => set({ columnWidthMm }),
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
