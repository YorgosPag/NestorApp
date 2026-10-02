'use client';

/**
 * @fileoverview **Οι στήλες του πίνακα αντικειμενικής του κτιρίου** (ADR-898 Φ4β) — `SpaceColumn<T>` του κοινού
 * `BuildingSpaceTable`, με ομάδες ανά όροφο (Revit `Sort By: Level`) και υποσύνολο ορόφου.
 * @module components/building-management/tabs/ObjectiveValueTab/building-objective-value-columns
 *
 * 🔑 **Υποσύνολο ορόφου = ο ΙΔΙΟΣ κανόνας με το σύνολο** (`buildingObjectiveValueTotal`): ποσό μόνο όταν **κάθε**
 *   μονάδα του ορόφου έχει ποσό· αλλιώς «λείπουν Ν από Μ». Ποτέ μερικό άθροισμα ως υποσύνολο.
 * 🔑 Ταξινόμηση ποσού: όρια/ελλείψεις **στο τέλος** (κενό ⇒ `null`, όπως το λογιστικό φύλλο), ποτέ ως 0.
 * 🔑 **Μονάδα + παρακολουθήματα** (ADR-898 §19): ταξινόμηση στη στήλη «Ακίνητο» ⇒ ομάδες ανά μονάδα με τους χώρους της
 *   (Revit `Sort/Group By`). Το υποσύνολο της ομάδας είναι **προβολή** με τον ίδιο κανόνα — κάθε χώρος μένει **μία**
 *   γραμμή, άρα το σύνολο του κτιρίου δεν τον βλέπει ποτέ δύο φορές.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { compareSortValues, type SortDirection } from '@/lib/array-utils';
import { formatCurrency } from '@/lib/intl-formatting';
import { buildingObjectiveValueTotal, type BuildingUnitObjectiveValue } from '@/lib/objective-value/building-objective-value';
import type { BuildingObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';

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

/** Η επιγραφή μιας ομάδας: το όνομά της και το υποσύνολό της — ή πόσα λείπουν. Ένας κανόνας για όροφο και μονάδα. */
function groupLabel(rows: readonly BuildingObjectiveValueRow[], name: string, labels: BuildingObjectiveValueLabels): string {
  const total = buildingObjectiveValueTotal(rows);
  if (total.kind === 'incomplete') return labels.t(`${B}.groupIncomplete`, { group: name, pending: total.pending, items: total.items });
  if (total.items === 0) return name;
  return labels.t(`${B}.group`, { group: name, amount: formatCurrency(total.value) });
}

function byName(labels: BuildingObjectiveValueLabels) {
  return (a: BuildingObjectiveValueRow, b: BuildingObjectiveValueRow) =>
    compareSortValues(labels.rowName(a), labels.rowName(b), 'asc') || a.id.localeCompare(b.id);
}

/** Ομάδες ανά όροφο (υπόγεια πρώτα στο «αύξουσα»), μέσα στον όροφο κατά όνομα — ολική, σταθερή σειρά. */
export function floorSortGroups(labels: BuildingObjectiveValueLabels) {
  return (rows: readonly BuildingObjectiveValueRow[], direction: SortDirection): readonly SpaceSortGroup<BuildingObjectiveValueRow>[] => {
    const floors = [...new Set(rows.map((row) => row.floor))].sort((a, b) => compareSortValues(a, b, direction));
    return floors.map((floor) => {
      const items = rows.filter((row) => row.floor === floor).sort(byName(labels));
      return { key: `floor:${floor ?? 'none'}`, label: groupLabel(items, labels.floor(floor), labels), items };
    });
  };
}

/** Η μονάδα στην οποία ανήκει μια γραμμή: η ίδια (μονάδα) · ο κάτοχος (χώρος) · `null` = χώρος χωρίς μονάδα. */
export function ownerIdOf(row: BuildingObjectiveValueRow): string | null {
  return row.space === null ? row.id : row.space.ownerUnitId;
}

/** Μονάδα → το όνομά της, όπως το δείχνει ο πίνακας. */
export type OwnerNames = ReadonlyMap<string, string>;

/**
 * Τα ονόματα των κατόχων: οι μονάδες του κτιρίου (γραμμές) **και** οι μονάδες άλλου κτιρίου που έχουν χώρο εδώ
 * («Α3 · σε άλλο κτίριο (Α)», ADR-898 §20) — αλλιώς ο χώρος θα έλεγε ψευδώς «Χωρίς μονάδα».
 */
