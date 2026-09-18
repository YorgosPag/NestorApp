/**
 * Άγκυρες — ADR-777 §8.60.14.14 (Φάση 4): **η ΓΕΝΙΚΗ μηχανή «πρώτα η μονάδα, μετά ο αριθμός»**,
 * η ίδια για τη δημόσια λίστα (Φάση 1) και για κάθε εσωτερικό πίνακα.
 *
 * ⚠️ Τα ποσά διαλέχτηκαν ώστε **ένας** άξονας να δίνει **άλλη** σειρά από τα τμήματα:
 * ενοίκιο 60 < πώληση 18.000 ⇒ με έναν άξονα το ενοίκιο θα ερχόταν πρώτο. Η ισοδυναμία θα
 * έκρυβε τη μετάλλαξη.
 */

import type { PricedPropertyLike } from '@/lib/properties/price-resolver';

// Μετρητής κλήσεων του επιλυτή — `jest.spyOn` σε ESM export σκάει («Cannot redefine property»),
// άρα `jest.mock` + `requireActual` τυλιγμένο (μάθημα Φάσης 3).
const resolveCalls = { count: 0 };
jest.mock('@/lib/properties/price-resolver', () => {
  const actual = jest.requireActual('@/lib/properties/price-resolver');
  return {
    ...actual,
    resolveDisplayPrice: (input: PricedPropertyLike) => {
      resolveCalls.count += 1;
      return actual.resolveDisplayPrice(input);
    },
  };
});

import {
  countPriceClassSections,
  flattenPriceClassSections,
  partitionByPriceClass,
  sortIntoPriceClassSections,
  unsectioned,
} from '../price-class-sections';

interface Space extends PricedPropertyLike {
  readonly id: string;
  readonly name: string;
  readonly area?: number;
}

const sale = (id: string, askingPrice: number, area = 10): Space =>
  ({ id, name: id, area, commercialStatus: 'for-sale', commercial: { askingPrice } });
const rent = (id: string, rentPrice: number, area = 10): Space =>
  ({ id, name: id, area, commercialStatus: 'for-rent', commercial: { rentPrice } });
const nightly = (id: string, nightlyRate: number): Space =>
  ({ id, name: id, commercialStatus: 'unavailable', offerKinds: ['leaseShort'], commercial: { nightlyRate } });
const unpriced = (id: string): Space => ({ id, name: id, commercialStatus: 'for-sale' });

const byName = (a: Space, b: Space) => a.name.localeCompare(b.name, 'el') || (a.id < b.id ? -1 : 1);
const ids = (items: readonly Space[]) => items.map((s) => s.id);

const MIXED: readonly Space[] = [
  sale('P-sale-18k', 18_000),
  rent('P-rent-60', 60),
  unpriced('P-none'),
  sale('P-sale-12k', 12_000),
  nightly('P-night-40', 40),
  rent('P-rent-90', 90),
];

