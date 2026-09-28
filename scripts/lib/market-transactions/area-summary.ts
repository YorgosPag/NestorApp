/**
 * @fileoverview **ΤΑ ΣΤΑΤΙΣΤΙΚΑ ΑΝΑ ΠΕΡΙΟΧΗ** — το μικρό αρχείο που φτάνει στην οθόνη (ADR-889 Φ2).
 * @related ADR-889 §5.3–§5.4 · ADR-890 Φ2 · `src/lib/market/market-transactions-file.ts` (το σχήμα `AreaSummaryFile`)
 *
 * 🔑 **ΜΟΝΟ ΣΥΓΚΡΙΣΙΜΕΣ ΓΡΑΜΜΕΣ.** Η απόφαση είναι γραμμένη στη γραμμή (`unitPrice`, §5.3)· εδώ **δεν**
 * ξαναπαίρνεται. Κάθε κελί περνά από το ΕΝΑ `summarize` — κάτω από το κατώφλι γράφεται **μόνο** το πλήθος.
 *
 * 🔑 **ΤΟ 12ΜΗΝΟ ΜΕΤΡΙΕΤΑΙ ΑΠΟ ΤΗΝ ΠΗΓΗ, ΟΧΙ ΑΠΟ ΤΟ ΡΟΛΟΪ.** Το «έως» είναι η τελευταία ημερομηνία συμβολαίου
 * **όλης** της πηγής (`asOf`). Έτσι η έξοδος μένει ντετερμινιστική, και το 12μηνο δεν «αδειάζει» αν ο
 * γεννήτορας τρέξει μήνες μετά την τελευταία ενημέρωση του gsis.gr.
 *
 * 🔑 **ΠΗΓΗ Γ (αντικειμενική) ΜΟΝΟ ΟΠΟΥ ΣΥΓΚΡΙΝΕΤΑΙ.** Η τιμή ζώνης είναι €/τ.μ. **κτίσματος**. Για γη και
 * θέσεις στάθμευσης ο λόγος «τίμημα / αντικειμενική» δεν σημαίνει κάτι συγκρίσιμο ⇒ `null`, ρητά.
 */

import { bucketOf, YEAR_BUILT_BUCKETS } from '../../../src/lib/market/market-breakdowns';
import { SEGMENT_METRIC, type MarketSegment } from '../../../src/lib/market/market-segments';
import { quarterOf, summarize } from '../../../src/lib/market/market-statistics';
import {
  MARKET_TRANSACTIONS_FORMAT_VERSION,
  type AreaSummaryFile,
  type SegmentSummary,
} from '../../../src/lib/market/market-transactions-file';
import type { ClassifiedRecord } from './market-transactions-file';

const PERCENT = 100;

/** Συγκρίσιμη γραμμή με το τμήμα της — το μόνο που μετρά εδώ. */
interface Comparable {
  readonly item: ClassifiedRecord;
  readonly segment: MarketSegment;
  readonly unitPrice: number;
}

/** `YYYY-MM-DD` ένα έτος πίσω — το αποκλειστικό κάτω όριο του 12μήνου. */
export function twelveMonthsBefore(asOf: string): string {
  return `${Number(asOf.slice(0, 4)) - 1}${asOf.slice(4)}`;
}

function sortedRecord<T>(entries: Iterable<readonly [string, T]>): Record<string, T> {
  return Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Ομαδοποίηση τιμών ανά κλειδί, και σύνοψη κάθε ομάδας. */
function summarizeBy(values: Iterable<readonly [string, number]>): SegmentSummary['quarters'] {
  const groups = new Map<string, number[]>();
  for (const [key, value] of values) {
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [value]);
    else group.push(value);
  }
  return sortedRecord([...groups].map(([key, group]) => [key, summarize(group)] as const));
}

function yearBuiltEntries(recent: readonly Comparable[]): Array<readonly [string, number]> {
  return recent.flatMap(({ item, unitPrice }) => {
    const year = item.record.yearBuilt;
    const bucket = year === null ? null : bucketOf(YEAR_BUILT_BUCKETS, year);
    return bucket === null ? [] : [[bucket.key, unitPrice] as const];
  });
}

/** Πηγή Γ: τιμή ζώνης και λόγος τιμήματος προς αντικειμενική (%), από όσες γραμμές έχουν τιμή ζώνης. */
function zoneFigures(recent: readonly Comparable[]): Pick<SegmentSummary, 'zone' | 'priceToZonePct'> {
  const zones: number[] = [];
  const ratios: number[] = [];
  for (const { item } of recent) {
    const { zonePrice, mainArea, price } = item.record;
    if (zonePrice === null || zonePrice <= 0 || mainArea === null || mainArea <= 0) continue;
    zones.push(zonePrice);
    ratios.push((price / (mainArea * zonePrice)) * PERCENT);
  }
  return { zone: summarize(zones), priceToZonePct: summarize(ratios) };
}

function segmentSummary(segment: MarketSegment, rows: readonly Comparable[], cutoff: string): SegmentSummary {
  const recent = rows.filter(({ item }) => item.record.contractDate > cutoff);
  const hasBuilding = SEGMENT_METRIC[segment] === 'perSqmBuilding';
  return {
    quarters: summarizeBy(rows.map(({ item, unitPrice }) => [quarterOf(item.record.contractDate), unitPrice] as const)),
    last12: summarize(recent.map(({ unitPrice }) => unitPrice)),
    yearBuilt: hasBuilding ? summarizeBy(yearBuiltEntries(recent)) : {},
    ...(hasBuilding ? zoneFigures(recent) : { zone: null, priceToZonePct: null }),
  };
}

function comparablesBySegment(items: readonly ClassifiedRecord[]): Map<MarketSegment, Comparable[]> {
  const bySegment = new Map<MarketSegment, Comparable[]>();
  for (const item of items) {
    if (item.segment === null || item.unitPrice === null) continue;
    const comparable: Comparable = { item, segment: item.segment, unitPrice: item.unitPrice };
    const list = bySegment.get(item.segment);
    if (list === undefined) bySegment.set(item.segment, [comparable]);
    else list.push(comparable);
  }
  return bySegment;
}

/** **Το αρχείο στατιστικών μιας περιοχής** — ντετερμινιστικό για κάθε σειρά εισόδου. */
export function buildAreaSummaryFile(areaId: string, items: readonly ClassifiedRecord[], asOf: string): AreaSummaryFile {
  const cutoff = twelveMonthsBefore(asOf);
  const segments = sortedRecord(
    [...comparablesBySegment(items)].map(([segment, rows]) => [segment, segmentSummary(segment, rows, cutoff)] as const),
  );
  return { v: MARKET_TRANSACTIONS_FORMAT_VERSION, id: areaId, asOf, segments };
}
