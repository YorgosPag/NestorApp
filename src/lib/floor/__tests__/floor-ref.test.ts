/**
 * ADR-903 — η ΜΙΑ αναφορά ορόφου: parser παλιών κειμένων + η ΜΙΑ ετικέτα (el/en).
 */

import { FLOOR_KIND_VALUES, type FloorKind } from '@/utils/floor-naming';
import { parseLegacyFloor, resolveFloorKind, floorRefOf, type FloorRef } from '../floor-ref';
import { floorLabelIn, canonicalFloorLongName } from '../floor-label-bundle';

describe('parseLegacyFloor — ο ΕΝΑΣ parser', () => {
  it.each<[unknown, FloorRef]>([
    [0, { number: 0, kind: null }],
    [-2, { number: -2, kind: null }],
    ['3', { number: 3, kind: null }],
    ['-1', { number: -1, kind: null }],
    ['Ισόγειο', { number: 0, kind: 'ground' }],
    ['Ground Floor', { number: 0, kind: 'ground' }],
    ['Υπόγειο', { number: -1, kind: 'basement' }],
    ['Υπόγειο -1', { number: -1, kind: 'basement' }],
    ['Υπόγειο -2', { number: -2, kind: 'basement' }],
    ['2ο Υπόγειο', { number: -2, kind: 'basement' }],
    ['Basement 3', { number: -3, kind: 'basement' }],
    ['basement-2', { number: -2, kind: 'basement' }],
    ['B2', { number: -2, kind: 'basement' }],
    ['1ος Όροφος', { number: 1, kind: 'standard' }],
    ['5ος όροφος', { number: 5, kind: 'standard' }],
    ['Floor 4', { number: 4, kind: 'standard' }],
    ['21st Floor', { number: 21, kind: 'standard' }],
    ['L7', { number: 7, kind: 'standard' }],
    ['first', { number: 1, kind: 'standard' }],
    ['Πυλωτή', { number: 0, kind: 'pilotis' }],
    ['pilotis', { number: 0, kind: 'pilotis' }],
    ['Ημιυπόγειο', { number: -1, kind: 'semi-basement' }],
    ['Υπερυψωμένο', { number: 0, kind: 'raised-ground' }],
    ['Ημιώροφος', { number: null, kind: 'mezzanine' }],
    ['2ο Μεσοπάτωμα', { number: 2, kind: 'mezzanine' }],
    ['Δώμα', { number: null, kind: 'roof' }],
    ['rooftop', { number: null, kind: 'roof' }],
    ['Σοφίτα', { number: null, kind: 'attic' }],
    ['Απόληξη Κλιμακοστασίου', { number: null, kind: 'stair-penthouse' }],
  ])('%p ⇒ %p', (raw, expected) => {
    expect(parseLegacyFloor(raw)).toEqual(expected);
  });

  it.each([['1A'], ['κάπου'], [''], ['   '], [1.5], [null], [undefined], [{}]])(
    '🔴 %p ⇒ null — ΠΟΤΕ σιωπηλό ισόγειο',
    (raw) => {
      expect(parseLegacyFloor(raw)).toBeNull();
    },
  );
});