describe('Α. ΤΑ ΤΜΗΜΑΤΑ ΕΙΝΑΙ ΟΙ ΚΛΑΣΕΙΣ ΣΥΓΚΡΙΣΙΜΟΤΗΤΑΣ', () => {
  it('🔴 Α1 — το περιστατικό: 60 €/μήνα ΔΕΝ είναι «φθηνότερο» από 12.000 € πώλησης', () => {
    const sections = partitionByPriceClass(MIXED, { direction: 'asc', tieBreak: byName });
    expect(sections.map((s) => s.heading)).toEqual(['sale', 'rent', 'nightly', 'unpriced']);
    expect(ids(sections[0].items)).toEqual(['P-sale-12k', 'P-sale-18k']);
    expect(ids(sections[1].items)).toEqual(['P-rent-60', 'P-rent-90']);
    // Με έναν άξονα η πρώτη γραμμή θα ήταν το ενοίκιο των 60 — «η φθηνότερη θέση».
    expect(ids(flattenPriceClassSections(sections))[0]).not.toBe('P-rent-60');
  });

  it('Α2 — φθίνουσα: αντιστρέφεται ο ΑΡΙΘΜΟΣ μέσα στα τμήματα, ΠΟΤΕ η σειρά των τμημάτων', () => {
    const sections = partitionByPriceClass(MIXED, { direction: 'desc', tieBreak: byName });
    expect(sections.map((s) => s.heading)).toEqual(['sale', 'rent', 'nightly', 'unpriced']);
    expect(ids(sections[0].items)).toEqual(['P-sale-18k', 'P-sale-12k']);
    expect(ids(sections[1].items)).toEqual(['P-rent-90', 'P-rent-60']);
  });

  it('Α3 — η απουσία τιμής είναι ΚΛΑΣΗ, τελευταία, και στις δύο κατευθύνσεις', () => {
    for (const direction of ['asc', 'desc'] as const) {
      const sections = partitionByPriceClass(MIXED, { direction, tieBreak: byName });
      expect(sections[sections.length - 1]).toEqual({ heading: 'unpriced', items: [MIXED[2]] });
    }
  });

  it('Α4 — ΜΙΑ κλάση ⇒ ΚΑΜΙΑ επιγραφή (ο πίνακας μένει ο σημερινός)', () => {
    const sections = partitionByPriceClass([rent('b', 90), rent('a', 60)], { direction: 'asc', tieBreak: byName });
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBeNull();
    expect(ids(sections[0].items)).toEqual(['a', 'b']);
  });

  it('Α5 — η λογιστική κλείνει: κάθε στοιχείο ΜΙΑ φορά, σε κάθε σειρά', () => {
    for (const direction of ['asc', 'desc'] as const) {
      const sections = partitionByPriceClass(MIXED, { direction, tieBreak: byName });
      expect(countPriceClassSections(sections)).toBe(MIXED.length);
      expect(new Set(ids(flattenPriceClassSections(sections))).size).toBe(MIXED.length);
    }
  });

  it('Α6 — ισοπαλίες ⇒ ΟΛΙΚΗ σειρά (ίδια δεδομένα, ίδια σειρά, όποια κι αν είναι η είσοδος)', () => {
    const a = sale('A', 100);
    const b = sale('B', 100);
    const forward = partitionByPriceClass([a, b], { direction: 'asc', tieBreak: byName });
    const backward = partitionByPriceClass([b, a], { direction: 'asc', tieBreak: byName });
    expect(ids(forward[0].items)).toEqual(['A', 'B']);
    expect(ids(backward[0].items)).toEqual(['A', 'B']);
  });

  it('⚡ Α7 — ο επιλυτής ρωτιέται ΜΙΑ φορά ανά στοιχείο (ποτέ μέσα στον συγκριτή)', () => {
    resolveCalls.count = 0;
    partitionByPriceClass(MIXED, { direction: 'asc', tieBreak: byName });
    expect(resolveCalls.count).toBe(MIXED.length);
  });

  it('Α8 — η είσοδος δεν μεταλλάσσεται (μπορεί να ανήκει σε συνδρομή)', () => {
    const input = [...MIXED];
    partitionByPriceClass(input, { direction: 'asc', tieBreak: byName });
    expect(input).toEqual(MIXED);
  });
});

describe('Β. Ο ΕΝΑΣ ΔΡΟΜΟΣ ΤΩΝ ΕΣΩΤΕΡΙΚΩΝ ΛΙΣΤΩΝ', () => {
  it('Β1 — «κατά αξία» ⇒ τμήματα· κάθε άλλη σειρά ⇒ ΕΝΑ τμήμα χωρίς επιγραφή', () => {
    const byPrice = sortIntoPriceClassSections(MIXED, {
      byPrice: true, direction: 'asc', tieBreak: byName, valueOf: () => null,
    });
    expect(byPrice.length).toBeGreaterThan(1);

    const byArea = sortIntoPriceClassSections([sale('x', 1, 30), rent('y', 1, 10)], {
      byPrice: false, direction: 'asc', tieBreak: byName, valueOf: (s) => s.area ?? null,
    });
    expect(byArea).toHaveLength(1);
    expect(byArea[0].heading).toBeNull();
    expect(ids(byArea[0].items)).toEqual(['y', 'x']);
  });

  it('Β2 — κενή είσοδος ⇒ κανένα τμήμα (όχι ένα άδειο)', () => {
    expect(unsectioned([])).toEqual([]);
    expect(partitionByPriceClass([], { direction: 'asc', tieBreak: byName })).toEqual([]);
  });
});
