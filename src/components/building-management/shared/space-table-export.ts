/**
 * @fileoverview **Πίνακας χώρων → φύλλο XLSX** (ADR-898 Φ4β) — από τους ΙΔΙΟΥΣ ορισμούς στηλών και την ΙΔΙΑ σειρά με
 * την οθόνη (`sortIntoGroups`): ό,τι βλέπει ο άνθρωπος, αυτό κατεβάζει. Καμία δεύτερη λίστα στηλών ανά εξαγωγή.
 * @related `lib/export/excel-workbook.ts` (`addScheduleSheet` — το ντύσιμο) · `space-table-sort.ts`
 * @module components/building-management/shared/space-table-export
 */

import {
  addKeyValueSheet,
  addScheduleSheet,
  exportWorkbook,
  type KeyValueSheetSpec,
  type ScheduleCell,
  type ScheduleColumn,
  type ScheduleFooterCell,
  type ScheduleSheetSpec,
} from '@/lib/export/excel-workbook';

import { sortIntoGroups, type SortState } from './space-table-sort';
import type { SpaceColumn } from './types';

type ExportableColumn<T> = SpaceColumn<T> & { readonly exportCell: (item: T) => ScheduleCell };

function isExportable<T>(column: SpaceColumn<T>): column is ExportableColumn<T> {
  return column.exportCell !== undefined;
}

export interface SpaceScheduleInput<T> {
  readonly name: string;
  readonly columns: readonly SpaceColumn<T>[];
  readonly items: readonly T[];
  /** Η ταξινόμηση της οθόνης τη στιγμή της εξαγωγής. */
  readonly sort: SortState | null;
  /** Γραμμή συνόλου ανά **κλειδί στήλης** — όσες στήλες λείπουν μένουν κενές. */
  readonly footer?: Readonly<Record<string, ScheduleFooterCell>>;
}

export function spaceScheduleSpec<T>({ name, columns, items, sort, footer }: SpaceScheduleInput<T>): ScheduleSheetSpec {
  const exported = columns.filter(isExportable);
  const scheduleColumns: ScheduleColumn[] = exported.map((column) => ({ header: column.label, format: column.exportFormat ?? 'text' }));
  const ordered = sortIntoGroups(items, columns, sort).flatMap((group) => group.items);
  return {
    name,
    columns: scheduleColumns,
    rows: ordered.map((item) => exported.map((column) => column.exportCell(item))),
    footer: footer === undefined ? undefined : exported.map((column) => footer[column.key] ?? null),
  };
}

/** Τα κείμενα της γραμμής συνόλου — από τον καλούντα (i18n), ώστε η καθαρή συνάρτηση να μη γνωρίζει γλώσσα. */
export interface SpaceTotalsLabels {
  /** Στην πρώτη στήλη: «Σύνολο · 12 γραμμές». */
  readonly totalRow: (rows: number) => string;
  /** Σε στήλη με κενά: «Λείπουν 2 από 12» — **αντί** για αριθμό. */
  readonly missing: (pending: number, rows: number) => string;
}

/** Το άθροισμα χωρίς θόρυβο κινητής υποδιαστολής (`0.1 + 0.2`): η ακρίβεια της μορφής `number` του φύλλου. */
function roundedSum(values: readonly number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 10_000) / 10_000;
}

/**
 * **Η γραμμή συνόλου του schedule** (Revit «Grand totals»): το πλήθος στην πρώτη στήλη, και `SUM` σε κάθε στήλη με
 * `exportTotal: 'sum'` — **μόνο** όταν κάθε γραμμή έχει αριθμό. Ένα κενό ⇒ «λείπουν Ν από Μ», **ποτέ** μερικό άθροισμα
 * που θα διαβαζόταν ως σύνολο. Καμία γραμμή ⇒ κανένα σύνολο (ένα «0» θα έλεγε «μετρήθηκε μηδέν»).
 */
export function spaceScheduleTotals<T>(
  columns: readonly SpaceColumn<T>[],
  items: readonly T[],
  labels: SpaceTotalsLabels,
): Readonly<Record<string, ScheduleFooterCell>> {
  const exported = columns.filter(isExportable);
  const footer: Record<string, ScheduleFooterCell> = {};
  if (exported.length === 0) return footer;
  footer[exported[0].key] = labels.totalRow(items.length);
  if (items.length === 0) return footer;
  for (const column of exported) {
    if (column.exportTotal !== 'sum') continue;
    const numbers = items.map(column.exportCell).filter((cell): cell is number => typeof cell === 'number');
    footer[column.key] = numbers.length === items.length ? { sum: roundedSum(numbers) } : labels.missing(items.length - numbers.length, items.length);
  }
  return footer;
}

export interface SpaceTableExport<T> {
  readonly title: string;
  readonly fileBaseName: string;
  readonly schedule: SpaceScheduleInput<T>;
  /** Το φύλλο «Παραδοχές»: κτίριο · ημερομηνία · ενεργά φίλτρα · σειρά — τι **ακριβώς** περιέχει το αρχείο. */
  readonly assumptions: KeyValueSheetSpec;
}

/** **Ένας πίνακας χώρων → βιβλίο** με δύο φύλλα (ο πίνακας · οι παραδοχές του), από τον κοινό σκελετό. */
export function exportSpaceTableXlsx<T>({ title, fileBaseName, schedule, assumptions }: SpaceTableExport<T>): Promise<void> {
  return exportWorkbook({
    title,
    fileBaseName,
    build: (workbook) => {
      addScheduleSheet(workbook, spaceScheduleSpec(schedule));
      addKeyValueSheet(workbook, assumptions);
    },
  });
}