describe('formatFloorRef — η ΜΙΑ ετικέτα, el/en', () => {
  it.each<[FloorRef, string, string]>([
    [{ number: 0, kind: null }, 'Ισόγειο', 'Ground Floor'],
    [{ number: -1, kind: null }, 'Υπόγειο', 'Basement'],
    [{ number: -3, kind: null }, '3ο Υπόγειο', 'Basement 3'],
    [{ number: 1, kind: null }, '1ος Όροφος', '1st Floor'],
    [{ number: 2, kind: null }, '2ος Όροφος', '2nd Floor'],
    [{ number: 3, kind: null }, '3ος Όροφος', '3rd Floor'],
    [{ number: 4, kind: null }, '4ος Όροφος', '4th Floor'],
    [{ number: 11, kind: null }, '11ος Όροφος', '11th Floor'],
    [{ number: 12, kind: null }, '12ος Όροφος', '12th Floor'],
    [{ number: 13, kind: null }, '13ος Όροφος', '13th Floor'],
    [{ number: 21, kind: null }, '21ος Όροφος', '21st Floor'],
    [{ number: 22, kind: null }, '22ος Όροφος', '22nd Floor'],
    [{ number: 23, kind: null }, '23ος Όροφος', '23rd Floor'],
    [{ number: 101, kind: null }, '101ος Όροφος', '101st Floor'],
    [{ number: 0, kind: 'pilotis' }, 'Πυλωτή', 'Pilotis'],
    [{ number: 0, kind: 'raised-ground' }, 'Υπερυψωμένο Ισόγειο', 'Raised Ground Floor'],
    [{ number: -1, kind: 'semi-basement' }, 'Ημιυπόγειο', 'Semi-basement'],
    [{ number: null, kind: 'mezzanine' }, 'Μεσοπάτωμα', 'Mezzanine'],
    [{ number: 2, kind: 'mezzanine' }, '2ο Μεσοπάτωμα', 'Mezzanine 2'],
    [{ number: null, kind: 'roof' }, 'Δώμα', 'Roof'],
    [{ number: null, kind: 'attic' }, 'Σοφίτα', 'Attic'],
  ])('%p ⇒ «%s» / «%s»', (ref, el, en) => {
    expect(floorLabelIn(ref, 'el')).toBe(el);
    expect(floorLabelIn(ref, 'en')).toBe(en);
  });

  const NUMBERS = [-3, -1, 0, 1, 2, 3, 11, 21];

  it.each(FLOOR_KIND_VALUES.map((kind) => [kind] as const))(
    '🔑 %s: κάθε ετικέτα ξαναδιαβάζεται στην ΙΔΙΑ ετικέτα (el + en) — κανένα ωμό κλειδί, κανένα `{…}`',
    (kind: FloorKind) => {
      // Αρνητικός «κανονικός όροφος» δεν είναι στάθμη — το υπόγειο είναι δικό του είδος.
      for (const number of NUMBERS.filter((n) => kind !== 'standard' || n >= 0)) {
        for (const language of ['el', 'en'] as const) {
          const label = floorLabelIn({ number, kind }, language);
          expect(label).not.toMatch(/[{}]|floors:/);
          const reparsed = parseLegacyFloor(label);
          expect(reparsed).not.toBeNull();
          expect(floorLabelIn(reparsed as FloorRef, language)).toBe(label);
        }
      }
    },
  );
});

describe('canonicalFloorLongName — η αποθηκευμένη ελληνική longName ΑΜΕΤΑΒΛΗΤΗ', () => {
  it.each<[FloorKind, number, string]>([
    ['foundation', 0, 'Θεμελίωση'],
    ['roof', 0, 'Δώμα'],
    ['ground', 0, 'Ισόγειο'],
    ['basement', -1, 'Υπόγειο'],
    ['basement', -2, '2ο Υπόγειο'],
    ['basement', 0, 'Υπόγειο'],
    ['mezzanine', 1, 'Μεσοπάτωμα'],
    ['mezzanine', 2, '2ο Μεσοπάτωμα'],
    ['mezzanine', 0, 'Μεσοπάτωμα'],
    ['standard', 7, '7ος Όροφος'],
    ['stair-penthouse', 3, 'Απόληξη Κλιμακοστασίου'],
  ])('%s/%d ⇒ %s', (kind, number, expected) => {
    expect(canonicalFloorLongName(kind, number)).toBe(expected);
  });
});

describe('floorRefOf / resolveFloorKind', () => {
  it('ακέραιος ⇒ αναφορά· απών ή μη ακέραιος ⇒ null', () => {
    expect(floorRefOf(2)).toEqual({ number: 2, kind: null });
    expect(floorRefOf(0, 'pilotis')).toEqual({ number: 0, kind: 'pilotis' });
    expect(floorRefOf(null)).toBeNull();
    expect(floorRefOf(undefined)).toBeNull();
    expect(floorRefOf(1.5)).toBeNull();
  });

  it('το είδος συνάγεται μόνο όταν δεν δηλώθηκε', () => {
    expect(resolveFloorKind({ number: -1, kind: null })).toBe('basement');
    expect(resolveFloorKind({ number: 0, kind: 'pilotis' })).toBe('pilotis');
  });
});
