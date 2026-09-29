/**
 * ADR-890 §14 — το SSoT του χάρτη τιμών: κελί με κατώφλι, σταθερές κλάσεις, υπόμνημα με τους ΙΔΙΟΥΣ αριθμούς,
 * τίμια αναγωγή στον Δήμο, αναγνώστες σχήματος που λένε «δεν ξέρω» αντί για «καμία περιοχή».
 */

import {
  PRICE_MAP_BREAKS,
  PRICE_MAP_FORMAT_VERSION,
  priceMapCellOf,
  priceMapClassOf,
  priceMapLegend,
  priceMapMedian,
  readAskingPriceMapResponse,
  readContractPriceMapFile,
  resolvePriceMapArea,
  type PriceMapAreas,
} from '../price-map';

const BREAKS = PRICE_MAP_BREAKS.sale.apartment ?? [];

describe('price-map — κελί και κατώφλι', () => {
  it('κάτω από 5 ⇒ μόνο πλήθος, ακόμη κι αν ο υπολογισμός έδωσε διάμεσο', () => {
    expect(priceMapCellOf({ n: 4 })).toEqual([4]);
    expect(priceMapCellOf({ n: 7, median: 1500, p25: 1200, p75: 1800 })).toEqual([7, 1500]);
    expect(priceMapCellOf({ n: 0 })).toBeNull();
    expect(priceMapCellOf(null)).toBeNull();
  });

  it('η διάμεσος διαβάζεται ΜΟΝΟ πάνω από το κατώφλι — ποτέ αριθμός από < 5', () => {
    expect(priceMapMedian([4, 999])).toBeNull();
    expect(priceMapMedian([5, 1200])).toBe(1200);
    expect(priceMapMedian([3])).toBeNull();
    expect(priceMapMedian(undefined)).toBeNull();
  });
});

describe('price-map — σταθερές κλάσεις', () => {
  it('κάθε (προσφορά × τμήμα) έχει 4 αύξοντα κατώφλια ⇒ 5 κλάσεις = 5 αποχρώσεις', () => {
    for (const bySegment of Object.values(PRICE_MAP_BREAKS)) {
      for (const breaks of Object.values(bySegment)) {
        expect(breaks).toHaveLength(4);
        expect([...(breaks ?? [])].sort((a, b) => a - b)).toEqual(breaks);
      }
    }
  });

  it('το κατώφλι ανήκει στην ΠΑΝΩ κλάση (ίδιο με το `step` του MapLibre)', () => {
    expect(priceMapClassOf(BREAKS, 699)).toBe(0);
    expect(priceMapClassOf(BREAKS, 700)).toBe(1);
    expect(priceMapClassOf(BREAKS, 1799)).toBe(3);
    expect(priceMapClassOf(BREAKS, 1800)).toBe(4);
  });

  it('το υπόμνημα γράφει ΤΟΥΣ ΙΔΙΟΥΣ αριθμούς με τα κατώφλια του χάρτη', () => {
    expect(priceMapLegend(BREAKS)).toEqual([
      { low: null, high: 700 },
      { low: 700, high: 1000 },
      { low: 1000, high: 1300 },
      { low: 1300, high: 1800 },
      { low: 1800, high: null },
    ]);
  });

  it('η γη δεν έχει χάρτη ενοικίου (η μίσθωση γης δεν είναι αγορά κατοικίας)', () => {
    expect(PRICE_MAP_BREAKS.rent.land).toBeUndefined();
  });
});

describe('price-map — αναγωγή στον Δήμο', () => {
  const AREAS: PriceMapAreas = {
    'municipality:0701': { apartment: [40, 1600] },
    'municipal_unit:070101': { apartment: [3] },
    'municipal_unit:070102': { apartment: [12, 2100] },
    'municipality:0999': { apartment: [2] },
  };

  it('δική της τιμή όταν η Δ.Ε. περνά το κατώφλι', () => {
    expect(resolvePriceMapArea(AREAS, 'apartment', BREAKS, 'municipal_unit:070102', 'municipality:0701')).toEqual({
      kind: 'own', n: 12, median: 2100, classIndex: 4,
    });
  });

  it('λίγα στη Δ.Ε. ⇒ η τιμή του Δήμου, ΜΑΖΙ με το δικό της πλήθος (για να το πει το κείμενο)', () => {
    expect(resolvePriceMapArea(AREAS, 'apartment', BREAKS, 'municipal_unit:070101', 'municipality:0701')).toEqual({
      kind: 'parent', n: 3, parentId: 'municipality:0701', parentN: 40, median: 1600, classIndex: 3,
    });
  });

  it('ούτε ο Δήμος περνά (ή δεν υπάρχει γονέας) ⇒ λίγα, χωρίς αριθμό', () => {
    expect(resolvePriceMapArea(AREAS, 'apartment', BREAKS, 'municipality:0999', null)).toEqual({ kind: 'few', n: 2 });
    expect(resolvePriceMapArea(AREAS, 'house', BREAKS, 'municipal_unit:070101', 'municipality:0701')).toEqual({ kind: 'few', n: 0 });
  });
});

describe('price-map — αναγνώστες σχήματος', () => {
  it('αρχείο συμβολαίων: σωστό ⇒ περνά· άλλη εκδοχή ή χαλασμένο κελί ⇒ null', () => {
    const ok = { v: PRICE_MAP_FORMAT_VERSION, asOf: '2026-09-01', areas: { 'municipality:0701': { apartment: [9, 1500] } } };
    expect(readContractPriceMapFile(ok)).toEqual(ok);
    expect(readContractPriceMapFile({ ...ok, v: 99 })).toBeNull();
    expect(readContractPriceMapFile({ ...ok, areas: { x: { apartment: ['πολλά'] } } })).toBeNull();
  });

  it('απάντηση endpoint: `none` είναι γεγονός· σώμα 503 ⇒ null («δεν ξέρω»), ποτέ «καμία περιοχή»', () => {
    expect(readAskingPriceMapResponse({ kind: 'none' })).toEqual({ kind: 'none' });
    expect(readAskingPriceMapResponse({ error: 'MARKET_DATA_UNAVAILABLE' })).toBeNull();
    const ready = { kind: 'ready', day: '2026-09-28', offers: { sale: {}, rent: {} } };
    expect(readAskingPriceMapResponse(ready)).toEqual(ready);
  });
});
