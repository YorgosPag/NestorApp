/**
 * property-tab-columns — Column, card-field and status-badge presentation for
 * PropertiesTabContent.
 *
 * Extracted from PropertiesTabContent.tsx for SRP compliance (ADR-184), the
 * same split its sibling tab already has in `parking-tab-config`. What a unit
 * row LOOKS LIKE is a separate concern from how the tab fetches, filters and
 * mutates units — and the host file had grown past the 500-line limit of N.7.1
 * holding both.
 *
 * @module components/building-management/tabs/property-tab-columns
 * @see ADR-184 (Building Spaces Tabs)
 */

import { useMemo } from 'react';
import type { Property } from '@/types/property';
import type { SpaceColumn, SpaceCardField } from '../shared';
import {
  buildTypeCodeField,
  buildFloorField,
  buildAreaField,
  buildPriceField,
  buildAreaColumn,
  buildFloorColumn,
  buildPriceColumns,
} from '../shared';
import { propertyDisplayArea } from '@/lib/properties/property-display-area';
import {
  UNIT_STATUS_COLOR_MAP,
  getPropertyTypeLabel,
  getPropertyStatusLabel,
} from './property-tab-constants';

/** The translate function shape both namespaces expose. */
type TFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Status pill for a unit.
 *
 * Shared by the table column and the card grid so the two views of one tab
 * cannot render the same status differently.
 */
export function renderUnitStatusBadge(status: string, tUnits: TFn) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        UNIT_STATUS_COLOR_MAP[status] || UNIT_STATUS_COLOR_MAP.unavailable
      }`}
    >
      {getPropertyStatusLabel(status, tUnits)}
    </span>
  );
}

/**
 * Table columns for the units table — screen **and** XLSX export from ONE definition (ADR-898 Φ4β).
 *
 * Headers are the units' own (`unitsTable.columns.*`): until 2026-10-02 they borrowed the Floors tab keys and read
 * «Όνομα Στάθμης» / «Ιδιότητες» / «Λεπτομέρειες» — wrong on screen, and they would now be the Excel headers too.
 *
 * `sortValue` may return `null` — the row then sorts to the END in both
 * directions rather than being ranked as the smallest (ADR-777 Α6).
 * The price pair (amount + export-only unit) comes from `buildPriceColumns`: the units table shows the
 * price like its Parking/Storage siblings, never three axes in one numeric column.
 */
export function usePropertyTabColumns(
  t: TFn,
  tUnits: TFn,
  mutedTextClass: string,
): SpaceColumn<Property>[] {
  return useMemo(() => [
    {
      key: 'name',
      label: t('unitsTable.columns.name'),
      sortValue: (u) => u.name,
      render: (u) => <span className="font-medium">{u.name}</span>,
      exportCell: (u) => u.name || null,
    },
    {
      key: 'type',
      label: t('unitsTable.columns.type'),
      width: 'w-28',
      sortValue: (u) => u.type,
      render: (u) => <span className={mutedTextClass}>{getPropertyTypeLabel(u.type, tUnits)}</span>,
      exportCell: (u) => getPropertyTypeLabel(u.type, tUnits),
    },
    buildFloorColumn<Property>(t('storageTable.columns.floor'), (u) => u.floor, mutedTextClass),
    buildAreaColumn<Property>(t('spaceColumns.area'), propertyDisplayArea),
    ...buildPriceColumns<Property>({ price: t('storageTable.columns.price'), unit: t('spaceColumns.priceUnit') }, tUnits, (u) => u.name),
    {
      key: 'status',
      label: t('unitsTable.columns.status'),
      width: 'w-28',
      sortValue: (u) => u.status,
      render: (u) => renderUnitStatusBadge(u.status, tUnits),
      exportCell: (u) => getPropertyStatusLabel(u.status, tUnits),
    },
  ], [t, tUnits, mutedTextClass]);
}

/**
 * Card fields for the units card grid.
 *
 * `buildPriceField` takes no price accessor: which field holds the price is the
 * `price-resolver` SSoT's decision, not this tab's (ADR-777 Α6).
 */
// `priceLabel` από τον καλούντα: το `table.price` που διάβαζε η κάρτα ζει ΜΟΝΟ στο namespace `price-map` — στην οθόνη
// έβγαινε ωμό κλειδί (βρέθηκε στη ζωντανή επαλήθευση της εξαγωγής, ADR-898 Φ4β).
export function usePropertyTabCardFields(tUnits: TFn, priceLabel: string): SpaceCardField<Property>[] {
  return useMemo(() => [
    buildTypeCodeField(tUnits('card.stats.type'), (u) => getPropertyTypeLabel(u.type, tUnits), (u) => u.code),
    buildFloorField(tUnits('card.stats.floor'), (u) => (u.floor != null ? String(u.floor) : undefined)),
    buildAreaField((u) => propertyDisplayArea(u) ?? undefined),
    buildPriceField(priceLabel, tUnits),
  ], [tUnits, priceLabel]);
}