export function ownerNamesOf(rows: readonly BuildingObjectiveValueRow[], labels: BuildingObjectiveValueLabels): OwnerNames {
  const names = new Map<string, string>();
  for (const row of rows) {
    if (row.space === null) names.set(row.id, labels.rowName(row));
  }
  for (const { space } of rows) {
    if (space === null || space.ownerUnitId === null || space.ownerElsewhere === null || names.has(space.ownerUnitId)) continue;
    names.set(space.ownerUnitId, labels.ownerElsewhere(space.ownerUnitName, space.ownerElsewhere));
  }
  return names;
}

/** Το όνομα του κατόχου — «Χωρίς μονάδα» όταν ο χώρος δεν ανήκει σε μονάδα. */
function ownerNameOf(ownerId: string | null, labels: BuildingObjectiveValueLabels, ownerNames: OwnerNames): string {
  return (ownerId === null ? undefined : ownerNames.get(ownerId)) ?? labels.t(`${B}.unattached`);
}

/** Ομάδες «μονάδα + παρακολουθήματα» — η μονάδα πρώτη, μετά οι χώροι της· οι χώροι χωρίς μονάδα στο τέλος. */
export function ownerSortGroups(labels: BuildingObjectiveValueLabels, ownerNames: OwnerNames) {
  return (rows: readonly BuildingObjectiveValueRow[], direction: SortDirection): readonly SpaceSortGroup<BuildingObjectiveValueRow>[] => {
    const nameOf = (ownerId: string | null) => ownerNameOf(ownerId, labels, ownerNames);
    const owners = [...new Set(rows.map(ownerIdOf))].sort(
      (a, b) => Number(a === null) - Number(b === null) || compareSortValues(nameOf(a), nameOf(b), direction) || String(a).localeCompare(String(b)),
    );
    const unitFirst = (a: BuildingObjectiveValueRow, b: BuildingObjectiveValueRow) => Number(a.space !== null) - Number(b.space !== null) || byName(labels)(a, b);
    return owners.map((ownerId) => {
      const items = rows.filter((row) => ownerIdOf(row) === ownerId).sort(unitFirst);
      return { key: `owner:${ownerId ?? 'none'}`, label: groupLabel(items, nameOf(ownerId), labels), items };
    });
  };
}

/** «Παρακολούθημα του»: η μονάδα του χώρου · «Χωρίς μονάδα» · `null` για τη μονάδα. */
function attachedToOf(row: BuildingObjectiveValueRow, labels: BuildingObjectiveValueLabels, ownerNames: OwnerNames): string | null {
  return row.space === null ? null : ownerNameOf(row.space.ownerUnitId, labels, ownerNames);
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
function exportOnlyBoundsColumns(labels: BuildingObjectiveValueLabels): SpaceColumn<BuildingObjectiveValueRow>[] {
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
  rows: readonly BuildingObjectiveValueRow[],
  onDetails: (row: BuildingObjectiveValueRow) => void,
): SpaceColumn<BuildingObjectiveValueRow>[] {
  const { t } = labels;
  const ownerNames = ownerNamesOf(rows, labels);
  return [
    {
      key: 'unit',
      label: t(`${B}.columns.unit`),
      render: (row) => labels.rowName(row),
      sortValue: (row) => labels.rowName(row),
      sortGroups: ownerSortGroups(labels, ownerNames),
      exportCell: (row) => labels.rowName(row),
    },
    {
      key: 'kind',
      label: t(`${B}.columns.kind`),
      render: (row) => <span className="text-sm text-muted-foreground">{labels.kind(row.kind)}</span>,
      sortValue: (row) => labels.kind(row.kind),
      exportCell: (row) => labels.kind(row.kind),
    },
    {
      key: 'attachedTo',
      label: t(`${B}.columns.attachedTo`),
      render: (row) => <span className="text-sm text-muted-foreground">{attachedToOf(row, labels, ownerNames) ?? '—'}</span>,
      sortValue: (row) => attachedToOf(row, labels, ownerNames),
      exportCell: (row) => attachedToOf(row, labels, ownerNames),
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
        <Button type="button" variant="ghost" size="sm" aria-label={t(`${B}.columns.detailsFor`, { unit: labels.rowName(row) })} onClick={() => onDetails(row)}>
          {t(`${B}.columns.details`)}
        </Button>
      ),
    },
  ];
}
