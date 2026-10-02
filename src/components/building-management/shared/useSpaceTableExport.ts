'use client';

/**
 * @fileoverview **Η εξαγωγή XLSX ενός πίνακα χώρων κτιρίου** (ADR-898 Φ4β) — ΕΝΑ hook για Μονάδες · Αποθήκες · Στάθμευση.
 * @related `space-table-export.ts` (στήλες → φύλλο) · `useExportAction.ts` (κατάσταση κουμπιού) · ADR-184
 * @module components/building-management/shared/useSpaceTableExport
 *
 * 🏆 **Revit «Export Schedule»**: το αρχείο έχει **ό,τι βλέπει ο άνθρωπος** — τις φιλτραρισμένες γραμμές, με τη σειρά της
 *   οθόνης, από τον ΙΔΙΟ ορισμό στηλών. Η καρτέλα δίνει τα ορατά στοιχεία· το hook κρατά τη σειρά του πίνακα.
 * 🔑 **Η σειρά ζει εδώ, όχι μόνο μέσα στον πίνακα**: στην προβολή «κάρτες» ο πίνακας ξεστήνεται· όταν επιστρέψει, παίρνει
 *   πίσω την ίδια σειρά (`initialSort`). Στις κάρτες η εξαγωγή βγάζει τη σειρά των δεδομένων — αυτή που φαίνεται εκεί.
 * 📋 **Φύλλο «Παραδοχές»**: κτίριο · ημερομηνία · προβολή · σειρά · «Ν από Μ» · φίλτρα — όποιος ανοίξει το αρχείο αύριο
 *   ξέρει ότι κοιτάζει **υποσύνολο**, και ποιο.
 */

import { useState } from 'react';

import { PRODUCT_NAME } from '@/constants/product-identity';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { KeyValueRow } from '@/lib/export/excel-workbook';
import { marketDayOf } from '@/lib/listings/listing-stats';

import type { SpaceFilterOption } from './BuildingSpaceFilterBar';
import { exportSpaceTableXlsx, spaceScheduleTotals } from './space-table-export';
import type { SortState } from './space-table-sort';
import type { BuildingSpaceViewMode, SpaceColumn } from './types';
import { useExportAction, type ExportAction } from './useExportAction';

/** Ό,τι χρειάζεται η εξαγωγή από ένα φίλτρο-επιλογή: η τιμή του και πώς ονομάζεται (όχι ο χειριστής αλλαγής). */
export interface SpaceFilterSnapshot {
  readonly value: string;
  readonly options: ReadonlyArray<SpaceFilterOption<string>>;
  readonly allLabel: string;
}

export interface SpaceTableExportInput<T> {
  readonly buildingName: string;
  /** Το όνομα της καρτέλας — φύλλο, τίτλος, αρχείο. */
  readonly tabLabel: string;
  readonly columns: readonly SpaceColumn<T>[];
  /** Οι γραμμές **που φαίνονται** (μετά τα φίλτρα). */
  readonly items: readonly T[];
  /** Πόσες είναι **όλες**, πριν τα φίλτρα — για το «Ν από Μ». */
  readonly totalCount: number;
  readonly viewMode: BuildingSpaceViewMode;
  readonly searchTerm: string;
  readonly typeFilter: SpaceFilterSnapshot;
  readonly statusFilter: SpaceFilterSnapshot;
}

export interface SpaceTableExportControls {
  /** Για το `BuildingSpaceTable` — `{...tableSort}`. */
  readonly tableSort: { readonly initialSort: SortState | undefined; readonly onSortChange: (sort: SortState | null) => void };
  /** Για το `BuildingSpaceFilterBar` — χωρίς αυτό δεν υπάρχει κουμπί. */
  readonly exportAction: ExportAction;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const selectedLabel = (filter: SpaceFilterSnapshot): string =>
  filter.options.find((option) => option.value === filter.value)?.label ?? filter.allLabel;

function sortLabel<T>(t: Translate, columns: readonly SpaceColumn<T>[], sort: SortState | null): string {
  const column = sort ? columns.find((candidate) => candidate.key === sort.key) : undefined;
  if (!sort || !column) return t('spaceExport.assumptions.sortNone');
  return t(sort.direction === 'asc' ? 'spaceExport.assumptions.sortAsc' : 'spaceExport.assumptions.sortDesc', { column: column.label });
}

function assumptionRows<T>(t: Translate, input: SpaceTableExportInput<T>, sort: SortState | null, exportedOn: string): KeyValueRow[] {
  const A = 'spaceExport.assumptions';
  const search = input.searchTerm.trim();
  return [
    [t(`${A}.building`), input.buildingName],
    [t(`${A}.exportedOn`), exportedOn],
    [t(`${A}.view`), t(input.viewMode === 'table' ? `${A}.viewTable` : `${A}.viewCards`)],
    [t(`${A}.sort`), sortLabel(t, input.columns, sort)],
    [t(`${A}.rows`), t(`${A}.rowsOf`, { shown: input.items.length, total: input.totalCount })],
    [t(`${A}.search`), search === '' ? t(`${A}.searchNone`) : search],
    [t(`${A}.type`), selectedLabel(input.typeFilter)],
    [t(`${A}.status`), selectedLabel(input.statusFilter)],
    [t(`${A}.software`), PRODUCT_NAME],
  ];
}

function runExport<T>(t: Translate, input: SpaceTableExportInput<T>, tableSort: SortState | null): Promise<void> {
  // Οι κάρτες δεν ταξινομούν: εκεί φαίνεται η σειρά των δεδομένων, άρα αυτή εξάγεται.
  const sort = input.viewMode === 'table' ? tableSort : null;
  const exportedOn = marketDayOf(Date.now());
  const totals = spaceScheduleTotals(input.columns, input.items, {
    totalRow: (rows) => t('spaceExport.totalRow', { rows }),
    missing: (pending, rows) => t('spaceExport.missing', { pending, rows }),
  });
  return exportSpaceTableXlsx({
    title: input.tabLabel,
    fileBaseName: t('spaceExport.filename', { tab: input.tabLabel, building: input.buildingName, date: exportedOn }),
    schedule: { name: input.tabLabel, columns: input.columns, items: input.items, sort, footer: totals },
    assumptions: {
      name: t('spaceExport.sheets.assumptions'),
      keyHeader: t('spaceExport.columns.key'),
      valueHeader: t('spaceExport.columns.value'),
      rows: assumptionRows(t, input, sort, exportedOn),
    },
  });
}

export function useSpaceTableExport<T>(input: SpaceTableExportInput<T>): SpaceTableExportControls {
  const { t } = useTranslation('building-storage');
  const [sort, setSort] = useState<SortState | null>(null);
  const exportAction = useExportAction(() => runExport(t, input, sort));
  return { tableSort: { initialSort: sort ?? undefined, onSortChange: setSort }, exportAction };
}
