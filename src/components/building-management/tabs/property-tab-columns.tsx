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
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property';
import type { SpaceColumn, SpaceCardField } from '../shared';
import {
  buildTypeCodeField,
  buildFloorField,
  buildAreaField,
  buildPriceField,
} from '../shared';
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
 * Table columns for the units table.
 *
 * `sortValue` may return `null` — the row then sorts to the END in both
 * directions rather than being ranked as the smallest (ADR-777 Α6).
 */
export function usePropertyTabColumns(
  t: TFn,
  tUnits: TFn,
  mutedTextClass: string,
): SpaceColumn<Property>[] {
  return useMemo(() => [
    {
      key: 'name',
      label: t('tabs.floors.name'),
      sortValue: (u) => u.name,
      render: (u) => <span className="font-medium">{u.name}</span>,
    },
    {
      key: 'type',
      label: t('tabs.labels.properties'),
      width: 'w-28',
      sortValue: (u) => u.type,
      render: (u) => <span className={mutedTextClass}>{getPropertyTypeLabel(u.type, tUnits)}</span>,
    },
    {
      key: 'floor',
      label: t('tabs.floors.number'),
      width: 'w-20',
      sortValue: (u) => u.floor || '',
      render: (u) => <span className={cn('font-mono text-sm', mutedTextClass)}>{u.floor}</span>,
    },
    {
      key: 'area',
      label: 'm²',
      width: 'w-20',
      sortValue: (u) => u.areas?.gross || u.areas?.net || u.area || 0,
      render: (u) => {
        const a = u.areas?.gross || u.areas?.net || u.area;
        return <span className="font-mono text-xs">{a ? `${a}` : '—'}</span>;
      },
    },
    {
      key: 'status',
      label: t('tabs.labels.details'),
      width: 'w-28',
      sortValue: (u) => u.status,
      render: (u) => renderUnitStatusBadge(u.status, tUnits),
    },
  ], [t, tUnits, mutedTextClass]);
}

/**
 * Card fields for the units card grid.
 *
 * `buildPriceField` takes no price accessor: which field holds the price is the
 * `price-resolver` SSoT's decision, not this tab's (ADR-777 Α6).
 */
export function usePropertyTabCardFields(tUnits: TFn): SpaceCardField<Property>[] {
  return useMemo(() => [
    buildTypeCodeField(tUnits('card.stats.type'), (u) => getPropertyTypeLabel(u.type, tUnits), (u) => u.code),
    buildFloorField(tUnits('card.stats.floor'), (u) => (u.floor != null ? String(u.floor) : undefined)),
    buildAreaField((u) => u.areas?.gross || u.areas?.net || u.area),
    buildPriceField(tUnits('table.price')),
  ], [tUnits]);
}
