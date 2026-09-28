/**
 * @jest-environment node
 *
 * ADR-889 Φ1–Φ2 — κανόνας συγκρίσιμης γραμμής, ποσοστημόρια, κατώφλι, ντετερμινιστικά αρχεία περιοχής
 * (γραμμές + στατιστικά: 12μηνο από την πηγή, έτος κατασκευής, πηγή Γ).
 */

import type { MamaRecord } from '../lib/market-transactions/mama-source';
import { comparableUnitPrice } from '../lib/market-transactions/market-statistics';
import { MARKET_STAT_MIN_SAMPLE, quantile, quarterOf, summarize } from '../../src/lib/market/market-statistics';
import type { MarketSegment } from '../../src/lib/market/market-segments';
import { buildAreaRowsFile, type ClassifiedRecord } from '../lib/market-transactions/market-transactions-file';
import { buildAreaSummaryFile, twelveMonthsBefore } from '../lib/market-transactions/area-summary';

function record(overrides: Partial<MamaRecord> = {}): MamaRecord {
  return {
    prefecture: 'ΘΕΣΣΑΛΟΝΙΚΗΣ',
    municipality: 'ΘΕΣΣΑΛΟΝΙΚΗΣ',
    district: 'ΘΕΣΣΑΛΟΝΙΚΗΣ - 1 ΔΙΑΜ. ΘΕΣ/ΚΗΣ',
    apaa: 'Εντός ΑΠΑΑ',
    category: 'Κατοικία ή διαμέρισμα πλήν μονοκατοικίας',
    frontages: 1,
    zonePrice: 1500,
    mainArea: 80,
    auxArea: null,
    yearBuilt: 1978,
    buildingRight: 'Πλήρης Κυριότητα',
    buildingShare: 100,
    special: null,
    floor: '2',
    plotArea: null,
    plotRight: null,
    plotShare: null,
    contractDate: '2025-05-10',
    price: 120000,
    ...overrides,
  };
}

describe('comparableUnitPrice — ο ΕΝΑΣ κανόνας', () => {
  it('ολόκληρο διαμέρισμα σε πλήρη κυριότητα ⇒ €/τ.μ. κύριων χώρων', () => {
    expect(comparableUnitPrice(record(), 'apartment')).toBe(1500);
  });

  it('ποσοστό < 100%, ψιλή κυριότητα, επικαρπία ⇒ ΟΧΙ συγκρίσιμη', () => {
    expect(comparableUnitPrice(record({ buildingShare: 50 }), 'apartment')).toBeNull();
    expect(comparableUnitPrice(record({ buildingRight: 'Ψιλή Κυριότητα' }), 'apartment')).toBeNull();
    expect(comparableUnitPrice(record({ buildingRight: 'Eπικαρπία' }), 'apartment')).toBeNull();
  });

  it('οποιαδήποτε ειδική συνθήκη ⇒ ΟΧΙ συγκρίσιμη', () => {
    expect(comparableUnitPrice(record({ special: 'Ημιτελές κτίσμα' }), 'apartment')).toBeNull();
  });

  it('μηδενικό τίμημα ή επιφάνεια ⇒ ΟΧΙ συγκρίσιμη (ποτέ διαίρεση με μηδέν)', () => {
    expect(comparableUnitPrice(record({ price: 0 }), 'apartment')).toBeNull();
    expect(comparableUnitPrice(record({ mainArea: 0 }), 'apartment')).toBeNull();
    expect(comparableUnitPrice(record({ mainArea: null }), 'apartment')).toBeNull();
  });

  it('οικόπεδο: κρίνεται στο ΔΙΚΟ του σκέλος και μετριέται στην επιφάνεια οικοπέδου', () => {
    const plot = record({ category: 'Οικόπεδα', mainArea: null, buildingRight: null, buildingShare: null, plotArea: 250, plotRight: 'Πλήρης Κυριότητα', plotShare: 100, price: 100000 });
    expect(comparableUnitPrice(plot, 'land')).toBe(400);
    expect(comparableUnitPrice({ ...plot, plotShare: 5 }, 'land')).toBeNull();
  });

  it('θέση στάθμευσης ⇒ τιμή ανά θέση, όχι ανά τ.μ.', () => {
    expect(comparableUnitPrice(record({ category: 'Θέσεις Στάθμευσης', mainArea: 12, price: 9000 }), 'parking')).toBe(9000);
  });

  it('κατηγορία εκτός τμήματος ⇒ ποτέ στα στατιστικά', () => {
    expect(comparableUnitPrice(record(), null)).toBeNull();
  });
});

describe('ποσοστημόρια και κατώφλι', () => {
  it('γραμμική παρεμβολή = PERCENTILE.INC του Excel', () => {
    const sorted = [1, 2, 3, 4, 10];
    expect(quantile(sorted, 0.5)).toBe(3);
    expect(quantile(sorted, 0.25)).toBe(2);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.75)).toBe(3.25);
  });

  it(`< ${MARKET_STAT_MIN_SAMPLE} τιμές ⇒ μόνο πλήθος, κανένας αριθμός`, () => {
    expect(summarize([1000, 2000, 3000, 4000])).toEqual({ n: 4 });
    expect(summarize([1000, 2000, 3000, 4000, 5000])).toEqual({ n: 5, median: 3000, p25: 2000, p75: 4000 });
  });

  it('τρίμηνο από ημερομηνία', () => {
    expect(quarterOf('2025-01-31')).toBe('2025-Q1');
    expect(quarterOf('2025-04-01')).toBe('2025-Q2');
    expect(quarterOf('2025-12-31')).toBe('2025-Q4');
  });
});

