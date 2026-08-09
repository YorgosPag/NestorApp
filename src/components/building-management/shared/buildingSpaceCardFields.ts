/**
 * Building Space Card Field Factories — Centralized field definitions
 *
 * Factory functions that produce the 4 standard SpaceCardField entries
 * used consistently across all building space tabs (Units, Storage, Parking).
 *
 * Standard layout:
 *   Field 1: Type · Code  (combined for quick identification)
 *   Field 2: Floor
 *   Field 3: m² (area)
 *   Field 4: Price
 *
 * @module components/building-management/shared/buildingSpaceCardFields
 * @see ADR-184 (Building Spaces Tabs)
 */

import { formatCurrencyWhole } from '@/lib/intl-utils';
import { priceSortKey, type PricedPropertyLike } from '@/lib/properties/price-resolver';
import type { SpaceCardField } from './types';

// ============================================================================
// FIELD FACTORIES
// ============================================================================

/**
 * Field 1: Type label combined with entity code.
 * Renders "TypeLabel · Code" when code is available, "TypeLabel" otherwise.
 *
 * Matches the property card pattern: "Apartment · A-101"
 */
export function buildTypeCodeField<T>(
  label: string,
  getTypeLabel: (item: T) => string,
  getCode: (item: T) => string | undefined,
): SpaceCardField<T> {
  return {
    label,
    render: (item) => {
      const typeLabel = getTypeLabel(item);
      const code = getCode(item);
      return code ? `${typeLabel} · ${code}` : typeLabel;
    },
  };
}

/**
 * Field 2: Floor identifier.
 * Falls back to em dash when floor is absent.
 */
export function buildFloorField<T>(
  label: string,
  getFloor: (item: T) => string | undefined,
): SpaceCardField<T> {
  return {
    label,
    render: (item) => getFloor(item) || '—',
  };
}

/**
 * Field 3: Area in m².
 * Label is always the unit symbol "m²" (no i18n needed).
 * Falls back to em dash when area is absent.
 */
export function buildAreaField<T>(
  getArea: (item: T) => number | undefined,
): SpaceCardField<T> {
  return {
    label: 'm²',
    render: (item) => getArea(item) || '—',
  };
}

/**
 * Field 4: Formatted price.
 *
 * Takes NO price accessor on purpose. Which field holds "the price" is one
 * rule owned by the `price-resolver` SSoT (ADR-777 Α6), so there is nothing
 * for a caller to supply — and nothing for three callers to disagree about.
 * Each of them used to pass the @deprecated flat `.price`, which silently
 * ignored `commercial.askingPrice` on units that have one.
 *
 * Absence renders as a dash, never as "0 €".
 *
 * @see lib/properties/price-resolver
 */
export function buildPriceField<T extends PricedPropertyLike>(
  label: string,
): SpaceCardField<T> {
  return {
    label,
    render: (item) => formatCurrencyWhole(priceSortKey(item)),
  };
}
