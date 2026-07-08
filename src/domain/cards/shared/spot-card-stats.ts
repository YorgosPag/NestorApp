/**
 * 🏢 SPOT CARD STAT BUILDERS (ADR-585)
 *
 * Shared StatItem builders for spatial-inventory cards (parking / storage /
 * property). The floor / area / price rows were built identically across every
 * spatial card; centralized here so each entity model just composes them in its
 * own order with its own label. Returns `null` when the value is absent so
 * callers can `.filter(Boolean)`.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { StatItem } from '@/design-system';
import { formatCurrency, formatFloorString } from '@/lib/intl-utils';

/** Floor / level row (localized via `formatFloorString`). */
export function floorStat(value: string | undefined | null, label: string): StatItem | null {
  if (!value) return null;
  return {
    icon: NAVIGATION_ENTITIES.floor.icon,
    iconColor: NAVIGATION_ENTITIES.floor.color,
    label,
    value: formatFloorString(value),
  };
}

/** Area row in m². */
export function areaStat(area: number | undefined | null, label: string): StatItem | null {
  if (!area) return null;
  return {
    icon: NAVIGATION_ENTITIES.area.icon,
    iconColor: NAVIGATION_ENTITIES.area.color,
    label,
    value: `${area} m²`,
  };
}

/** Whole-euro price row. */
export function priceStat(price: number | undefined | null, label: string): StatItem | null {
  if (!price || price <= 0) return null;
  return {
    icon: NAVIGATION_ENTITIES.price.icon,
    iconColor: NAVIGATION_ENTITIES.price.color,
    label,
    value: formatCurrency(price, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    valueColor: NAVIGATION_ENTITIES.price.color,
  };
}
