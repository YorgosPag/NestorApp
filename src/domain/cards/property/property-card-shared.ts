'use client';

/**
 * 🏠 PROPERTY CARD — Shared Logic (ADR-585)
 *
 * Commercial-status maps + the context-aware price StatItem builder that were
 * duplicated between PropertyGridCard and PropertyListCard (and self-cloned
 * inside the Grid). Centralized so both views share ONE price rule.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { StatItem } from '@/design-system';
import type { GridCardBadge, GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { formatCurrency } from '@/lib/intl-utils';
import type { Property } from '@/types/property-viewer';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

// =============================================================================
// 🏢 COMMERCIAL STATUS MAPPINGS (identical Grid + List)
// =============================================================================

export const COMMERCIAL_STATUS_BADGE_VARIANTS: Record<string, GridCardBadge['variant']> = {
  'for-sale': 'info',
  'for-rent': 'warning',
  'for-sale-and-rent': 'secondary',
  'unavailable': 'default',
};

export const COMMERCIAL_STATUS_LABEL_KEYS: Record<string, string> = {
  'for-sale': 'commercialStatus.for-sale',
  'for-rent': 'commercialStatus.for-rent',
  'for-sale-and-rent': 'commercialStatus.for-sale-and-rent',
  'unavailable': 'commercialStatus.unavailable',
};

/** Optional commercial-status badge appended after the primary status badge. */
export function buildCommercialBadge(property: Property, t: TFn): GridCardBadge | null {
  const cs = property.commercialStatus;
  if (!cs || !COMMERCIAL_STATUS_LABEL_KEYS[cs]) return null;
  return {
    label: t(COMMERCIAL_STATUS_LABEL_KEYS[cs], { ns: 'properties-enums' }),
    variant: COMMERCIAL_STATUS_BADGE_VARIANTS[cs] ?? 'default',
  };
}

/**
 * Assemble the Property badge list: primary status badge (resolved per view) +
 * optional commercial badge. Shared so Grid/List badge memos stay tiny.
 */
export function buildPropertyBadges(
  primaryLabelKey: string,
  primaryVariant: GridCardBadgeVariant,
  property: Property,
  t: TFn,
): GridCardBadge[] {
  const result: GridCardBadge[] = [{ label: t(primaryLabelKey), variant: primaryVariant }];
  const commercial = buildCommercialBadge(property, t);
  if (commercial) result.push(commercial);
  return result;
}

/**
 * Context-aware price stat(s) per commercialStatus (ADR-197 + rentPrice).
 * Shared by both Property views — was duplicated + self-cloned.
 */
export function buildPropertyPriceStats(property: Property, t: TFn): StatItem[] {
  const cs = property.commercialStatus;
  const salePrice = property.commercial?.askingPrice ?? property.price;
  const rentPrice = property.commercial?.rentPrice;
  const fmt = (n: number) => formatCurrency(n, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const priceIcon = NAVIGATION_ENTITIES.price.icon;
  const priceColor = NAVIGATION_ENTITIES.price.color;
  const items: StatItem[] = [];

  const pushSale = (label: string) => {
    if (salePrice && salePrice > 0) {
      items.push({ icon: priceIcon, iconColor: priceColor, label: t(label), value: fmt(salePrice), valueColor: priceColor });
    }
  };
  const pushRent = () => {
    if (rentPrice && rentPrice > 0) {
      items.push({ icon: priceIcon, iconColor: priceColor, label: t('card.stats.rent'), value: `${fmt(rentPrice)}/μήνα`, valueColor: priceColor });
    }
  };

  if (cs === 'for-rent') {
    pushRent();
  } else if (cs === 'for-sale-and-rent') {
    pushSale('card.stats.sale');
    pushRent();
  } else {
    pushSale('card.stats.price');
  }

  return items;
}
