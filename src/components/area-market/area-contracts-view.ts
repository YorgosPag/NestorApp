/**
 * @fileoverview **Η ΟΨΗ ΤΩΝ ΤΙΜΩΝ ΣΥΜΒΟΛΑΙΩΝ** — καθαρές αποφάσεις «τι δείχνεται» πάνω στο αρχείο στατιστικών
 * του ADR-889 (ADR-890 Φ2). Κανένα JSX, κανένα i18n.
 * @related `area-market-view.ts` (η ίδια απόφαση για τις ζητούμενες) · `lib/market/market-transactions-file.ts`
 * @module components/area-market/area-contracts-view
 *
 * 🏆 **Η ΑΠΟΣΤΑΣΗ ΖΗΤΟΥΜΕΝΗΣ ↔ ΣΥΜΒΟΛΑΙΟΥ** (ADR-890 §3): «ζητούν +X% από όσα υπογράφονται» — η πληροφορία που
 * κανένα portal δεν δίνει, γιατί κανένα δεν έχει και τις δύο πηγές στο ίδιο τμήμα αγοράς. Δείχνεται **μόνο** όταν
 * **και τα δύο** κελιά περνούν το κατώφλι· αλλιώς θα ήταν διαίρεση θορύβου με θόρυβο.
 *
 * 🔑 **ΑΝΑΓΩΓΗ ΣΤΟΝ ΔΗΜΟ, ΟΠΩΣ ΣΤΙΣ ΖΗΤΟΥΜΕΝΕΣ** — ποτέ ντυμένη ως αριθμός της Δ.Ε.
 */

import { YEAR_BUILT_BUCKETS } from '@/lib/market/market-breakdowns';
import { MARKET_SEGMENTS, type MarketSegment } from '@/lib/market/market-segments';
import {
  isReportedStatCell,
  quarterOf,
  quartersEndingAt,
  type ReportedStatCell,
  type StatCell,
} from '@/lib/market/market-statistics';
import type { AreaSummaryFile, SegmentSummary } from '@/lib/market/market-transactions-file';
import type { AreaMarketSnapshot } from '@/types/area-market';

/** Πόσα τρίμηνα δείχνει η γραμμή τάσης (ADR-889 §6 Φ2: «τάση 8 τριμήνων»). */
export const CONTRACT_TREND_QUARTERS = 8;

const PERCENT = 100;

export interface ContractTrendPoint {
  readonly quarter: string;
  readonly year: number;
  readonly q: number;
  readonly cell: StatCell;
}

export interface ContractSegmentView {
  readonly segment: MarketSegment;
  readonly summary: SegmentSummary;
  /** Ο αριθμός του Δήμου — **μόνο** όταν ο δικός μας είναι κάτω από το κατώφλι. */
  readonly parentLast12: ReportedStatCell | null;
  /** (ζητούμενη ÷ συμβολαίου − 1) σε %, ή `null` όταν κάποιο από τα δύο δεν δημοσιεύεται. */
  readonly askGapPct: number | null;
  readonly trend: readonly ContractTrendPoint[];
  readonly yearBuilt: readonly YearBuiltRow[];
}

/** Μία γραμμή του πίνακα έτους: το κελί συμβολαίων και η απόσταση της ζητούμενης **του ίδιου κάδου** (ADR-890 §12). */
export interface YearBuiltRow {
  readonly key: string;
  readonly cell: StatCell;
  readonly askGapPct: number | null;
}

function reported(cell: StatCell | undefined | null): ReportedStatCell | null {
  return cell !== undefined && cell !== null && isReportedStatCell(cell) ? cell : null;
}

/** (ζητούμενη ÷ συμβολαίου − 1) σε %, **μόνο** όταν και τα δύο κελιά περνούν το κατώφλι. */
export function gapPct(ask: StatCell | undefined | null, contract: StatCell | undefined | null): number | null {
  const asked = reported(ask);
  const signed = reported(contract);
  if (asked === null || signed === null || signed.median <= 0) return null;
  return Math.round((asked.median / signed.median - 1) * PERCENT);
}

/** Η απόσταση ζητούμενης ↔ συμβολαίου για το ίδιο τμήμα, από την πλευρά της **πώλησης**. */
export function askGapPct(asking: AreaMarketSnapshot | null, segment: MarketSegment, contract: StatCell): number | null {
  return gapPct(asking?.offers.sale.segments[segment]?.unitPrice, contract);
}

export function contractTrend(summary: SegmentSummary, asOf: string): readonly ContractTrendPoint[] {
  return quartersEndingAt(quarterOf(asOf), CONTRACT_TREND_QUARTERS).map((quarter) => ({
    quarter,
    year: Number(quarter.slice(0, 4)),
    q: Number(quarter.slice(6)),
    cell: summary.quarters[quarter] ?? { n: 0 },
  }));
}

/**
 * Οι γραμμές έτους, με την απόσταση της ζητούμενης **ανά κάδο**. Στιγμιότυπο πριν από τον άξονα (`yearBuilt` απών,
 * ADR-890 §12.1) ⇒ `null` σε κάθε γραμμή — «δεν μετρήθηκε», ποτέ «0%».
 */
function yearBuiltRows(summary: SegmentSummary, asking: AreaMarketSnapshot | null, segment: MarketSegment): readonly YearBuiltRow[] {
  const askingBuckets = asking?.offers.sale.segments[segment]?.breakdowns.yearBuilt?.buckets;
  return YEAR_BUILT_BUCKETS.flatMap((bucket) => {
    const cell = summary.yearBuilt[bucket.key];
    return cell === undefined ? [] : [{ key: bucket.key, cell, askGapPct: gapPct(askingBuckets?.[bucket.key], cell) }];
  });
}

/** Τα τμήματα με έστω ένα συγκρίσιμο συμβόλαιο, στη σταθερή σειρά των τμημάτων. */
export function contractSegmentViews(
  own: AreaSummaryFile,
  parent: AreaSummaryFile | null,
  asking: AreaMarketSnapshot | null,
): readonly ContractSegmentView[] {
  return MARKET_SEGMENTS.flatMap((segment) => {
    const summary = own.segments[segment];
    if (summary === undefined) return [];
    const parentLast12 = isReportedStatCell(summary.last12) ? null : reported(parent?.segments[segment]?.last12);
    return [{
      segment,
      summary,
      parentLast12,
      askGapPct: askGapPct(asking, segment, summary.last12),
      trend: contractTrend(summary, own.asOf),
      yearBuilt: yearBuiltRows(summary, asking, segment),
    }];
  });
}
