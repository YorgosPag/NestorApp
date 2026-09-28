/**
 * @fileoverview **ΤΑΣΗ ΚΑΙ ΑΠΟΔΟΣΗ ΤΗΣ ΣΕΛΙΔΑΣ ΠΕΡΙΟΧΗΣ** — καθαρές αποφάσεις «τι δείχνεται» (ADR-890 §13, Φ3).
 * Κανένα JSX, κανένα i18n.
 * @related `area-market-view.ts` (οι ζητούμενες) · `area-contracts-view.ts` (τα συμβόλαια) ·
 *   `lib/market/area-market-series.ts` (η σειρά) · `lib/market/market-statistics.ts` (οι κανόνες κατωφλίου)
 * @module components/area-market/area-market-insight-view
 *
 * 🔑 **ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ΚΑΤΩ ΑΠΟ ΤΟ ΚΑΤΩΦΛΙ, ΟΥΤΕ ΩΣ ΠΗΛΙΚΟ.** Αλλαγή 3/6/12 μηνών και απόδοση είναι **λόγοι δύο
 * διαμέσων**: δείχνονται μόνο όταν **και οι δύο** δημοσιεύονται (`medianGapPct` · `grossYieldPct`).
 */

import { MARKET_SEGMENTS, type MarketSegment } from '@/lib/market/market-segments';
import {
  grossYieldPct,
  isReportedStatCell,
  medianGapPct,
  monthsEndingAt,
  shiftMonth,
  type StatCell,
} from '@/lib/market/market-statistics';
import type { AreaSummaryFile } from '@/lib/market/market-transactions-file';
import type { AreaMarketSeriesPoints, AreaMarketSnapshot, AskingOffer } from '@/types/area-market';

/** Πόσους μήνες δείχνει η γραμμή τάσης ζητούμενων (ADR-890 §6 Φ3: «3μ / 6μ / 12μ»). */
export const ASKING_TREND_MONTHS = 12;

/** Κάτω από τόσους δημοσιευμένους μήνες, καμία γραμμή — δύο σημεία δεν είναι τάση. */
export const ASKING_TREND_MIN_POINTS = 3;

/** Οι αποστάσεις που μετρά η τάση, σε μήνες. */
const ASKING_TREND_CHANGES = [3, 6, 12] as const;

interface AskingTrendPoint {
  readonly month: string;
  readonly cell: StatCell;
}

interface AskingTrendChange {
  readonly months: (typeof ASKING_TREND_CHANGES)[number];
  /** (τώρα ÷ πριν − 1) σε %. Υπάρχει **μόνο** όταν και οι δύο μήνες περνούν το κατώφλι. */
  readonly pct: number;
}

/** Η τάση ενός τμήματος μιας προσφοράς (ADR-890 §13). */
export interface AskingTrendView {
  readonly points: readonly AskingTrendPoint[];
  /** Πόσοι μήνες έχουν αριθμό. Κάτω από {@link ASKING_TREND_MIN_POINTS} ⇒ κείμενο, όχι γραμμή. */
  readonly reported: number;
  readonly changes: readonly AskingTrendChange[];
  /** Ο πρώτος μήνας της σειράς της περιοχής — για το τίμιο «η μέτρηση ξεκίνησε τον …». */
  readonly since: string;
}

/** Η σειρά της περιοχής και ο τρέχων μήνας της (ο μήνας της τελευταίας νύχτας, όχι του ρολογιού). */
export interface AreaSeriesInput {
  readonly points: AreaMarketSeriesPoints;
  readonly lastMonth: string;
}

/**
 * **Η τάση ενός τμήματος.** Μήνας χωρίς σημείο ή κάτω από το κατώφλι ⇒ κελί χωρίς διάμεσο: η γραμμή **δεν** τον
 * γεφυρώνει (ίδιος κανόνας με τα τρίμηνα των συμβολαίων). Οι αλλαγές βγαίνουν από το **ίδιο** `medianGapPct` με
 * την απόσταση ζητούμενης ↔ συμβολαίου.
 */
export function askingTrendView(series: AreaSeriesInput, offer: AskingOffer, segment: MarketSegment): AskingTrendView {
  const cellOf = (month: string): StatCell => series.points[month]?.offers[offer][segment] ?? { n: 0 };
  const points = monthsEndingAt(series.lastMonth, ASKING_TREND_MONTHS).map((month) => ({ month, cell: cellOf(month) }));
  const now = cellOf(series.lastMonth);
  const changes = ASKING_TREND_CHANGES.flatMap((months) => {
    const pct = medianGapPct(now, cellOf(shiftMonth(series.lastMonth, -months)));
    return pct === null ? [] : [{ months, pct }];
  });
  const since = Object.keys(series.points).sort()[0] ?? series.lastMonth;
  return { points, reported: points.filter((point) => isReportedStatCell(point.cell)).length, changes, since };
}

/** Η ακαθάριστη απόδοση ενός τμήματος (ADR-890 §5.4 · §13). */
export interface YieldView {
  readonly segment: MarketSegment;
  /** Ενοίκιο ÷ **ζητούμενη** τιμή πώλησης (πρακτική idealista) — `null` κάτω από το κατώφλι. */
  readonly asking: number | null;
  /** Ενοίκιο ÷ **τιμή συμβολαίου** 12μήνου (ADR-889) — `null` όταν δεν δημοσιεύεται κάποιο από τα δύο. */
  readonly contract: number | null;
  /** Τα πλήθη, για το τίμιο «χρειάζονται 5 + 5 — εδώ Χ και Ψ». */
  readonly saleCount: number;
  readonly rentCount: number;
}

/**
 * **Τα τμήματα που έχουν ΚΑΙ ζητούμενες πώλησης ΚΑΙ ενοικίου** — μόνο εκεί η απόδοση έχει νόημα. Η δεύτερη εκδοχή,
 * με τιμή **συμβολαίου**, δεν τη δίνει κανένα portal: κανένα δεν έχει και τις δύο πηγές στο ίδιο τμήμα αγοράς.
 */
export function yieldViews(snapshot: AreaMarketSnapshot, contracts: AreaSummaryFile | null): readonly YieldView[] {
  return MARKET_SEGMENTS.flatMap((segment) => {
    const sale = snapshot.offers.sale.segments[segment];
    const rent = snapshot.offers.rent.segments[segment];
    if (sale === undefined || rent === undefined) return [];
    return [{
      segment,
      asking: grossYieldPct(rent.unitPrice, sale.unitPrice),
      contract: grossYieldPct(rent.unitPrice, contracts?.segments[segment]?.last12),
      saleCount: sale.unitPrice.n,
      rentCount: rent.unitPrice.n,
    }];
  });
}