function classified(r: MamaRecord, segment: MarketSegment = 'apartment'): ClassifiedRecord {
  return { record: r, segment, unitPrice: comparableUnitPrice(r, segment) };
}

describe('αρχεία περιοχής — ντετερμινιστικά', () => {
  const items: ClassifiedRecord[] = [0, 1, 2, 3, 4, 5].map((i) =>
    classified(record({ price: 100000 + i * 10000, district: i % 2 === 0 ? 'Β' : 'Α', contractDate: i % 2 === 0 ? '2025-01-15' : '2025-04-15' })),
  );
  items.push({ record: record({ buildingShare: 50 }), segment: 'apartment', unitPrice: null });
  const areaId = 'municipal_unit:070101';
  const asOf = '2025-08-31';

  it('ίδια δεδομένα σε ΑΛΛΗ σειρά ⇒ byte-ταυτόσημο JSON (γραμμές ΚΑΙ στατιστικά)', () => {
    const reversed = [...items].reverse();
    expect(JSON.stringify(buildAreaRowsFile(areaId, reversed))).toBe(JSON.stringify(buildAreaRowsFile(areaId, items)));
    expect(JSON.stringify(buildAreaSummaryFile(areaId, reversed, asOf))).toBe(JSON.stringify(buildAreaSummaryFile(areaId, items, asOf)));
  });

  it('η γραμμή κρατιέται με unitPrice null· τα στατιστικά μετρούν ΜΟΝΟ τις συγκρίσιμες', () => {
    const rows = buildAreaRowsFile(areaId, items);
    expect(rows.rows).toHaveLength(7);
    expect(rows.rows.filter((row) => row[row.length - 1] === null)).toHaveLength(1);
    expect(rows.districts).toEqual(['Α', 'Β', 'ΘΕΣΣΑΛΟΝΙΚΗΣ - 1 ΔΙΑΜ. ΘΕΣ/ΚΗΣ']);
    // Q1: 3 συγκρίσιμες · Q2: 3 συγκρίσιμες + 1 μη συγκρίσιμη που ΔΕΝ μετρά ⇒ και τα δύο κάτω από το κατώφλι.
    const summary = buildAreaSummaryFile(areaId, items, asOf);
    expect(summary.segments.apartment?.quarters).toEqual({ '2025-Q1': { n: 3 }, '2025-Q2': { n: 3 } });
    expect(summary.segments.apartment?.last12.n).toBe(6);
  });
});

describe('στατιστικά — 12μηνο, έτος κατασκευής, πηγή Γ', () => {
  it('το 12μηνο κόβεται στην ημερομηνία ΤΗΣ ΠΗΓΗΣ, αποκλειστικά', () => {
    expect(twelveMonthsBefore('2026-08-30')).toBe('2025-08-30');
    const old = classified(record({ contractDate: '2025-08-30' }));
    const recent = Array.from({ length: 5 }, () => classified(record({ contractDate: '2025-08-31' })));
    const summary = buildAreaSummaryFile('municipality:4501', [old, ...recent], '2026-08-30');
    expect(summary.segments.apartment?.last12).toEqual({ n: 5, median: 1500, p25: 1500, p75: 1500 });
    expect(summary.asOf).toBe('2026-08-30');
  });

  it('κάδοι έτους κατασκευής, και λόγος τιμήματος προς αντικειμενική σε %', () => {
    const items = [1975, 1978, 1980, 1982, 1984, 2021].map((yearBuilt) => classified(record({ yearBuilt, contractDate: '2026-01-10' })));
    const apartment = buildAreaSummaryFile('x:1', items, '2026-08-30').segments.apartment;
    expect(apartment?.yearBuilt['1960-1984']).toEqual({ n: 5, median: 1500, p25: 1500, p75: 1500 });
    expect(apartment?.yearBuilt.gte2020).toEqual({ n: 1 });
    // 120.000 € / (80 τ.μ. × 1.500 €/τ.μ.) = 100%.
    expect(apartment?.priceToZonePct).toEqual({ n: 6, median: 100, p25: 100, p75: 100 });
    expect(apartment?.zone).toEqual({ n: 6, median: 1500, p25: 1500, p75: 1500 });
  });

  it('οικόπεδο: ΚΑΜΙΑ πηγή Γ ούτε κάδος έτους — η τιμή ζώνης είναι €/τ.μ. κτίσματος', () => {
    const land = record({ category: 'Οικόπεδα', plotArea: 400, plotRight: 'Πλήρης Κυριότητα', plotShare: 100, contractDate: '2026-02-01' });
    const summary = buildAreaSummaryFile('x:1', Array.from({ length: 5 }, () => classified(land, 'land')), '2026-08-30');
    expect(summary.segments.land).toMatchObject({ zone: null, priceToZonePct: null, yearBuilt: {} });
    expect(summary.segments.land?.last12.n).toBe(5);
  });
});
