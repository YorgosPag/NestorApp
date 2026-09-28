/**
 * ADR-890 §13 — η μηνιαία σειρά ζητούμενων: ο μήνας είναι **ένωση** των νυχτών του, η τελευταία τιμή μιας αγγελίας
 * κερδίζει, ο νέος μήνας ξεκινά καθαρό βιβλίο και ο παλιός παγώνει, η επανεκτέλεση είναι ιδεμποτική.
 * Και οι κανόνες των δύο διαμέσων (`medianGapPct` · `grossYieldPct`) και της αριθμητικής μηνών.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import {
  AREA_MARKET_SERIES_RETENTION_MONTHS,
  mergeAskingBook,
  nextAreaMarketSeries,
} from '@/lib/market/area-market-series';
import { grossYieldPct, medianGapPct, monthOfDay, monthsEndingAt, shiftMonth } from '@/lib/market/market-statistics';
import type { AreaMarketSeries } from '@/types/area-market';

const AREA = 'municipality:0701';

/** 100 τ.μ. ⇒ €/τ.μ. = τιμή ÷ 100. */
const apartment = (id: string, askingPrice: number) =>
  listing({ id, commercial: { askingPrice, finalPrice: null, rentPrice: null, nightlyRate: null } });

const five = (base: number) => Array.from({ length: 5 }, (_, i) => apartment(`prop_${i}`, base + i * 10_000));

describe('αριθμητική μηνών', () => {
  it('μήνας ημέρας · μετατόπιση πάνω από όριο έτους · παράθυρο από τον παλαιότερο', () => {
    expect(monthOfDay('2026-09-28')).toBe('2026-09');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 13)).toBe('2027-01');
    expect(monthsEndingAt('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('medianGapPct / grossYieldPct — λόγοι ΜΟΝΟ πάνω από το κατώφλι', () => {
  const cell = (median: number) => ({ n: 5, median, p25: median, p75: median });

  it('απόσταση και απόδοση όταν δημοσιεύονται και τα δύο', () => {
    expect(medianGapPct(cell(2400), cell(2000))).toBe(20);
    expect(grossYieldPct(cell(10), cell(2400))).toBe(5);
  });

  it('κάτω από το κατώφλι, απόν ή μηδενικός παρονομαστής ⇒ null, ποτέ 0', () => {
    expect(medianGapPct({ n: 4 }, cell(2000))).toBeNull();
    expect(medianGapPct(cell(2000), undefined)).toBeNull();
    expect(grossYieldPct(cell(10), { n: 3 })).toBeNull();
    expect(grossYieldPct(cell(10), cell(0))).toBeNull();
  });
});

describe('mergeAskingBook', () => {
  it('η τελευταία παρατήρηση μιας αγγελίας κερδίζει · αγγελία που έφυγε ΜΕΝΕΙ στον μήνα', () => {
    const first = mergeAskingBook(null, '2026-09-10', [apartment('prop_a', 200_000), apartment('prop_b', 300_000)]);
    const second = mergeAskingBook(first, '2026-09-11', [apartment('prop_a', 220_000)]);
    expect(second.offers.sale).toEqual({
      prop_a: { segment: 'apartment', unitPrice: 2200 },
      prop_b: { segment: 'apartment', unitPrice: 3000 },
    });
  });

  it('νέος μήνας ⇒ καθαρό βιβλίο', () => {
    const september = mergeAskingBook(null, '2026-09-30', [apartment('prop_a', 200_000)]);
    const october = mergeAskingBook(september, '2026-10-01', [apartment('prop_b', 300_000)]);
    expect(october.month).toBe('2026-10');
    expect(Object.keys(october.offers.sale)).toEqual(['prop_b']);
  });
});

describe('nextAreaMarketSeries', () => {
  it('ιδεμποτικό: η ίδια νύχτα δύο φορές ⇒ το ίδιο έγγραφο', () => {
    const once = nextAreaMarketSeries(null, AREA, '2026-09-28', five(200_000));
    expect(nextAreaMarketSeries(once, AREA, '2026-09-28', five(200_000))).toEqual(once);
  });

  it('ο μήνας που έκλεισε ΠΑΓΩΝΕΙ· ο νέος μετρά μόνο τις δικές του αγγελίες', () => {
    const september = nextAreaMarketSeries(null, AREA, '2026-09-30', five(200_000));
    const october = nextAreaMarketSeries(september, AREA, '2026-10-01', five(300_000).slice(0, 2));
    expect(october.points['2026-09']).toEqual(september.points['2026-09']);
    expect(october.points['2026-09'].offers.sale.apartment).toEqual(expect.objectContaining({ n: 5, median: 2200 }));
    expect(october.points['2026-10'].offers.sale.apartment).toEqual({ n: 2 });
    expect(october.points['2026-10'].asOf).toBe('2026-10-01');
  });

  it(`κρατά ${AREA_MARKET_SERIES_RETENTION_MONTHS} μήνες — οι παλαιότεροι κόβονται`, () => {
    const stale: AreaMarketSeries = {
      schemaVersion: 1,
      areaId: AREA,
      points: { '2020-01': { asOf: '2020-01-31', offers: { sale: {}, rent: {} } } },
      book: { month: '2020-01', offers: { sale: {}, rent: {} } },
    };
    expect(Object.keys(nextAreaMarketSeries(stale, AREA, '2026-09-28', five(200_000)).points)).toEqual(['2026-09']);
  });
});
