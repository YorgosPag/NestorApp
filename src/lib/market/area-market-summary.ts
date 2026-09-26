/**
 * @fileoverview **Η ΣΥΝΟΨΗ ΖΗΤΟΥΜΕΝΩΝ ΤΙΜΩΝ ΑΝΑ ΠΕΡΙΟΧΗ** — καθαρή συνάρτηση: αγγελίες → ένα έγγραφο ανά
 * περιοχή (ADR-890 §5.2). Κανένα I/O· το ρολόι και η βάση ζουν στον καλούντα.
 * @related ADR-890 · `types/area-market.ts` · `services/market/area-market-rollup.service.ts` (ο γραφέας)
 * @module lib/market/area-market-summary
 *
 * 🔑 **ΜΟΝΟ ΖΗΤΟΥΜΕΝΕΣ ΤΙΜΕΣ.** Πώληση = `commercial.askingPrice`, ενοίκιο = `commercial.rentPrice`. Το
 * `resolveDisplayPrice` **δεν** χρησιμοποιείται επίτηδες: πέφτει σε `finalPrice` (τιμή **συμβολαίου**), και
 * μια ζητούμενη διάμεσος με ένα συμβόλαιο μέσα δεν είναι ούτε το ένα ούτε το άλλο.
 *
 * 🔑 **Η ΠΕΡΙΟΧΗ ΔΙΑΒΑΖΕΤΑΙ, ΔΕΝ ΥΠΟΛΟΓΙΖΕΤΑΙ**: από το `adminArea` που γράφτηκε κατά τη δημοσίευση (Φ0).
 * Κάθε αγγελία μετρά στον δήμο **και** στη Δ.Ε. της (όπου υπάρχει)· ο δήμος είναι πάντα το άθροισμα.
 *
 * 🔑 **Η ΑΛΗΘΟΦΑΝΕΙΑ ΚΡΙΝΕΤΑΙ ΑΠΟ ΤΟ ΥΠΑΡΧΟΝ SSoT** (`assessModePricePlausibility`), με τη ζώνη της
 * **προσφοράς** — όχι της εμπορικής κατάστασης, γιατί μια αγγελία πώλησης & ενοικίου έχει δύο τιμές.
 */

import { assessModePricePlausibility, isActionableVerdict } from '@/constants/price-plausibility';
import { isListedCommercialStatus } from '@/constants/commercial-statuses';
import { adminAreaFieldOfLevel, type AdminAreaField } from '@/lib/geo/admin-area-of-point';
import type { OfferKind } from '@/types/property-offers';
import type { PublicListing } from '@/types/public-listing';
import {
  AREA_MARKET_LEVELS,
  AREA_MARKET_SNAPSHOT_SCHEMA_VERSION,
  ASKING_EXCLUSIONS,
  ASKING_OFFERS,
  type AreaBreakdown,
  type AreaBreakdownAxis,
  type AreaMarketSnapshot,
  type AreaOfferSummary,
  type AreaSegmentSummary,
  type AskingExclusion,
  type AskingOffer,
} from '@/types/area-market';
import { bucketOf, bucketsFor, SEGMENT_BREAKDOWN_AXES } from './market-breakdowns';
import { MARKET_SEGMENTS, SEGMENT_METRIC, marketSegmentOfType, type MarketSegment } from './market-segments';
import { summarize, type StatCell } from './market-statistics';

const AREA_MARKET_FIELDS: readonly AdminAreaField[] = AREA_MARKET_LEVELS.map((level) => {
  const field = adminAreaFieldOfLevel(level);
  if (field === null) throw new Error(`Admin level ${level} has no adminArea field`);
  return field;
});

/** Η προσφορά της αγγελίας που αντιστοιχεί σε κάθε ζητούμενη τιμή, και το πεδίο της τιμής. */
const OFFER_SOURCE: Readonly<Record<AskingOffer, { readonly kind: OfferKind; readonly price: 'askingPrice' | 'rentPrice' }>> = {
  sale: { kind: 'sell', price: 'askingPrice' },
  rent: { kind: 'leaseOut', price: 'rentPrice' },
};

/** Οι περιοχές σελίδας στις οποίες μετρά η αγγελία (δήμος, Δ.Ε.)· κενό = χωρίς απόδοση. */
export function areaMarketKeysOf(listing: PublicListing): readonly string[] {
  const area = listing.adminArea;
  if (area === null) return [];
  return AREA_MARKET_FIELDS.map((field) => area[field]).filter((id): id is string => id !== null);
}

/** Μία ζητούμενη τιμή που μπήκε στα στατιστικά. */
interface Observation {
  readonly listing: PublicListing;
  readonly segment: MarketSegment;
  readonly price: number;
  readonly size: number | null;
  readonly unitPrice: number;
}

type Verdict = { readonly observed: Observation } | { readonly excluded: AskingExclusion } | null;

/** Προσάρτηση σε ομάδα χάρτη — O(1), όχι αντιγραφή πίνακα ανά στοιχείο. */
function appendTo<K, V>(groups: Map<K, V[]>, key: K, value: V): void {
  const group = groups.get(key);
  if (group === undefined) groups.set(key, [value]);
  else group.push(value);
}

