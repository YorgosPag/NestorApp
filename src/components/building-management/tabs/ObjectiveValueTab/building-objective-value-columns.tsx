'use client';

/**
 * @fileoverview **Οι στήλες του πίνακα αντικειμενικής του κτιρίου** (ADR-898 Φ4β) — `SpaceColumn<T>` του κοινού
 * `BuildingSpaceTable`, με ομάδες ανά όροφο (Revit `Sort By: Level`) και υποσύνολο ορόφου.
 * @module components/building-management/tabs/ObjectiveValueTab/building-objective-value-columns
 *
 * 🔑 **Υποσύνολο ορόφου = ο ΙΔΙΟΣ κανόνας με το σύνολο** (`buildingObjectiveValueTotal`): ποσό μόνο όταν **κάθε**
 *   μονάδα του ορόφου έχει ποσό· αλλιώς «λείπουν Ν από Μ». Ποτέ μερικό άθροισμα ως υποσύνολο.
 * 🔑 Ταξινόμηση ποσού: όρια/ελλείψεις **στο τέλος** (κενό ⇒ `null`, όπως το λογιστικό φύλλο), ποτέ ως 0.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { compareSortValues, type SortDirection } from '@/lib/array-utils';
import { formatCurrency } from '@/lib/intl-formatting';
import { buildingObjectiveValueTotal, type BuildingUnitObjectiveValue } from '@/lib/objective-value/building-objective-value';
import type { BuildingUnitObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';

import type { SpaceColumn, SpaceSortGroup } from '../../shared/types';
import type { BuildingObjectiveValueLabels } from './useBuildingObjectiveValueLabels';

const B = 'objective-value:building';

export const FLOOR_COLUMN_KEY = 'floor';
export const VALUE_COLUMN_KEY = 'value';
export const STATUS_COLUMN_KEY = 'status';

/** Το ακριβές ποσό μιας μονάδας — για ταξινόμηση και άθροισμα· όρια/ελλείψεις ⇒ `null`. */
export function exactValueOf(value: BuildingUnitObjectiveValue): number | null {
  return value.kind === 'evaluated' && value.bounds.kind === 'exact' ? value.bounds.result.value : null;
}

/** Η επιγραφή μιας ομάδας ορόφου: ο όροφος και το υποσύνολό του — ή πόσες λείπουν. */
function floorGroupLabel(rows: readonly BuildingUnitObjectiveValueRow[], floor: number | null, labels: BuildingObjectiveValueLabels): string {
  const total = buildingObjectiveValueTotal(rows.map((row) => row.value));
  const floorText = labels.floor(floor);
  if (total.kind === 'incomplete') return labels.t(`${B}.floorGroupIncomplete`, { floor: floorText, pending: total.pending, units: total.units });
  if (total.units === 0) return floorText;
  return labels.t(`${B}.floorGroup`, { floor: floorText, amount: formatCurrency(total.value) });
}

/** Ομάδες ανά όροφο (υπόγεια πρώτα στο «αύξουσα»), μέσα στον όροφο κατά όνομα — ολική, σταθερή σειρά. */
export function floorSortGroups(labels: BuildingObjectiveValueLabels) {
  return (rows: readonly BuildingUnitObjectiveValueRow[], direction: SortDirection): readonly SpaceSortGroup<BuildingUnitObjectiveValueRow>[] => {
    const floors = [...new Set(rows.map((row) => row.floor))].sort((a, b) => compareSortValues(a, b, direction));
    return floors.map((floor) => {
      const items = rows
        .filter((row) => row.floor === floor)
        .sort((a, b) => compareSortValues(labels.unitName(a), labels.unitName(b), 'asc') || a.id.localeCompare(b.id));
      return { key: `floor:${floor ?? 'none'}`, label: floorGroupLabel(items, floor, labels), items };
    });
  };
}

function AmountCell({ value, labels }: { readonly value: BuildingUnitObjectiveValue; readonly labels: BuildingObjectiveValueLabels }) {
  const amount = labels.amount(value);
  if (amount === null) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums font-medium text-foreground">{amount}</span>;
}

/** Τα όρια «από · έως» ως αριθμοί — μόνο όταν η μονάδα έχει όρια (το ακριβές ζει στη στήλη αξίας). */
function boundsOf(value: BuildingUnitObjectiveValue): { readonly low: number; readonly high: number } | null {
  return value.kind === 'evaluated' && value.bounds.kind === 'range' ? value.bounds : null;
}

/**
 * Στήλες **μόνο για την εξαγωγή** (η οθόνη δείχνει το εύρος ως κείμενο στη στήλη αξίας): ελάχιστο · μέγιστο · τι ήρθε
 * από το κτίριο. Σημαία `exportOnly`: ο πίνακας δεν τις ζωγραφίζει — η εξαγωγή τις παίρνει με τη σειρά τους.
 */
function exportOnlyBoundsColumns(labels: BuildingObjectiveValueLabels): SpaceColumn<BuildingUnitObjectiveValueRow>[] {
  const { t } = labels;
  const none = () => null;
  return [
    { key: 'low', label: t(`${B}.export.columns.low`), exportOnly: true, render: none, exportCell: (row) => boundsOf(row.value)?.low ?? null, exportFormat: 'currency' },
    { key: 'high', label: t(`${B}.export.columns.high`), exportOnly: true, render: none, exportCell: (row) => boundsOf(row.value)?.high ?? null, exportFormat: 'currency' },
    {
      key: 'inherited',
      label: t(`${B}.export.columns.inherited`),
      exportOnly: true,
      render: none,
      exportCell: (row) => (row.value.kind === 'evaluated' ? labels.inherited(row.value.inherited) : null),
    },
  ];
}

export function buildingObjectiveValueColumns(
  labels: BuildingObjectiveValueLabels,
  onDetails: (row: BuildingUnitObjectiveValueRow) => void,
): SpaceColumn<BuildingUnitObjectiveValueRow>[] {
  const { t } = labels;
  return [
    {
      key: 'unit',
      label: t(`${B}.columns.unit`),
      render: (row) => labels.unitName(row),
      sortValue: (row) => labels.unitName(row),
      exportCell: (row) => labels.unitName(row),
    },
    {
      key: FLOOR_COLUMN_KEY,
      label: t(`${B}.columns.floor`),
      render: (row) => labels.floor(row.floor),
      sortGroups: floorSortGroups(labels),
      // Αριθμός στο αρχείο: ο όροφος ταξινομείται/φιλτράρεται σωστά στο Excel (0 = ισόγειο, αρνητικοί = υπόγεια).
      exportCell: (row) => row.floor,
      exportFormat: 'number',
    },
    {
      key: VALUE_COLUMN_KEY,
      label: t(`${B}.columns.value`),
      alignRight: true,
      render: (row) => <AmountCell value={row.value} labels={labels} />,
      sortValue: (row) => exactValueOf(row.value),
      exportCell: (row) => exactValueOf(row.value),
      exportFormat: 'currency',
    },
    ...exportOnlyBoundsColumns(labels),
    {
      key: STATUS_COLUMN_KEY,
      label: t(`${B}.columns.status`),
      render: (row) => <span className="text-sm text-muted-foreground">{labels.status(row.value)}</span>,
      exportCell: (row) => labels.status(row.value),
    },
    {
      key: 'details',
      label: t(`${B}.columns.details`),
      alignRight: true,
      render: (row) => (
        <Button type="button" variant="ghost" size="sm" aria-label={t(`${B}.columns.detailsFor`, { unit: labels.unitName(row) })} onClick={() => onDetails(row)}>
          {t(`${B}.columns.details`)}
        </Button>
      ),
    },
  ];
}
