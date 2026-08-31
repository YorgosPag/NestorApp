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
 *   - `sold`                → `commercial.finalPrice` as headline, the asking
 *                             price as secondary **when it differs**
 *   - all other statuses    → `commercial.askingPrice ?? commercial.finalPrice ?? legacy price`
 *
 * **A third axis answers where the seven-value vocabulary is silent** (ADR-835 §4.4).
 * `leaseShort` has NO projection into `commercialStatus` on purpose, so a property
 * offered only for short stays reads as `unavailable` — true for the old vocabulary,
 * and useless for the reader. When, and only when, the status-driven answer is
 * `missing / not-listed`, this module asks `offerKinds` — the axis where nothing is
 * lost — and answers with the `nightly` role. See {@link ROLE_WHERE_LEGACY_IS_SILENT}.
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
import { KINDS_WITHOUT_LEGACY_PROJECTION } from '@/lib/offers/derive-commercial-status';

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
    /** Price **per night** (ADR-835 §4.4). Never a monthly rent, never a sale price. */
    nightlyRate?: number | null;
  } | null;
  /**
   * The lossless axis — `offerKinds` (ADR-777 Α20).
   *
   * **Optional, and the absence is not a gap.** Every caller that does not carry it
   * gets exactly today's behaviour, because this field is consulted only where the
   * status-driven path already gave up. Typed as `readonly string[]` rather than
   * `readonly OfferKind[]` for the same reason the whole interface is structural:
   * the raw Firestore document reaches here untyped, and a named type would force
   * an `as` on every caller.
   */
  offerKinds?: readonly string[] | null;
  /** @deprecated legacy flat price field — used as last-resort fallback. */
  price?: number | null;
}

// =============================================================================
// 1. RESOLVED SHAPE — amount + role + provenance
// =============================================================================

/**
 * Which side of the deal a resolved amount belongs to.
 *
 * `nightly` is a **third role, not a variant of `rent`** (ADR-835 §4.4): 65 and 650
 * are both euro amounts for "living here", and only the role tells them apart. A
 * screen that renders a nightly rate the way it renders a monthly rent is off by a
 * factor of thirty — silently.
 */
export type PriceRole = 'sale' | 'rent' | 'nightly';

/** Exactly which field the amount was read from. Never inferred, never guessed. */
export type PriceSource =
  | 'commercial.askingPrice'
  | 'commercial.finalPrice'
  | 'commercial.rentPrice'
  | 'commercial.nightlyRate'
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
 *   - `nightly-rate-missing`— offered for short stays, but no nightly rate was
 *                             recorded. A distinct reason from `not-listed`, because
 *                             it is the opposite claim: the property **is** on the
 *                             market, on an axis the old vocabulary cannot name.
 *
 * All but the first are data gaps the owner can close; `not-listed` is not.
 */
export type MissingPriceReason =
  | 'not-listed'
  | 'sale-price-missing'
  | 'rent-price-missing'
  | 'nightly-rate-missing';

/**
 * The display verdict.
 *
 * `secondary` carries the second number that the reader would otherwise have
 * to go and find. It is non-null in exactly two situations, and they are
 * distinguishable from `source` alone — no caller needs to know the status:
 *   - `for-sale-and-rent` → secondary is the **rent**; a single number would
 *     silently drop half the offer.
 *   - `sold`              → secondary is the **asking price**, and only when it
 *     differs from what the unit actually sold for. Equal numbers say nothing.
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

/**
 * The closed sale. Its headline is the **contract** price, not the one we
 * asked for: 185.000 € is what changed hands, 200.000 € is what we hoped for.
 *
 * Before ADR-777 §8.2 #3 (decided by Giorgio, 2026-08-09) this module answered
 * `askingPrice → finalPrice` here, so a sold unit displayed the number it did
 * NOT sell for — while `SalesSoldPageContent` and `PaymentTabContent` answered
 * `finalPrice → askingPrice` privately, and `PaymentTabContent` disagreed with
 * ITSELF (`:115` vs `:178`). Same unit, three answers, one click apart.
 *
 * ⚠️ `rented` is deliberately NOT here even though it is `FINALIZED` too: its
 * closing number is the **rent**, which `PURE_RENT_STATUSES` already answers.
 * `finalPrice` is a sale figure and would be the wrong side of the deal.
 */
const SOLD_STATUS = 'sold';

/** Closed deals — a missing price here is a data gap, not "not on the market". */
const FINALIZED_STATUSES: ReadonlySet<string> = new Set<string>(
  FINALIZED_COMMERCIAL_STATUSES,
);

// =============================================================================
// 2b. THE THIRD AXIS — what to answer where the seven-value vocabulary is silent
// =============================================================================

