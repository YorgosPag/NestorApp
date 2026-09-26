/**
 * @fileoverview **Η ΟΨΗ ΤΗΣ ΣΕΛΙΔΑΣ ΠΕΡΙΟΧΗΣ** — καθαρές αποφάσεις «τι δείχνεται, με ποια σειρά» πάνω στη
 * σύνοψη (ADR-890 Φ1). Κανένα JSX, κανένα i18n: τα components μόνο αποδίδουν.
 * @related ADR-890 · `types/area-market.ts` · `lib/market/market-breakdowns.ts`
 * @module components/area-market/area-market-view
 *
 * 🔑 **ΑΝΑΓΩΓΗ ΣΤΟΝ ΓΟΝΕΑ, ΟΠΩΣ ΤΟ ONS.** Όταν μια Δ.Ε. έχει λιγότερες από το κατώφλι αγγελίες σε ένα τμήμα,
 * το ONS ανεβαίνει σε μεγαλύτερη γεωγραφία μέχρι να φτάσει το δείγμα. Εδώ: αν ο **Δήμος** έχει αριθμό για το
 * ίδιο τμήμα, δείχνεται δίπλα στο πλήθος της Δ.Ε., με το όνομα του Δήμου. Ποτέ ως αριθμός της Δ.Ε.
 */

import { bucketsFor } from '@/lib/market/market-breakdowns';
import { MARKET_SEGMENTS, type MarketSegment } from '@/lib/market/market-segments';
import { isReportedStatCell, type ReportedStatCell, type StatCell } from '@/lib/market/market-statistics';
import {
  AREA_BREAKDOWN_AXES,
  ASKING_EXCLUSIONS,
  ASKING_OFFERS,
  type AreaBreakdownAxis,
  type AreaMarketSnapshot,
  type AreaOfferSummary,
  type AreaSegmentSummary,
  type AskingExclusion,
  type AskingOffer,
} from '@/types/area-market';

export interface SegmentView {
  readonly segment: MarketSegment;
  readonly summary: AreaSegmentSummary;
  /** Ο αριθμός του γονέα για το ίδιο τμήμα — **μόνο** όταν ο δικός μας είναι κάτω από το κατώφλι. */
  readonly parentUnitPrice: ReportedStatCell | null;
}

export interface OfferView {
  readonly offer: AskingOffer;
  readonly summary: AreaOfferSummary;
  readonly segments: readonly SegmentView[];
}

function parentCellFor(parent: AreaMarketSnapshot | null, offer: AskingOffer, segment: MarketSegment): ReportedStatCell | null {
  const cell = parent?.offers[offer].segments[segment]?.unitPrice;
  return cell !== undefined && isReportedStatCell(cell) ? cell : null;
}

function segmentViews(snapshot: AreaMarketSnapshot, parent: AreaMarketSnapshot | null, offer: AskingOffer): SegmentView[] {
  const views: SegmentView[] = [];
  for (const segment of MARKET_SEGMENTS) {
    const summary = snapshot.offers[offer].segments[segment];
    if (summary === undefined) continue;
    const parentUnitPrice = isReportedStatCell(summary.unitPrice) ? null : parentCellFor(parent, offer, segment);
    views.push({ segment, summary, parentUnitPrice });
  }
  return views;
}

/** Οι προσφορές που έχουν έστω μία αγγελία, με τα τμήματά τους στη σταθερή σειρά. */
export function offerViews(snapshot: AreaMarketSnapshot, parent: AreaMarketSnapshot | null): readonly OfferView[] {
  return ASKING_OFFERS
    .filter((offer) => snapshot.offers[offer].listings > 0)
    .map((offer) => ({ offer, summary: snapshot.offers[offer], segments: segmentViews(snapshot, parent, offer) }));
}

export interface BreakdownRow {
  readonly key: string;
  readonly cell: StatCell;
}

export interface BreakdownView {
  readonly axis: AreaBreakdownAxis;
  readonly rows: readonly BreakdownRow[];
  readonly undeclared: number;
}

/** Οι αναλύσεις ενός τμήματος, με τους κάδους στη σειρά του πίνακα (όχι του εγγράφου). */
export function breakdownViews(segment: MarketSegment, summary: AreaSegmentSummary): readonly BreakdownView[] {
  const views: BreakdownView[] = [];
  for (const axis of AREA_BREAKDOWN_AXES) {
    const breakdown = summary.breakdowns[axis];
    if (breakdown === undefined) continue;
    const rows = bucketsFor(axis, segment).flatMap((bucket) => {
      const cell = breakdown.buckets[bucket.key];
      return cell === undefined ? [] : [{ key: bucket.key, cell }];
    });
    if (rows.length > 0 || breakdown.undeclared > 0) views.push({ axis, rows, undeclared: breakdown.undeclared });
  }
  return views;
}

/** Οι λόγοι αποκλεισμού με μη μηδενικό πλήθος, στη σταθερή σειρά. */
export function exclusionEntries(summary: AreaOfferSummary): readonly (readonly [AskingExclusion, number])[] {
  return ASKING_EXCLUSIONS.flatMap((reason) => (summary.excluded[reason] > 0 ? [[reason, summary.excluded[reason]] as const] : []));
}
