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
import { UNIFIED_STATUS_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
import type { StatItem } from '@/design-system';
import type { GridCardBadge, GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import type { PropertyStatus } from '@/core/types/BadgeTypes';
import { formatCurrency } from '@/lib/intl-utils';
import { resolvedPriceLabel } from '@/lib/listings/listing-price-label';
import {
  resolveDisplayPrice,
  type DisplayPrice,
  type MissingPriceReason,
  type PriceRole,
  type ResolvedPrice,
} from '@/lib/properties/price-resolver';
import type { CommercialStatus } from '@/types/property';
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
 * **Εμπορική κατάσταση → σήμα + κλειδί ετικέτας.**
 *
 * 🔑 **Ανέβηκε εδώ από το `PropertyCard` (ADR-777 §8.30).** Ήταν τοπική συνάρτηση
 * όσο υπήρχε **ένας** καταναλωτής· η κεφαλίδα ταυτότητας της καρτέλας ακινήτου
 * είναι ο **δεύτερος**, και μια αντιγραφή θα σήμαινε ότι την ημέρα που
 * προστίθεται έβδομη εμπορική κατάσταση **η μία** από τις δύο οθόνες θα την
 * αγνοούσε σιωπηλά, δείχνοντας «διαθέσιμο» για ακίνητο που δεν είναι (N.0.2).
 *
 * ⚠️ **Το `commercialStatus` είναι το SSoT· το `status` είναι κάτοπτρο εγγραφής**
 * και διαβάζεται **μόνο** ως εφεδρεία (ADR-258).
 */
export function resolvePropertyBadge(
  commercialStatus: CommercialStatus | undefined,
  legacyStatus: Property['status'],
): { badgeStatus: PropertyStatus; labelKey: string } {
  switch (commercialStatus ?? legacyStatus) {
    case 'for-sale':
    case 'for-rent':
    case 'for-sale-and-rent':
      return { badgeStatus: 'available', labelKey: UNIFIED_STATUS_FILTER_LABELS.AVAILABLE };
    case 'reserved':
      return { badgeStatus: 'reserved', labelKey: UNIFIED_STATUS_FILTER_LABELS.RESERVED };
    case 'sold':
    case 'rented':
      return { badgeStatus: 'sold', labelKey: UNIFIED_STATUS_FILTER_LABELS.SOLD };
    default:
      return { badgeStatus: 'available', labelKey: UNIFIED_STATUS_FILTER_LABELS.AVAILABLE };
  }
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
  // Offered for short stays, rate never recorded — the opposite claim of `not-listed`
  // (ADR-835 §4.4). Until 2026-09-17 this row was missing and the card painted a raw key.
  'nightly-rate-missing': 'card.price.nightlyMissing',
};

/** Whole-euro money formatting — one rule, so every card reads the same. */
export const formatPriceAmount = (amount: number): string =>
  formatCurrency(amount, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * **What each role is called** when it labels a row — «Πώληση» · «Ενοίκιο» · «Διανυκτέρευση».
 *
 * `Record<PriceRole, …>` so that a fourth role does not compile until someone names it.
 * The previous `if (role === 'rent') … else` chain sent `nightly` down the sale branch,
 * and a 50 €/night rate was labelled «Τιμή» — the sale word (ADR-777 §8.60.13).
 */
const PRICE_ROLE_LABEL_KEY: Readonly<Record<PriceRole, string>> = {
  sale: 'card.stats.sale',
  rent: 'card.stats.rent',
  nightly: 'card.stats.nightly',
};

/**
 * One price → one StatItem. The value carries its unit through the ONE amount-with-unit
 * rule (`resolvedPriceLabel` → `common:priceAmount.*`), shared with the public search.
 */
function priceStatItem(price: ResolvedPrice, labelKey: string, t: TFn): StatItem {
  return {
    icon: NAVIGATION_ENTITIES.price.icon,
    iconColor: NAVIGATION_ENTITIES.price.color,
    label: t(labelKey),
    value: resolvedPriceLabel(t, price),
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
/**
 * The two words for a priced pair, chosen from the FIELD each amount was read
 * from — never from its position in the pair.
 *
 * The previous version hardcoded the second row as "Rent", which was true only
 * while `secondary` could only ever be a rent. The moment a sold unit began
 * carrying its asking price there (ADR-777 §8.2 #3), that row would have
 * labelled 200.000 € as **rent**. Position is not meaning; `source` is.
 *
 * Exhaustive by construction of `resolveDisplayPrice`: a `finalPrice` headline can
 * only be a sold unit; rent and nightly headlines never carry a secondary; the only
 * other pair is sale + rent.
 */
function priceLabelKeys(
  headline: ResolvedPrice,
  secondary: ResolvedPrice | null,
): { headline: string; secondary: string | null } {
  if (headline.source === 'commercial.finalPrice') {
    // Sold: what it went for, and — only when different — what we asked.
    return { headline: 'card.stats.soldFor', secondary: secondary ? 'card.stats.askedFor' : null };
  }

  // A sale headline standing alone is simply "Price"; alongside a rent it is "Sale".
  const standaloneSale = headline.role === 'sale' && secondary === null;
  return {
    headline: standaloneSale ? 'card.stats.price' : PRICE_ROLE_LABEL_KEY[headline.role],
    secondary: secondary ? PRICE_ROLE_LABEL_KEY[secondary.role] : null,
  };
}

/**
 * The two price texts for a COMPACT card (one big headline + one context line),
 * as opposed to the stat rows of {@link buildPropertyPriceStats}.
 *
 * Exists so that `PropertyCard` stops deciding the wording itself. It used to
 * wrap **both** amounts in a rent-only «/μήνα» key — correct while a secondary
 * could only be a rent, and wrong the moment a sold unit put its asking price
 * there: 200.000 € would have been printed as **«200.000 €/μήνα»**. The rule of
 * what each number MEANS belongs next to the rule of which number to show.
 *
 * @returns `null` when there is no displayable price — the caller names the
 *          absence via {@link MISSING_PRICE_LABEL_KEYS}.
 */
export function buildCardPriceText(
  price: DisplayPrice,
  t: TFn,
): { headline: string; secondary: string | null } | null {
  if (price.kind === 'missing') return null;

  // The unit follows the ROLE, never the source field: a nightly rate read as a bare
  // amount was the §8.60.13 defect («50 €» next to «170.000 €»).
  const format = (p: ResolvedPrice): string => resolvedPriceLabel(t, p);

  const { headline, secondary } = price;

  return {
    headline: format(headline),
    secondary: secondary
      ? secondary.source === 'commercial.askingPrice'
        // Sold: the asking price is context, not a second offer.
        ? `${t('card.stats.askedFor')} ${format(secondary)}`
        : format(secondary)
      : null,
  };
}

export function buildPropertyPriceStats(property: Property, t: TFn): StatItem[] {
  const resolved = resolveDisplayPrice(property);
  if (resolved.kind === 'missing') return [];

  const { headline, secondary } = resolved;
  const labels = priceLabelKeys(headline, secondary);

  const items = [priceStatItem(headline, labels.headline, t)];
  if (secondary && labels.secondary) {
    items.push(priceStatItem(secondary, labels.secondary, t));
  }
  return items;
}

interface PricePerSqmPresentation {
  readonly labelKey: string;
  readonly iconColor: string;
}

/**
 * Per-role presentation of a €/m² row — or `null` where a rate per m² means nothing.
 *
 * 🔴 **`nightly: null`, declared, not forgotten.** The map used to name only sale and
 * rent; a nightly headline indexed it with a key it did not have and the destructuring
 * threw — the whole card went down for a short-stay property. A price per night per
 * square metre is not a figure any market quotes (Airbnb and Booking publish none).
 * `Record<PriceRole, …>` makes the next role answer the same question before it compiles.
 */
const PRICE_PER_SQM_PRESENTATION: Readonly<Record<PriceRole, PricePerSqmPresentation | null>> = {
  sale: { labelKey: 'card.stats.salePricePerSqm', iconColor: NAVIGATION_ENTITIES.price.color },
  rent: { labelKey: 'card.stats.rentPricePerSqm', iconColor: 'text-[hsl(var(--text-warning))]' },
  nightly: null,
};

/**
 * **Price per m², whole euros** — `null` when the area is unknown or the role has no
 * such rate. One rule for the card rows below and for the floor-plan quick view.
 */
export function pricePerSqmAmount(
  price: Pick<ResolvedPrice, 'role' | 'amount'>,
  area: number | null | undefined,
): number | null {
  if (PRICE_PER_SQM_PRESENTATION[price.role] === null) return null;
  return typeof area === 'number' && area > 0 ? Math.round(price.amount / area) : null;
}

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

  // A secondary earns its own €/m² row only when it is a DIFFERENT side of the
  // deal. On a sold unit both amounts are sale figures, so the pair would print
  // twice under one label ("Sale/m²") with two different numbers — a row the
  // reader cannot interpret. The rate that matters there is the one it sold at.
  const { headline, secondary } = resolved;
  const prices: ResolvedPrice[] =
    secondary && secondary.role !== headline.role ? [headline, secondary] : [headline];

  return prices.flatMap((price) => {
    const presentation = PRICE_PER_SQM_PRESENTATION[price.role];
    const perSqm = pricePerSqmAmount(price, displayArea);
    if (presentation === null || perSqm === null) return [];
    return [{
      icon: NAVIGATION_ENTITIES.price.icon,
      iconColor: presentation.iconColor,
      label: t(presentation.labelKey),
      value: `${formatPriceAmount(perSqm)}/m²`,
    }];
  });
}