/** What a projection-less offer kind answers about price. */
interface SilentAxisAnswer {
  /** The amount it carries, with its role and provenance — or `null` if unrecorded. */
  readonly resolve: (input: PricedPropertyLike) => ResolvedPrice | null;
  /** How to name the absence. Never `not-listed`: the property IS on the market. */
  readonly whenAbsent: MissingPriceReason;
}

/**
 * **What each projection-less offer kind answers** — or `null` when it answers nothing
 * about price (ADR-835 §4.4).
 *
 * 🔴 **The key is `KINDS_WITHOUT_LEGACY_PROJECTION`, and that is the whole point.**
 * These are exactly the kinds `deriveCommercialStatus` declared it cannot express, so
 * they are exactly the kinds whose price the status can never reach. Keying the table
 * off the *same* constant means a fifth projection-less kind **does not compile** here
 * until someone states what it answers — the guard sits on the cause, not beside it.
 *
 * ⚠️ **`exchange → null` is a statement, not a hole.** Its amount is a *percentage*,
 * and a percentage rendered where a price belongs reads as "50 €" — the lie
 * `deriveCommercialAmounts` already refuses to tell. Mapping it to `null` keeps
 * today's verdict for exchange-only properties (`not-listed`) **identical**, now with
 * the reason written down instead of emerging from the absence of a branch.
 *
 * ⚠️ **One table, not two parallel ones.** "Which amount" and "how to name its
 * absence" are answers to the same question and travel together; two tables keyed the
 * same way are the shape that drifts silently (CHECK 3.34).
 */
const ANSWER_WHERE_LEGACY_IS_SILENT: Readonly<
  Record<(typeof KINDS_WITHOUT_LEGACY_PROJECTION)[number], SilentAxisAnswer | null>
> = {
  exchange: null,
  leaseShort: {
    resolve: (input) => resolveNightlyPrice(input),
    whenAbsent: 'nightly-rate-missing',
  },
};

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

function resolveNightlyPrice(input: PricedPropertyLike): ResolvedPrice | null {
  const commercial = input.commercial ?? {};
  return pickPriced('nightly', [[commercial.nightlyRate, 'commercial.nightlyRate']]);
}

/**
 * A sold unit: the contract price leads, the asking price follows as context.
 *
 * Two deliberate rules:
 *   - **No `finalPrice` recorded → fall back to the ordinary sale chain.** A
 *     sale whose contract figure nobody typed in still has a number worth
 *     showing; hiding it would punish the reader for a data gap.
 *   - **An asking price equal to the final one is dropped.** "Sold 200.000,
 *     asked 200.000" is not a second fact, it is the same fact twice.
 */
function resolveSoldPrice(input: PricedPropertyLike): DisplayPrice {
  const commercial = input.commercial ?? {};

  const contract = pickPriced('sale', [
    [commercial.finalPrice, 'commercial.finalPrice'],
  ]);

  if (!contract) {
    const fallback = resolveSalePrice(input);
    return fallback
      ? { kind: 'priced', headline: fallback, secondary: null }
      : { kind: 'missing', reason: 'sale-price-missing' };
  }

  const asked = pickPriced('sale', [
    [commercial.askingPrice, 'commercial.askingPrice'],
  ]);

  return {
    kind: 'priced',
    headline: contract,
    secondary: asked && asked.amount !== contract.amount ? asked : null,
  };
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
  return answerFromLegacyVocabulary(input, statusKeyOf(input));
}

/**
 * The seven-value vocabulary's own answer — unchanged since ADR-777 §8.2 — with the
 * **one** place it admits it knows nothing handed over to {@link answerFromOfferKinds}.
 */
function answerFromLegacyVocabulary(
  input: PricedPropertyLike,
  statusKey: string,
): DisplayPrice {
  if (PURE_RENT_STATUSES.has(statusKey)) {
    const rent = resolveRentPrice(input);
    return rent
      ? { kind: 'priced', headline: rent, secondary: null }
      : { kind: 'missing', reason: 'rent-price-missing' };
  }

  if (statusKey === SOLD_STATUS) {
    return resolveSoldPrice(input);
  }

  const sale = resolveSalePrice(input);

  if (statusKey === DUAL_STATUS) {
    const rent = resolveRentPrice(input);
    if (sale) return { kind: 'priced', headline: sale, secondary: rent };
    if (rent) return { kind: 'priced', headline: rent, secondary: null };
    return { kind: 'missing', reason: 'sale-price-missing' };
  }

  if (sale) return { kind: 'priced', headline: sale, secondary: null };

  const reason = missingReasonFor(statusKey);
  return reason === 'not-listed'
    ? answerFromOfferKinds(input)
    : { kind: 'missing', reason };
}

