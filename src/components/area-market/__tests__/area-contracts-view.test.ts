/**
 * ADR-890 Φ2 — η όψη των τιμών συμβολαίων: απόσταση ζητούμενης ↔ συμβολαίου μόνο με ΔΥΟ δημοσιευμένα κελιά,
 * 8 τρίμηνα με ρητά κενά, αναγωγή στον Δήμο μόνο κάτω από το κατώφλι.
 */

import { quartersEndingAt } from '@/lib/market/market-statistics';
import type { AreaSummaryFile, SegmentSummary } from '@/lib/market/market-transactions-file';
import type { AreaMarketSnapshot } from '@/types/area-market';

import { askGapPct, contractSegmentViews, contractTrend, CONTRACT_TREND_QUARTERS } from '../area-contracts-view';

const REPORTED = { n: 40, median: 2000, p25: 1600, p75: 2500 };

function segment(overrides: Partial<SegmentSummary> = {}): SegmentSummary {
  return { quarters: {}, last12: REPORTED, yearBuilt: {}, zone: null, priceToZonePct: null, ...overrides };
}

function file(id: string, apartment: SegmentSummary): AreaSummaryFile {
  return { v: 2, id, asOf: '2026-09-01', segments: { apartment } };
}

function asking(median: number | null): AreaMarketSnapshot {
  const unitPrice = median === null ? { n: 3 } : { n: 12, median, p25: median, p75: median };
  return { offers: { sale: { segments: { apartment: { unitPrice } } } } } as unknown as AreaMarketSnapshot;
}

describe('area-contracts-view', () => {
  it('απόσταση ζητούμενης ↔ συμβολαίου σε %, μόνο όταν ΚΑΙ τα δύο δημοσιεύονται', () => {
    expect(askGapPct(asking(2400), 'apartment', REPORTED)).toBe(20);
    expect(askGapPct(asking(1800), 'apartment', REPORTED)).toBe(-10);
    expect(askGapPct(asking(null), 'apartment', REPORTED)).toBeNull();
    expect(askGapPct(asking(2400), 'apartment', { n: 3 })).toBeNull();
    expect(askGapPct(null, 'apartment', REPORTED)).toBeNull();
  });

  it(`${CONTRACT_TREND_QUARTERS} τρίμηνα ως το τρίμηνο της πηγής· το τρίμηνο χωρίς δεδομένα = { n: 0 }, όχι απόν`, () => {
    expect(quartersEndingAt('2026-Q1', 3)).toEqual(['2025-Q3', '2025-Q4', '2026-Q1']);
    const trend = contractTrend(segment({ quarters: { '2026-Q3': REPORTED } }), '2026-09-01');
    expect(trend).toHaveLength(CONTRACT_TREND_QUARTERS);
    expect(trend[0]).toMatchObject({ quarter: '2024-Q4', year: 2024, q: 4, cell: { n: 0 } });
    expect(trend.at(-1)).toMatchObject({ quarter: '2026-Q3', cell: REPORTED });
  });

  it('ADR-890 §12 — απόσταση ζητούμενης ↔ συμβολαίου ΑΝΑ ΚΑΔΟ έτους· παλιό στιγμιότυπο (χωρίς άξονα) ⇒ null, ποτέ 0%', () => {
    const contracts = file('municipality:0701', segment({ yearBuilt: { '1960-1984': REPORTED, '2000-2009': REPORTED } }));
    const withAxis = {
      offers: { sale: { segments: { apartment: {
        unitPrice: REPORTED,
        breakdowns: { yearBuilt: { buckets: { '1960-1984': { n: 6, median: 2300, p25: 2000, p75: 2600 }, '2000-2009': { n: 2 } }, undeclared: 0 } },
      } } } },
    } as unknown as AreaMarketSnapshot;
    const [view] = contractSegmentViews(contracts, null, withAxis);
    expect(view.yearBuilt).toEqual([
      { key: '1960-1984', cell: REPORTED, askGapPct: 15 },
      { key: '2000-2009', cell: REPORTED, askGapPct: null },
    ]);
    const legacy = { offers: { sale: { segments: { apartment: { unitPrice: REPORTED, breakdowns: {} } } } } } as unknown as AreaMarketSnapshot;
    expect(contractSegmentViews(contracts, null, legacy)[0].yearBuilt.map((row) => row.askGapPct)).toEqual([null, null]);
  });

  it('αναγωγή στον Δήμο ΜΟΝΟ όταν ο δικός μας αριθμός είναι κάτω από το κατώφλι', () => {
    const parent = file('municipality:0701', segment());
    const [own] = contractSegmentViews(file('municipal_unit:070101', segment()), parent, null);
    expect(own.parentLast12).toBeNull();
    const [thin] = contractSegmentViews(file('municipal_unit:070101', segment({ last12: { n: 2 } })), parent, null);
    expect(thin.parentLast12).toEqual(REPORTED);
  });
});
