/**
 * Το ιστορικό τιμής (ADR-923 §5.11 «3δ» Τμήμα 3): ένα σημείο ανά δημοσιευμένη έκδοση, μεταβολή ανά μονάδα.
 */

import { buildPriceHistory, type PriceHistoryLine } from '../price-history';
import type { PriceVersionRef } from '../version-timeline';

const version = (number: number, status: PriceVersionRef['status'], validFrom: string | null): PriceVersionRef => ({
  id: `v${number}`,
  number,
  status,
  validFrom,
});

const line = (netPrice: number, priceQuantity = 1): PriceHistoryLine => ({
  netPrice,
  priceQuantity,
  unitCode: 'pcs',
  discountGroupId: null,
});

const VERSIONS = [
  version(1, 'superseded', '2026-01-01T00:00:00.000Z'),
  version(2, 'superseded', '2026-02-01T00:00:00.000Z'),
  version(3, 'published', '2026-03-01T00:00:00.000Z'),
];

describe('buildPriceHistory', () => {
  it('ένα σημείο ανά δημοσιευμένη έκδοση, το «έως» παράγεται από την επόμενη', () => {
    const points = buildPriceHistory(VERSIONS, () => line(100));
    expect(points.map((point) => point.versionNumber)).toEqual([1, 2, 3]);
    expect(points[0].validUntilMs).toBe(points[1].validFromMs);
    expect(points[2].validUntilMs).toBeNull();
  });

  it('πρόχειρη ή απορριφθείσα έκδοση δεν είναι ιστορικό', () => {
    const points = buildPriceHistory([...VERSIONS, version(4, 'draft', '2026-04-01T00:00:00.000Z'), version(5, 'discarded', null)], () => line(100));
    expect(points).toHaveLength(3);
  });

  it('μεταβολή ανά μονάδα: το πρώτο σημείο δεν έχει· 100 → 125 = +25%', () => {
    const prices: Record<string, number> = { v1: 100, v2: 125, v3: 100 };
    const points = buildPriceHistory(VERSIONS, (id) => line(prices[id]));
    expect(points.map((point) => point.unitChangeBp)).toEqual([null, 2500, -2000]);
  });

  it('⛔ αλλαγή ποσότητας τιμής ΔΕΝ είναι αλλαγή τιμής (100/1 → 1.000/10)', () => {
    const points = buildPriceHistory(VERSIONS.slice(0, 2), (id) => (id === 'v1' ? line(100) : line(1000, 10)));
    expect(points[1].unitChangeBp).toBe(0);
  });

  it('έκδοση χωρίς το SKU = σημείο `line: null`, και η επανεμφάνιση συγκρίνεται με την τελευταία τιμή', () => {
    const points = buildPriceHistory(VERSIONS, (id) => (id === 'v2' ? null : id === 'v1' ? line(100) : line(150)));
    expect(points[1]).toMatchObject({ line: null, unitChangeBp: null });
    expect(points[2].unitChangeBp).toBe(5000);
  });

  it('το σημείο δεν κουβαλά ξένα πεδία της αποθηκευμένης γραμμής', () => {
    const stored = { ...line(100), breakdown: null, derived: { secret: true } };
    expect(buildPriceHistory(VERSIONS.slice(0, 1), () => stored)[0].line).toEqual(line(100));
  });
});