/**
 * **The third axis, asked in exactly one place** (ADR-835 §4.4).
 *
 * 🔴 **Why here and nowhere earlier — the rule in one sentence:** the old vocabulary
 * is consulted first because everything it *does* say is **proven** (`for-sale` proves
 * a live sale offer, `sold` proves a closed one — see `offerKindsFromLegacyStatus`),
 * and `not-listed` is the single verdict where it declared it proves **nothing**. So
 * this axis never overrules a fact; it only speaks into a stated silence.
 *
 * ⚠️ **This is what makes the addition provably non-regressive for all 41 consumers.**
 * `not-listed` is today a dead end — the function returns `missing` and stops. No
 * existing input can change verdict here, because no document carried `leaseShort` in
 * `offerKinds` before this ADR shipped. The proof is structural, not a sample.
 *
 * ⚠️ **A missing nightly rate is `nightly-rate-missing`, never `not-listed`.** The
 * property *is* on the market; saying otherwise would be the false negative this whole
 * module exists to prevent — "absence is a state, never a zero", and never a lie.
 *
 * ⛔ **Nightly is a headline, never a `secondary`.** The `secondary` slot means "the
 * second number the reader would otherwise go and find", and it is already spoken for
 * by the two combinations the old vocabulary itself produces (`for-sale-and-rent`,
 * `sold`). A property that is for sale **and** offered nightly has three prices and
 * two slots; overloading the slot would make it mean different things per input. The
 * nightly rate stays reachable through `offerKinds`, which loses nothing — the same
 * declared trade-off `deriveCommercialStatus` makes one layer down.
 */
function answerFromOfferKinds(input: PricedPropertyLike): DisplayPrice {
  const offered = input.offerKinds ?? [];

  // ⚠️ Iterated in the constant's own order, never the document's: two properties with
  // the same offers written in a different order must resolve to the same price.
  for (const kind of KINDS_WITHOUT_LEGACY_PROJECTION) {
    if (!offered.includes(kind)) continue;

    const answer = ANSWER_WHERE_LEGACY_IS_SILENT[kind];
    if (answer === null) continue;

    const price = answer.resolve(input);
    return price
      ? { kind: 'priced', headline: price, secondary: null }
      : { kind: 'missing', reason: answer.whenAbsent };
  }

  return { kind: 'missing', reason: 'not-listed' };
}

// =============================================================================
// 4. COLLECTIONS — summing and ordering, with the absence still named
// =============================================================================

/**
 * The result of pricing a collection, with its accounting closed.
 *
 * `pricedCount + unpricedCount === items.length` for every input. A total that
 * does not say how many units it covers is a claim, not a measurement: the same
 * "€2.4M" means something different over 10 units than over 40, and the reader
 * cannot tell the two apart from the number alone.
 *
 * This mirrors what SQL has always done — `SUM` skips NULL, and `COUNT(col)`
 * next to `COUNT(*)` is what tells you how much of the column was actually
 * there. We keep both counts rather than making the caller subtract.
 */
export interface PriceTotals {
  /** Sum over the units that HAVE a price. Never inflated by absent ones. */
  total: number;
  /** `total / pricedCount` — the denominator excludes unpriced units. */
  average: number;
  /** How many units contributed a number. */
  pricedCount: number;
  /** How many were skipped because they have no displayable price. */
  unpricedCount: number;
}

/**
 * Total and average price across a collection.
 *
 * Exists so that no caller ever writes `sum + (getEffectivePrice(u)?.amount ?? 0)`.
 * That idiom is the bug this module was created to remove, only spelled with an
 * extra step: it re-enters an unpriced unit as a zero, dragging the average down
 * and making the total look like a complete measurement of an incomplete set.
 *
 * @see ADR-777 — decision Α5 (the accounting closes explicitly)
 */
export function totalPrice(items: readonly PricedPropertyLike[]): PriceTotals {
  let total = 0;
  let pricedCount = 0;

  for (const item of items) {
    const resolved = getEffectivePrice(item);
    if (resolved) {
      total += resolved.amount;
      pricedCount += 1;
    }
  }

  return {
    total,
    average: pricedCount > 0 ? total / pricedCount : 0,
    pricedCount,
    unpricedCount: items.length - pricedCount,
  };
}

/**
 * Comparison key for ordering by price — `null` when the unit has none.
 *
 * `null`, never `0`. A unit whose price was never recorded is not the cheapest
 * one; it is not an answer to "cheapest" or to "most expensive" either. Callers
 * order it with {@link compareSortValues}, which keeps such units at the
 * end in BOTH directions — the convention every spreadsheet uses for blanks,
 * and the only one under which sorting cannot invent a ranking.
 *
 * @see lib/array-utils — `compareSortValues`
 */
export function priceSortKey(input: PricedPropertyLike): number | null {
  return getEffectivePrice(input)?.amount ?? null;
}

// =============================================================================
// 5. LEGACY SURFACE — kept so existing callers stay untouched
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
