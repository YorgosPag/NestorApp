/**
 * ADR-890 §13 — τάση και απόδοση της σελίδας περιοχής: τα κενά μένουν κενά, οι μεταβολές μόνο όταν και οι δύο μήνες
 * δημοσιεύονται, η απόδοση μόνο σε τμήμα με πώληση ΚΑΙ ενοίκιο, και με τιμή συμβολαίου όπου υπάρχει.
 */

import {
  askingTrendView,
  ASKING_TREND_MONTHS,
  yieldViews,
} from '@/components/area-market/area-market-insight-view';
import { offerViews } from '@/components/area-market/area-market-view';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { summarizeArea } from '@/lib/market/area-market-summary';
import type { AreaSummaryFile } from '@/lib/market/market-transactions-file';
import type { AreaMarketSeriesPoints } from '@/types/area-market';

const cell = (median: number) => ({ n: 6, median, p25: median, p75: median });
const point = (median: number | null) => ({
  asOf: '2026-01-31',
  offers: { sale: median === null ? {} : { apartment: cell(median) }, rent: {} },
});

describe('askingTrendView', () => {
  const points: AreaMarketSeriesPoints = {
    '2025-09': point(2000),
    '2026-06': point(2100),
    '2026-07': { asOf: '2026-07-31', offers: { sale: { apartment: { n: 2 } }, rent: {} } },
    '2026-09': point(2200),
  };
  const view = askingTrendView({ points, lastMonth: '2026-09' }, 'sale', 'apartment');

  it('12 μήνες ως τον τελευταίο· μήνας απών ή κάτω από το κατώφλι ⇒ κελί χωρίς διάμεσο (κενό)', () => {
    expect(view.points).toHaveLength(ASKING_TREND_MONTHS);
    expect(view.points[0].month).toBe('2025-10');
    expect(view.points.find((p) => p.month === '2026-07')?.cell).toEqual({ n: 2 });
    expect(view.points.find((p) => p.month === '2026-08')?.cell).toEqual({ n: 0 });
    expect(view.reported).toBe(2);
  });

  it('μεταβολή ΜΟΝΟ όπου και οι δύο μήνες δημοσιεύονται (3μ ναι · 6μ όχι · 12μ ναι)', () => {
    expect(view.changes).toEqual([{ months: 3, pct: 5 }, { months: 12, pct: 10 }]);
  });

  it('«η μέτρηση ξεκίνησε» = ο πρώτος μήνας της σειράς', () => {
    expect(view.since).toBe('2025-09');
  });
});

describe('offerViews + σειρά', () => {
  it('χωρίς σειρά ⇒ trend: null σε κάθε τμήμα (περιοχή πριν από την πρώτη νύχτα της σειράς)', () => {
    const snapshot = summarizeArea('municipality:0701', '2026-09-28', [listing({ id: 'prop_1' })]);
    expect(offerViews(snapshot, null)[0].segments[0].trend).toBeNull();
    expect(offerViews(snapshot, null, { points: {}, lastMonth: '2026-09' })[0].segments[0].trend?.reported).toBe(0);
  });
});

describe('yieldViews', () => {
  const rentAndSale = Array.from({ length: 5 }, (_, i) => listing({
    id: `prop_${i}`,
    commercialStatus: 'for-sale-and-rent',
    offerKinds: ['sell', 'leaseOut'],
    commercial: { askingPrice: 240_000, finalPrice: null, rentPrice: 1_000, nightlyRate: null },
  }));
  const snapshot = summarizeArea('municipality:0701', '2026-09-28', rentAndSale);
  const contracts = { segments: { apartment: { last12: cell(2000) } } } as unknown as AreaSummaryFile;

  it('με ζητούμενη ΚΑΙ με τιμή συμβολαίου: 12 × 10 ÷ 2400 = 5% · 12 × 10 ÷ 2000 = 6%', () => {
    expect(yieldViews(snapshot, contracts)).toEqual([{ segment: 'apartment', asking: 5, contract: 6, saleCount: 5, rentCount: 5 }]);
  });

  it('χωρίς συμβόλαια ⇒ μόνο η ζητούμενη· τμήμα μόνο πώλησης ⇒ καμία γραμμή', () => {
    expect(yieldViews(snapshot, null)[0].contract).toBeNull();
    const saleOnly = summarizeArea('municipality:0701', '2026-09-28', [listing({ id: 'prop_s' })]);
    expect(yieldViews(saleOnly, null)).toEqual([]);
  });
});
