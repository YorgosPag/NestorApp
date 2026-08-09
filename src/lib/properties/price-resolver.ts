/**
 * Property price resolver — picks the contextually correct price field based
 * on the property's commercial status, and says WHERE the number came from.
 *
 * SSoT used by hover labels, quick-view panels, property cards and any other
 * UI that needs to display "the price" of a property.
 *
 * Decision matrix (driven by `commercialStatus`, legacy `status` as fallback):
 *   - `for-rent`, `rented`  → `commercial.rentPrice`
 *   - `for-sale-and-rent`   → sale as headline, rent as secondary (BOTH exist)
 *   - all other statuses    → `commercial.askingPrice ?? commercial.finalPrice ?? legacy price`
 *
 * **Absence is a STATE, never a zero.** `resolveDisplayPrice` returns an
 * explicit `missing` variant carrying the reason, so a caller can tell
 * "not on the market" apart from "on the market, but nobody recorded a price".
 * Painting "contact us" where a price belongs is exactly what this module
 * exists to prevent — the price is displayed, or its absence is named.
 *
 * **Every resolved amount carries its `source`.** A number without an origin
 * is a claim, not a fact.
 *
 * @module lib/properties/price-resolver
 * @enterprise ADR-197 Sales SSoT / ADR-258 commercial status SSoT
 * @see ADR-777 — decision Α6 (the price is shown) + rules 9 & 18 (explicit
 *      state, declared provenance)
 */

import {
  FINALIZED_COMMERCIAL_STATUSES,
  isListedCommercialStatus,
  type CommercialStatus,
} from '@/constants/commercial-statuses';

/**
 * Structural input — deliberately NOT tied to a named `Property` type.
 *
 * The codebase carries two distinct `Property` shapes (`@/types/property` and
 * `@/types/property-viewer`) plus parking/storage units; all of them satisfy
 * this contract. Same pattern as `SalesDisplayEligibilityInput`.
 */
export interface PricedPropertyLike {
  status?: string | null;
  commercialStatus?: CommercialStatus | string | null;
  commercial?: {
    askingPrice?: number | null;
    finalPrice?: number | null;
    rentPrice?: number | null;
  } | null;
  /** @deprecated legacy flat price field — used as last-resort fallback. */
  price?: number | null;
}

// =============================================================================
// 1. RESOLVED SHAPE — amount + role + provenance
// =============================================================================

/** Which side of the deal a resolved amount belongs to. */
export type PriceRole = 'sale' | 'rent';

/** Exactly which field the amount was read from. Never inferred, never guessed. */
export type PriceSource =
  | 'commercial.askingPrice'
  | 'commercial.finalPrice'
  | 'commercial.rentPrice'
  | 'legacy.price';

/** A price that exists, with its role and its origin. */
export interface ResolvedPrice {
  role: PriceRole;
  amount: number;
  source: PriceSource;
}

/**
 * Why no price is displayable. These are NOT interchangeable:
 *   - `not-listed`          — the unit is not on the market; absence is correct.
 *   - `sale-price-missing`  — listed for sale, but no asking price was recorded.
 *   - `rent-price-missing`  — listed for rent, but no rent was recorded.
 *
 * The last two are data gaps the owner can close; the first is not.
 */
export type MissingPriceReason =
  | 'not-listed'
  | 'sale-price-missing'
  | 'rent-price-missing';

/**
 * The display verdict. `secondary` is non-null only for `for-sale-and-rent`,
 * where a single number would silently drop half the offer.
 */
export type DisplayPrice =
  | { kind: 'priced'; headline: ResolvedPrice; secondary: ResolvedPrice | null }
  | { kind: 'missing'; reason: MissingPriceReason };

// =============================================================================
// 2. STATUS GROUPS
// =============================================================================

/** Statuses whose headline price is the rent, never the sale price. */
const PURE_RENT_STATUSES: ReadonlySet<string> = new Set(['for-rent', 'rented']);

