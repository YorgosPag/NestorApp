/**
 * @fileoverview **Πίνακας χώρων → φύλλο XLSX** (ADR-898 Φ4β) — από τους ΙΔΙΟΥΣ ορισμούς στηλών και την ΙΔΙΑ σειρά με
 * την οθόνη (`sortIntoGroups`): ό,τι βλέπει ο άνθρωπος, αυτό κατεβάζει. Καμία δεύτερη λίστα στηλών ανά εξαγωγή.
 * @related `lib/export/excel-workbook.ts` (`addScheduleSheet` — το ντύσιμο) · `space-table-sort.ts`
 * @module components/building-management/shared/space-table-export
 */

import type { ScheduleCell, ScheduleColumn, ScheduleFooterCell, ScheduleSheetSpec } from '@/lib/export/excel-workbook';

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
