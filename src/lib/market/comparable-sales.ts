/**
 * @fileoverview **ΣΥΓΚΡΙΣΙΜΕΣ ΠΩΛΗΣΕΙΣ** — ποια συμβόλαια της περιοχής μοιάζουν με ένα ακίνητο, και **γιατί**
 * (ADR-889 Φ2 · ADR-890 Φ2).
 * @related `market-transactions-file.ts` (οι γραμμές) · `market-statistics.ts` (το κατώφλι) · `market-segments.ts`
 * @module lib/market/comparable-sales
 *
 * 🔑 **ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ, ΚΑΙ ΠΑΡΑΠΑΝΩ.** Rightmove/Zoopla (Land Registry), SeLoger/Meilleurs Agents (DVF) και
 * Zillow/Redfin δείχνουν μεμονωμένες πωλήσεις όταν η πηγή τις δίνει. Εδώ κάθε συγκρίσιμη φέρει **τις διαφορές
 * της** από το ακίνητο (επιφάνεια, έτος, όροφος, πόσο παλιά) — ο άνθρωπος κρίνει την ομοιότητα, δεν του ζητάμε
 * να εμπιστευτεί ένα «σκορ».
 *
 * 🔑 **ΤΟ ΙΔΙΟ ΚΑΤΩΦΛΙ.** Δεξαμενή κάτω από `MARKET_STAT_MIN_SAMPLE` ⇒ **καμία** γραμμή: σε περιοχή με 2 πωλήσεις
 * ο κατάλογος θα ήταν απλώς «οι πωλήσεις της περιοχής», όχι «οι όμοιες».
 *
 * 🔑 **ΜΗΝΑΣ, ΟΧΙ ΗΜΕΡΑ.** Η πηγή δίνει ημερομηνία συμβολαίου· η οθόνη δεν χρειάζεται ακρίβεια ημέρας για να
 * συγκρίνει, και η ημέρα είναι το πεδίο που φέρνει μια γραμμή πιο κοντά σε συγκεκριμένη πράξη.
 *
 * ⚠️ **Καθαρό φύλλο**: καμία ανάγνωση αρχείου, καμία ώρα συστήματος — το «τώρα» είναι το `asOf` της πηγής.
 */

import { SEGMENT_METRIC, type MarketSegment } from './market-segments';
import { MARKET_STAT_MIN_SAMPLE } from './market-statistics';
import { ROW, mamaFloorLevel, type EncodedRow } from './market-transactions-file';

/** Πόσες συγκρίσιμες δείχνονται. */
export const COMPARABLE_SALES_LIMIT = 8;
/** Το πρώτο παράθυρο· αν δεν γεμίσει ο κατάλογος, όλο το αρχείο (5 έτη). */
const RECENT_WINDOW_MONTHS = 24;

/** Βάρη και κλίμακες της απόστασης: 1 μονάδα = «αισθητά διαφορετικό». */
const WEIGHTS = { size: 1, age: 0.6, floor: 0.4, recency: 0.5 } as const;
const SCALE = { size: Math.log(1.5), ageYears: 15, floors: 3, months: 12 } as const;
/** Όταν το ακίνητο δηλώνει κάτι που η γραμμή δεν έχει: ίσο με «αισθητά διαφορετικό». */
const MISSING_PENALTY = 1;

/** Ό,τι ξέρουμε για το ακίνητο. `null` = δεν δηλώθηκε ⇒ ο άξονας **δεν** μετρά. */
export interface ComparableTarget {
  readonly segment: MarketSegment;
  readonly size: number | null;
  readonly yearBuilt: number | null;
  readonly floor: number | null;
}

export interface ComparableSale {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly price: number;
  /** € ανά μονάδα του τμήματος (τ.μ. κτίσματος · τ.μ. οικοπέδου · θέση). */
  readonly unitPrice: number;
  readonly size: number | null;
  readonly yearBuilt: number | null;
  readonly floor: number | null;
  /** Η ετικέτα «Διαμέρισμα» της πηγής. */
  readonly district: string | null;
  readonly monthsAgo: number;
}

export type ComparableSalesResult =
  | { readonly kind: 'suppressed'; readonly pool: number }
  | {
      readonly kind: 'ready';
      readonly pool: number;
      readonly windowMonths: number | null;
      readonly sales: readonly ComparableSale[];
      /** Θέση της ζητούμενης τιμής μονάδας στη δεξαμενή (0–100), ή `null` χωρίς ζητούμενη τιμή. */
      readonly askingPercentile: number | null;
    };

export interface ComparableSource {
  readonly rows: readonly EncodedRow[];
  readonly districts: readonly string[];
  /** δείκτης κατηγορίας → τμήμα (από το ευρετήριο). */
  readonly categorySegments: readonly (MarketSegment | null)[];
  /** `YYYY-MM-DD` — η τελευταία ημερομηνία της πηγής. */
  readonly asOf: string;
}

function monthIndex(isoDate: string): number {
  return Number(isoDate.slice(0, 4)) * 12 + Number(isoDate.slice(5, 7)) - 1;
}