function positive(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

/** Τι λέει η αγγελία για αυτή την προσφορά: παρατήρηση, αποκλεισμός με λόγο, ή `null` (δεν την προσφέρει). */
export function observeAsking(listing: PublicListing, offer: AskingOffer): Verdict {
  const source = OFFER_SOURCE[offer];
  if (!listing.offerKinds.includes(source.kind) || !isListedCommercialStatus(listing.commercialStatus)) return null;

  const price = positive(listing.commercial[source.price]);
  if (price === null) return { excluded: 'noPrice' };

  const segment = marketSegmentOfType(listing.type);
  if (segment === null) return { excluded: 'noSegment' };

  const size = positive(listing.areaSqm);
  const perUnit = SEGMENT_METRIC[segment] === 'perUnit';
  if (!perUnit && size === null) return { excluded: 'noSize' };

  const verdict = assessModePricePlausibility({
    mode: offer,
    propertyType: listing.type,
    askingPrice: price,
    grossArea: perUnit ? null : size,
  }).verdict;
  if (isActionableVerdict(verdict)) return { excluded: 'implausible' };

  const unitPrice = perUnit || size === null ? price : price / size;
  return { observed: { listing, segment, price, size, unitPrice } };
}

function axisValue(axis: AreaBreakdownAxis, observation: Observation): number | null {
  switch (axis) {
    case 'size':
      return observation.size;
    case 'bedrooms':
      return observation.listing.bedrooms;
    case 'floor':
      return observation.listing.floor;
  }
}

function breakdown(axis: AreaBreakdownAxis, segment: MarketSegment, observations: readonly Observation[]): AreaBreakdown {
  const buckets = bucketsFor(axis, segment);
  const values = new Map<string, number[]>();
  let undeclared = 0;
  for (const observation of observations) {
    const value = axisValue(axis, observation);
    const bucket = value === null ? null : bucketOf(buckets, value);
    if (bucket === null) {
      undeclared += 1;
      continue;
    }
    appendTo(values, bucket.key, observation.unitPrice);
  }
  const cells: Record<string, StatCell> = {};
  for (const bucket of buckets) {
    const bucketValues = values.get(bucket.key);
    if (bucketValues !== undefined) cells[bucket.key] = summarize(bucketValues);
  }
  return { buckets: cells, undeclared };
}

function segmentSummary(segment: MarketSegment, observations: readonly Observation[]): AreaSegmentSummary {
  const breakdowns: Partial<Record<AreaBreakdownAxis, AreaBreakdown>> = {};
  for (const axis of SEGMENT_BREAKDOWN_AXES[segment]) breakdowns[axis] = breakdown(axis, segment, observations);
  return {
    unitPrice: summarize(observations.map((observation) => observation.unitPrice)),
    price: summarize(observations.map((observation) => observation.price)),
    size: summarize(observations.flatMap((observation) => (observation.size === null ? [] : [observation.size]))),
    breakdowns,
  };
}

function emptyExclusions(): Record<AskingExclusion, number> {
  return Object.fromEntries(ASKING_EXCLUSIONS.map((reason) => [reason, 0])) as Record<AskingExclusion, number>;
}

/** Μία προσφορά μιας περιοχής. */
export function summarizeOffer(listings: readonly PublicListing[], offer: AskingOffer): AreaOfferSummary {
  const excluded = emptyExclusions();
  const bySegment = new Map<MarketSegment, Observation[]>();
  let offered = 0;
  for (const listing of listings) {
    const verdict = observeAsking(listing, offer);
    if (verdict === null) continue;
    offered += 1;
    if ('excluded' in verdict) {
      excluded[verdict.excluded] += 1;
      continue;
    }
    appendTo(bySegment, verdict.observed.segment, verdict.observed);
  }
  const segments: Partial<Record<MarketSegment, AreaSegmentSummary>> = {};
  let counted = 0;
  for (const segment of MARKET_SEGMENTS) {
    const observations = bySegment.get(segment);
    if (observations === undefined) continue;
    counted += observations.length;
    segments[segment] = segmentSummary(segment, observations);
  }
  return { listings: offered, counted, excluded, segments };
}

/** Η σύνοψη μιας περιοχής για μία ημέρα. */
export function summarizeArea(areaId: string, day: string, listings: readonly PublicListing[]): AreaMarketSnapshot {
  const offers = Object.fromEntries(
    ASKING_OFFERS.map((offer) => [offer, summarizeOffer(listings, offer)]),
  ) as Record<AskingOffer, AreaOfferSummary>;
  return {
    schemaVersion: AREA_MARKET_SNAPSHOT_SCHEMA_VERSION,
    areaId,
    day,
    listingCount: listings.length,
    offers,
  };
}

/** Αγγελίες ομαδοποιημένες ανά περιοχή σελίδας, και πόσες δεν είχαν απόδοση. */
export interface AreaListingGroups {
  readonly byArea: ReadonlyMap<string, readonly PublicListing[]>;
  readonly unassigned: number;
}

export function groupListingsByArea(listings: readonly PublicListing[]): AreaListingGroups {
  const byArea = new Map<string, PublicListing[]>();
  let unassigned = 0;
  for (const listing of listings) {
    const keys = areaMarketKeysOf(listing);
    if (keys.length === 0) unassigned += 1;
    for (const key of keys) appendTo(byArea, key, listing);
  }
  return { byArea, unassigned };
}
