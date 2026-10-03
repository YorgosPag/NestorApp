/**
 * ⚓ ADR-903 §6 — το ΕΝΑ φίλτρο ορόφου: επιλογές από τα δεδομένα, κλειδί αριθμός:είδος, κατά στάθμη.
 * Ως τις 2026-10-03 οι επιλογές ήταν slugs (`basement-1`) απέναντι σε ελεύθερο κείμενο ⇒ ποτέ ταίριασμα.
 */

import { floorFilterKey, floorFilterOptions, matchesFloorFilter } from '../floor-filter';
import type { FloorRef } from '../floor-ref';

const label = (ref: FloorRef) => `${ref.kind ?? 'auto'}@${ref.number}`;

describe('floor-filter', () => {
  const items = [
    { floor: 2, floorKind: 'standard' },
    { floor: -1, floorKind: 'basement' },
    { floor: 0, floorKind: 'pilotis' },
    { floor: 0, floorKind: 'ground' },
    { floor: 2, floorKind: 'standard' },
    { floor: 'Υπόγειο -1' },
    {},
  ];

  it('επιλογές: μοναδικές, κατά στάθμη, μόνο όσες υπάρχουν', () => {
    expect(floorFilterOptions(items, label).map((o) => o.value)).toEqual(['-1:basement', '0:pilotis', '0:ground', '2:standard']);
  });

  it('🔑 πυλωτή και ισόγειο (και τα δύο 0) ΔΕΝ συγχωνεύονται', () => {
    expect(floorFilterKey({ floor: 0, floorKind: 'pilotis' })).not.toBe(floorFilterKey({ floor: 0, floorKind: 'ground' }));
  });

  it('το παλιό κείμενο ταιριάζει με τον ίδιο όροφο σε νέο σχήμα (πριν τη μετανάστευση)', () => {
    expect(floorFilterKey({ floor: 'Υπόγειο -1' })).toBe(floorFilterKey({ floor: -1, floorKind: 'basement' }));
  });

  it('συμφωνεί με τις δικές του επιλογές — καμία επιλογή με μηδέν αποτελέσματα', () => {
    for (const option of floorFilterOptions(items, label)) {
      expect(items.some((item) => matchesFloorFilter(item, option.value))).toBe(true);
    }
  });

  it("'all' / κενό ⇒ όλα· χωρίς όροφο δεν ταιριάζει με συγκεκριμένο όροφο", () => {
    expect(matchesFloorFilter({}, 'all')).toBe(true);
    expect(matchesFloorFilter({}, undefined)).toBe(true);
    expect(matchesFloorFilter({}, '0:ground')).toBe(false);
  });
});
