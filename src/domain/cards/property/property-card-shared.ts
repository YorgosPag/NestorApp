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
import {
  resolveDisplayPrice,
  type MissingPriceReason,
  type ResolvedPrice,
} from '@/lib/properties/price-resolver';
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
 * Why-no-price → label key.
 *
 * Rule 18: the absence is NAMED, and each name is a different fact — a unit
 * that is off the market is not a unit whose price nobody recorded. Rule 9:
 * the missing thing is SHOWN as a state, never silently blanked and never
 * papered over with "contact us" (ADR-777 Α6).
 */
export const MISSING_PRICE_LABEL_KEYS: Record<MissingPriceReason, string> = {
  'not-listed': 'card.price.notListed',
  'sale-price-missing': 'card.price.saleMissing',
  'rent-price-missing': 'card.price.rentMissing',
};

/** Whole-euro money formatting — one rule, so every card reads the same. */
export const formatPriceAmount = (amount: number): string =>
  formatCurrency(amount, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** One price → one StatItem. Rent carries its period; sale does not. */
function priceStatItem(price: ResolvedPrice, labelKey: string, t: TFn): StatItem {
  const amount = formatPriceAmount(price.amount);
  return {
    icon: NAVIGATION_ENTITIES.price.icon,
    iconColor: NAVIGATION_ENTITIES.price.color,
    label: t(labelKey),
    value: price.role === 'rent' ? t('card.stats.rentValue', { amount }) : amount,
    valueColor: NAVIGATION_ENTITIES.price.color,
  };
}

/**
 * Context-aware price stat(s) for a Property card.
 *
 * The rule of WHICH price to show is NOT decided here — it belongs to the
 * `price-resolver` SSoT, which also reports where each amount came from and,
 * when there is none, why. This function only turns that verdict into rows.
 *
 * @see lib/properties/price-resolver — the single price rule
 * @see ADR-777 Α6 — the price is displayed; absence is named, never "contact us"
 */
export function buildPropertyPriceStats(property: Property, t: TFn): StatItem[] {
  const resolved = resolveDisplayPrice(property);
  if (resolved.kind === 'missing') return [];

  const { headline, secondary } = resolved;
  // A sale headline standing alone is simply "Price"; alongside a rent it is "Sale".
  const headlineKey =
    headline.role === 'rent'
      ? 'card.stats.rent'
      : secondary
        ? 'card.stats.sale'
        : 'card.stats.price';

  const items = [priceStatItem(headline, headlineKey, t)];
  if (secondary) items.push(priceStatItem(secondary, 'card.stats.rent', t));
  return items;
}

/** Per-role presentation of a €/m² row. Rent is warned-coloured, sale is not. */
const PRICE_PER_SQM_PRESENTATION = {
  sale: { labelKey: 'card.stats.salePricePerSqm', iconColor: NAVIGATION_ENTITIES.price.color },
  rent: { labelKey: 'card.stats.rentPricePerSqm', iconColor: 'text-[hsl(var(--text-warning))]' },
} as const;

/**
 * Price-per-m² stat(s) for a Property card — sales views only.
 *
 * Derived from the SAME verdict as {@link buildPropertyPriceStats}, so the two
 * rows on a card can never disagree about which prices the unit has. Reading
 * `commercial.askingPrice`/`rentPrice` directly here (as this did before) meant
 * a unit priced through `finalPrice` or the legacy flat field showed an
 * absolute price with no €/m² beside it, and a rented unit carrying a stale
 * asking price advertised a sale rate it is not offered at.
 *
 * @see ADR-777 Α6 — one price rule, consumed everywhere
 */
export function buildPropertyPricePerSqmStats(
  property: Property,
  displayArea: number,
  t: TFn,
): StatItem[] {
  if (!(displayArea > 0)) return [];

  const resolved = resolveDisplayPrice(property);
  if (resolved.kind === 'missing') return [];

  const prices = [resolved.headline, resolved.secondary].filter(
    (p): p is ResolvedPrice => p !== null,
  );

  return prices.map((price) => {
    const { labelKey, iconColor } = PRICE_PER_SQM_PRESENTATION[price.role];
    return {
      icon: NAVIGATION_ENTITIES.price.icon,
      iconColor,
      label: t(labelKey),
      value: `${formatPriceAmount(Math.round(price.amount / displayArea))}/m²`,
    };
  });
}
