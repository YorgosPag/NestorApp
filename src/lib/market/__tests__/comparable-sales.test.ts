/**
 * ADR-889 Φ2 — συγκρίσιμες πωλήσεις: κατάταξη με εξηγήσιμες διαφορές, κατώφλι, παράθυρο, ντετερμινισμός,
 * εκατοστημόριο ζητούμενης τιμής, και ακρίβεια ΜΗΝΑ (ποτέ ημέρας).
 */

import { COMPARABLE_SALES_LIMIT, findComparableSales, percentileRank, type ComparableSource } from '../comparable-sales';
import { MARKET_STAT_MIN_SAMPLE } from '../market-statistics';
import { ROW_FIELDS, type EncodedRow, type RowField } from '../market-transactions-file';

/** Κατηγορία 0 = διαμέρισμα, 1 = οικόπεδο, 2 = εκτός στατιστικών. */
const CATEGORY_SEGMENTS = ['apartment', 'land', null] as const;

function row(fields: Partial<Record<RowField, string | number | null>>): EncodedRow {
  const base: Record<RowField, string | number | null> = {
    date: '2026-06-15', category: 0, price: 120000, mainArea: 80, auxArea: null, yearBuilt: 1990, floor: '2',
    zonePrice: 1500, frontages: 1, plotArea: null, buildingRight: 0, buildingShare: 100, plotRight: null,
    plotShare: null, special: null, district: 0, insideApaa: 1, unitPrice: 1500,
  };
  const merged = { ...base, ...fields };
  return ROW_FIELDS.map((field) => merged[field]);
}

function source(rows: readonly EncodedRow[]): ComparableSource {
  return { rows, districts: ['ΘΕΣΣΑΛΟΝΙΚΗΣ - 1 ΔΙΑΜ.'], categorySegments: CATEGORY_SEGMENTS, asOf: '2026-09-01' };
}

const TARGET = { segment: 'apartment', size: 80, yearBuilt: 1990, floor: 2 } as const;

describe('findComparableSales', () => {
  it(`δεξαμενή κάτω από ${MARKET_STAT_MIN_SAMPLE} ⇒ καμία γραμμή, μόνο το πλήθος`, () => {
    const result = findComparableSales(source([row({}), row({}), row({})]), TARGET, null);
    expect(result).toEqual({ kind: 'suppressed', pool: 3 });
  });

  it('μετρά ΜΟΝΟ συγκρίσιμες του ίδιου τμήματος (unitPrice null, άλλη κατηγορία ⇒ εκτός)', () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row({})),
      row({ unitPrice: null }),
      row({ category: 1 }),
      row({ category: 2 }),
    ];
    const result = findComparableSales(source(rows), TARGET, null);
    expect(result.kind === 'ready' && result.pool).toBe(5);
  });

  it('η πιο όμοια πρώτη: ίδιο εμβαδόν/έτος/όροφος νικά ένα πολύ μεγαλύτερο και παλιότερο', () => {
    const rows = [
      row({ mainArea: 200, yearBuilt: 1960, floor: 'Υ', unitPrice: 900 }),
      row({ mainArea: 82, yearBuilt: 1991, floor: '2', unitPrice: 1600 }),
      ...Array.from({ length: 4 }, () => row({ mainArea: 120, unitPrice: 1400 })),
    ];
    const result = findComparableSales(source(rows), TARGET, null);
    if (result.kind !== 'ready') throw new Error(result.kind);
    expect(result.sales[0]).toMatchObject({ size: 82, yearBuilt: 1991, floor: 2, unitPrice: 1600 });
    expect(result.sales.at(-1)).toMatchObject({ size: 200, floor: -1 });
  });

  it('ημερομηνία ⇒ ΜΗΝΑΣ· και «πριν από Χ μήνες» από την ημερομηνία της πηγής, όχι του ρολογιού', () => {
    const result = findComparableSales(source(Array.from({ length: 5 }, () => row({ date: '2026-03-27' }))), TARGET, null);
    if (result.kind !== 'ready') throw new Error(result.kind);
    expect(result.sales[0].month).toBe('2026-03');
    expect(result.sales[0].monthsAgo).toBe(6);
    expect(JSON.stringify(result)).not.toContain('2026-03-27');
  });

  it(`έως ${COMPARABLE_SALES_LIMIT}· το 24μηνο αρκεί όταν γεμίζει, αλλιώς όλο το αρχείο`, () => {
    const recent = Array.from({ length: 10 }, () => row({}));
    const old = Array.from({ length: 3 }, () => row({ date: '2022-01-10' }));
    const full = findComparableSales(source([...recent, ...old]), TARGET, null);
    expect(full.kind === 'ready' && [full.sales.length, full.pool, full.windowMonths]).toEqual([COMPARABLE_SALES_LIMIT, 10, 24]);

    const sparse = findComparableSales(source([...recent.slice(0, 4), ...old]), TARGET, null);
    expect(sparse.kind === 'ready' && [sparse.pool, sparse.windowMonths]).toEqual([7, null]);
  });

  it('ίδια είσοδος σε ΑΛΛΗ σειρά ⇒ ίδιος κατάλογος (σταθερές ισοπαλίες)', () => {
    const rows = [1400, 1500, 1600, 1700, 1800, 1900].map((unitPrice) => row({ unitPrice }));
    const forward = findComparableSales(source(rows), TARGET, 1650);
    const backward = findComparableSales(source([...rows].reverse()), TARGET, 1650);
    expect(backward).toEqual(forward);
  });

  it('εκατοστημόριο της ζητούμενης τιμής στη δεξαμενή', () => {
    const rows = [1000, 1200, 1400, 1600, 1800].map((unitPrice) => row({ unitPrice }));
    const result = findComparableSales(source(rows), TARGET, 1500);
    expect(result.kind === 'ready' && result.askingPercentile).toBe(60);
    expect(percentileRank(5000, [1, 2])).toBe(100);
    expect(percentileRank(0, [1, 2])).toBe(0);
  });

  it('στόχος χωρίς δηλωμένα στοιχεία ⇒ μετρά μόνο ο χρόνος (νεότερο πρώτο)', () => {
    const rows = ['2026-01-10', '2026-08-10', '2025-05-10', '2026-04-10', '2025-12-10'].map((date) => row({ date }));
    const result = findComparableSales(source(rows), { segment: 'apartment', size: null, yearBuilt: null, floor: null }, null);
    expect(result.kind === 'ready' && result.sales.map((sale) => sale.month)).toEqual(['2026-08', '2026-04', '2026-01', '2025-12', '2025-05']);
  });
});