/** The one status that legitimately carries two prices at the same time. */
const DUAL_STATUS = 'for-sale-and-rent';

/** Closed deals — a missing price here is a data gap, not "not on the market". */
const FINALIZED_STATUSES: ReadonlySet<string> = new Set<string>(
  FINALIZED_COMMERCIAL_STATUSES,
);

// =============================================================================
// 3. RESOLUTION
// =============================================================================

/** Effective status key: canonical `commercialStatus` wins, legacy `status` backs it. */
function statusKeyOf(input: PricedPropertyLike): string {
  return (input.commercialStatus ?? input.status ?? '') as string;
}

/** First strictly-positive candidate, tagged with the field it came from. */
function pickPriced(
  role: PriceRole,
  candidates: ReadonlyArray<readonly [number | null | undefined, PriceSource]>,
): ResolvedPrice | null {
  for (const [value, source] of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return { role, amount: value, source };
    }
  }
  return null;
}

function resolveSalePrice(input: PricedPropertyLike): ResolvedPrice | null {
  const commercial = input.commercial ?? {};
  return pickPriced('sale', [
    [commercial.askingPrice, 'commercial.askingPrice'],
    [commercial.finalPrice, 'commercial.finalPrice'],
    [input.price, 'legacy.price'],
  ]);
}

function resolveRentPrice(input: PricedPropertyLike): ResolvedPrice | null {
  const commercial = input.commercial ?? {};
  return pickPriced('rent', [[commercial.rentPrice, 'commercial.rentPrice']]);
}

/** Name the absence. A unit off the market is not the same as a forgotten price. */
function missingReasonFor(statusKey: string): MissingPriceReason {
  if (PURE_RENT_STATUSES.has(statusKey)) return 'rent-price-missing';
  if (isListedCommercialStatus(statusKey) || FINALIZED_STATUSES.has(statusKey)) {
    return 'sale-price-missing';
  }
  return 'not-listed';
}

/**
 * Resolve what to display as "the price" — or, when there is none, why.
 *
 * Total function: every input maps to exactly one explicit variant. There is
 * no path that returns `0` for a property whose price was never recorded.
 */
export function resolveDisplayPrice(input: PricedPropertyLike): DisplayPrice {
  const statusKey = statusKeyOf(input);

  if (PURE_RENT_STATUSES.has(statusKey)) {
    const rent = resolveRentPrice(input);
    return rent
      ? { kind: 'priced', headline: rent, secondary: null }
      : { kind: 'missing', reason: 'rent-price-missing' };
  }

  const sale = resolveSalePrice(input);

  if (statusKey === DUAL_STATUS) {
    const rent = resolveRentPrice(input);
    if (sale) return { kind: 'priced', headline: sale, secondary: rent };
    if (rent) return { kind: 'priced', headline: rent, secondary: null };
    return { kind: 'missing', reason: 'sale-price-missing' };
  }

  return sale
    ? { kind: 'priced', headline: sale, secondary: null }
    : { kind: 'missing', reason: missingReasonFor(statusKey) };
}

// =============================================================================
// 4. LEGACY SURFACE — kept so existing callers stay untouched
// =============================================================================

/** @see PriceRole — same union, kept under its original name. */
export type EffectivePriceMode = PriceRole;

export interface EffectivePrice {
  amount: number;
  mode: EffectivePriceMode;
}

/**
 * Headline price + its mode, or `null` when none is displayable.
 *
 * Thin projection of {@link resolveDisplayPrice}: it drops the provenance and
 * the secondary price. Prefer `resolveDisplayPrice` in new code — `null` here
 * cannot tell "off the market" from "price never recorded".
 */
export function getEffectivePrice(input: PricedPropertyLike): EffectivePrice | null {
  const resolved = resolveDisplayPrice(input);
  return resolved.kind === 'priced'
    ? { amount: resolved.headline.amount, mode: resolved.headline.role }
    : null;
}