function numberAt(row: EncodedRow, field: number): number | null {
  const value = row[field];
  return typeof value === 'number' ? value : null;
}

/** Η επιφάνεια που μετρά για το τμήμα (ίδια λογική με τον κανόνα συγκρισιμότητας του γεννήτορα). */
function sizeOf(row: EncodedRow, segment: MarketSegment): number | null {
  switch (SEGMENT_METRIC[segment]) {
    case 'perSqmBuilding':
      return numberAt(row, ROW.mainArea);
    case 'perSqmPlot':
      return numberAt(row, ROW.plotArea);
    case 'perUnit':
      return null;
  }
}

function toSale(row: EncodedRow, source: ComparableSource, segment: MarketSegment): ComparableSale {
  const date = String(row[ROW.date]);
  const district = numberAt(row, ROW.district);
  return {
    month: date.slice(0, 7),
    price: numberAt(row, ROW.price) ?? 0,
    unitPrice: numberAt(row, ROW.unitPrice) ?? 0,
    size: sizeOf(row, segment),
    yearBuilt: numberAt(row, ROW.yearBuilt),
    floor: mamaFloorLevel(row[ROW.floor]),
    district: district === null ? null : (source.districts[district] ?? null),
    monthsAgo: monthIndex(source.asOf) - monthIndex(date),
  };
}

/** Μία συνιστώσα: 0 αν ο άξονας δεν δηλώθηκε στο ακίνητο, ποινή αν λείπει από τη γραμμή. */
function component(target: number | null, value: number | null, distance: (a: number, b: number) => number): number {
  if (target === null) return 0;
  return value === null ? MISSING_PENALTY : distance(target, value);
}

export function saleDistance(sale: ComparableSale, target: ComparableTarget): number {
  const size = component(target.size, sale.size, (a, b) => Math.abs(Math.log(b / a)) / SCALE.size);
  const age = component(target.yearBuilt, sale.yearBuilt, (a, b) => Math.abs(a - b) / SCALE.ageYears);
  const floor = SEGMENT_METRIC[target.segment] === 'perSqmBuilding'
    ? component(target.floor, sale.floor, (a, b) => Math.abs(a - b) / SCALE.floors)
    : 0;
  return WEIGHTS.size * size + WEIGHTS.age * age + WEIGHTS.floor * floor + (WEIGHTS.recency * sale.monthsAgo) / SCALE.months;
}

/** Σταθερή σειρά: απόσταση, μετά νεότερο, μετά φθηνότερο — ίδια είσοδος ⇒ ίδιος κατάλογος. */
function compareCandidates(a: { sale: ComparableSale; distance: number }, b: { sale: ComparableSale; distance: number }): number {
  return a.distance - b.distance || a.sale.monthsAgo - b.sale.monthsAgo || a.sale.unitPrice - b.sale.unitPrice;
}

/** Ποσοστό της δεξαμενής με τιμή μονάδας ≤ της ζητούμενης (0–100). */
export function percentileRank(value: number, values: readonly number[]): number {
  if (values.length === 0) return 0;
  const atOrBelow = values.reduce((count, v) => (v <= value ? count + 1 : count), 0);
  return Math.round((atOrBelow / values.length) * 100);
}

/** Οι συγκρίσιμες γραμμές του τμήματος, ως πωλήσεις. */
function segmentPool(source: ComparableSource, segment: MarketSegment): ComparableSale[] {
  return source.rows
    .filter((row) => {
      const category = numberAt(row, ROW.category);
      return category !== null && source.categorySegments[category] === segment && numberAt(row, ROW.unitPrice) !== null;
    })
    .map((row) => toSale(row, source, segment));
}

/**
 * **Οι συγκρίσιμες πωλήσεις ενός ακινήτου** — και πού πέφτει η ζητούμενη τιμή του.
 * @param askingUnitPrice ζητούμενη τιμή στη μονάδα του τμήματος, ή `null`
 */
export function findComparableSales(source: ComparableSource, target: ComparableTarget, askingUnitPrice: number | null): ComparableSalesResult {
  const all = segmentPool(source, target.segment);
  const recent = all.filter((sale) => sale.monthsAgo < RECENT_WINDOW_MONTHS);
  const useRecent = recent.length >= COMPARABLE_SALES_LIMIT;
  const pool = useRecent ? recent : all;
  if (pool.length < MARKET_STAT_MIN_SAMPLE) return { kind: 'suppressed', pool: pool.length };

  const sales = pool
    .map((sale) => ({ sale, distance: saleDistance(sale, target) }))
    .sort(compareCandidates)
    .slice(0, COMPARABLE_SALES_LIMIT)
    .map(({ sale }) => sale);
  return {
    kind: 'ready',
    pool: pool.length,
    windowMonths: useRecent ? RECENT_WINDOW_MONTHS : null,
    sales,
    askingPercentile: askingUnitPrice === null ? null : percentileRank(askingUnitPrice, pool.map((sale) => sale.unitPrice)),
  };
}
