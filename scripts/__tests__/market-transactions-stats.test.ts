/**
 * @jest-environment node
 *
 * ADR-889 Φ1 — κανόνας συγκρίσιμης γραμμής, ποσοστημόρια, κατώφλι, και ντετερμινιστικό αρχείο περιοχής.
 */

import type { MamaRecord } from '../lib/market-transactions/mama-source';
import { comparableUnitPrice, quarterOf } from '../lib/market-transactions/market-statistics';
import { MARKET_STAT_MIN_SAMPLE, quantile, summarize } from '../../src/lib/market/market-statistics';
import { buildAreaFile, type ClassifiedRecord } from '../lib/market-transactions/market-transactions-file';

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

describe('buildAreaFile — ντετερμινιστικό', () => {
  const items: ClassifiedRecord[] = [0, 1, 2, 3, 4, 5].map((i) => {
    const r = record({ price: 100000 + i * 10000, district: i % 2 === 0 ? 'Β' : 'Α', contractDate: i % 2 === 0 ? '2025-01-15' : '2025-04-15' });
    return { record: r, segment: 'apartment', unitPrice: comparableUnitPrice(r, 'apartment') };
  });
  items.push({ record: record({ buildingShare: 50 }), segment: 'apartment', unitPrice: null });
  const area = { id: 'municipal_unit:070101', name: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ', level: 6 };

  it('ίδια δεδομένα σε ΑΛΛΗ σειρά ⇒ byte-ταυτόσημο JSON', () => {
    const forward = JSON.stringify(buildAreaFile(area, items));
    const backward = JSON.stringify(buildAreaFile(area, [...items].reverse()));
    expect(backward).toBe(forward);
  });

  it('τα στατιστικά μετρούν ΜΟΝΟ τις συγκρίσιμες· η γραμμή κρατιέται με unitPrice null', () => {
    const file = buildAreaFile(area, items);
    expect(file.rows).toHaveLength(7);
    expect(file.rows.filter((row) => row[row.length - 1] === null)).toHaveLength(1);
    // Q1: 3 συγκρίσιμες · Q2: 3 συγκρίσιμες + 1 μη συγκρίσιμη που ΔΕΝ μετρά ⇒ και τα δύο κάτω από το κατώφλι.
    expect(file.stats.apartment).toEqual({ '2025-Q1': { n: 3 }, '2025-Q2': { n: 3 } });
    expect(file.districts).toEqual(['Α', 'Β', 'ΘΕΣΣΑΛΟΝΙΚΗΣ - 1 ΔΙΑΜ. ΘΕΣ/ΚΗΣ']);
  });
});
