/**
 * ADR-898 Φ5 — τα υποψήφια ΖΕΥΓΗ (τιμή ζώνης, ΣΕ της πηγής): η ζώνη φέρνει τον δικό της ΣΕ, κάθε μέτωπο τον δικό του,
 * και η δήλωση του αγγελιοδότη στενεύει τα ζεύγη χωρίς να τα χωρίζει από τον ΣΕ τους.
 */

import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

import { declaredZoneCandidates, formatCommercialityFactor, zoneCandidateOf, zoneCandidates } from '../objective-value-zone';

const PDF = 'https://www1.gsis.gr/gspp/dhpe/file_utils/fdownload?type=APAA&fname=COMMERCIAL_COEFF/COMMERCIAL_COEFF_4947.pdf';

const VERDICT: ValueZoneVerdict = {
  kind: 'ready',
  zone: { id: 1, name: 'Θ', price: 2000, validFrom: '2022-01-01', commerciality: { kind: 'factor', value: 1 } },
  nearEdge: false,
  fronts: [
    { id: 2, name: 'Μ1', price: 2600, validFrom: '2022-01-01', commerciality: { kind: 'document', url: PDF }, street: 'Ακαδημίας', distanceM: 10 },
    // Δύο τμήματα του ίδιου δρόμου, ίδια τιμή, ίδιος ΣΕ ⇒ ένα ζεύγος.
    { id: 3, name: 'Μ2', price: 3000, validFrom: '2022-01-01', commerciality: { kind: 'factor', value: 1.4 }, street: 'Σίνα', distanceM: 20 },
    { id: 4, name: 'Μ2', price: 3000, validFrom: '2022-01-01', commerciality: { kind: 'factor', value: 1.4 }, street: 'Σίνα', distanceM: 25 },
  ],
};

describe('objective-value-zone — ζεύγη (ADR-898 Φ5)', () => {
  it('όλα τα ζεύγη: πρώτη η ζώνη, κάθε μέτωπο με τον δικό του ΣΕ, χωρίς διπλά', () => {
    expect(zoneCandidates(VERDICT)).toEqual([
      { price: 2000, commerciality: { kind: 'factor', value: 1 } },
      { price: 2600, commerciality: { kind: 'document', url: PDF } },
      { price: 3000, commerciality: { kind: 'factor', value: 1.4 } },
    ]);
    expect(zoneCandidates({ kind: 'outside' })).toEqual([]);
  });

  it('η δήλωση στενεύει: «κανένα μέτωπο» ⇒ η ζώνη · δρόμος ⇒ τα δικά του ζεύγη · άγνωστος δρόμος ⇒ όλα', () => {
    expect(declaredZoneCandidates(VERDICT, { kind: 'none' })).toEqual([{ price: 2000, commerciality: { kind: 'factor', value: 1 } }]);
    expect(declaredZoneCandidates(VERDICT, { kind: 'street', street: 'Ακαδημίας' })).toEqual([
      { price: 2600, commerciality: { kind: 'document', url: PDF } },
    ]);
    expect(declaredZoneCandidates(VERDICT, { kind: 'street', street: 'Αλλού' })).toHaveLength(3);
    expect(declaredZoneCandidates(VERDICT, null)).toHaveLength(3);
  });

  it('ίδια τιμή, ΑΛΛΟΣ ΣΕ ⇒ δύο ζεύγη (θα έδιναν άλλο ποσό)', () => {
    if (VERDICT.kind !== 'ready') throw new Error('fixture');
    const [first] = VERDICT.fronts;
    const split: ValueZoneVerdict = { ...VERDICT, fronts: [first, { ...first, id: 9, commerciality: { kind: 'factor', value: 1.2 } }] };
    expect(declaredZoneCandidates(split, { kind: 'street', street: 'Ακαδημίας' })).toHaveLength(2);
  });

  it('το ζεύγος του δηλωμένου μετώπου, ή της ζώνης', () => {
    expect(zoneCandidateOf(VERDICT, '3|Σίνα')).toEqual({ price: 3000, commerciality: { kind: 'factor', value: 1.4 } });
    expect(zoneCandidateOf(VERDICT, null)?.price).toBe(2000);
    expect(zoneCandidateOf({ kind: 'unavailable' }, null)).toBeNull();
  });

  it('ο ΣΕ γράφεται όπως στην πηγή, με ένα δεκαδικό τουλάχιστον', () => {
    expect(formatCommercialityFactor(1)).toMatch(/^1[,.]0$/);
    expect(formatCommercialityFactor(1.4)).toMatch(/^1[,.]4$/);
  });
});
