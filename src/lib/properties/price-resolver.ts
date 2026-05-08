/**
 * Property price resolver — picks the contextually correct price field based
 * on the property's commercial status. SSoT used by hover labels, quick-view
 * panels and any other UI that needs to display "the price" of a property.
 *
 * Decision matrix:
 *   - `for-rent`, `rented`            → `commercial.rentPrice`
 *   - `for-sale-and-rent`             → `commercial.askingPrice` (sale priority for headline price)
 *   - all other statuses              → `commercial.askingPrice ?? commercial.finalPrice ?? legacy price`
 *
 * @module lib/properties/price-resolver
 * @enterprise ADR-197 Sales SSoT / ADR-258 commercial status SSoT
 */

import type { CommercialStatus } from '@/constants/commercial-statuses';

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

export type EffectivePriceMode = 'sale' | 'rent';

export interface EffectivePrice {
  amount: number;
  mode: EffectivePriceMode;
}

const PURE_RENT_STATUSES: ReadonlySet<string> = new Set(['for-rent', 'rented']);

function pickFirstPositive(...values: ReadonlyArray<number | null | undefined>): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/**
 * Resolve the headline price + its mode (sale vs rent) for a property.
 * Returns `null` when no positive price is available for the active status.
 */
export function getEffectivePrice(input: PricedPropertyLike): EffectivePrice | null {
  const statusKey = (input.commercialStatus ?? input.status ?? '') as string;
  const c = input.commercial ?? {};

  if (PURE_RENT_STATUSES.has(statusKey)) {
    const rent = pickFirstPositive(c.rentPrice);
    return rent === null ? null : { amount: rent, mode: 'rent' };
  }

  const sale = pickFirstPositive(c.askingPrice, c.finalPrice, input.price);
  return sale === null ? null : { amount: sale, mode: 'sale' };
}
