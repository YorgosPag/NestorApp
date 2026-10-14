/**
 * ⚓ `propertyDisplayArea` — το ΕΝΑ εμβαδόν της οθόνης, της δημόσιας αγγελίας και της εισαγωγής ΠΕΑ
 * (ADR-898 Φ4β · ADR-777 §8.96.5).
 */

import { propertyDisplayArea } from '../property-display-area';

describe('Ε1 — η αλυσίδα: μικτό → καθαρό → παλιό `area`', () => {
  it.each([
    ['μικτό', { areas: { gross: 95, net: 80 }, area: 70 }, 95],
    ['χωρίς μικτό ⇒ καθαρό', { areas: { net: 80 }, area: 70 }, 80],
    ['χωρίς `areas` ⇒ το παλιό επίπεδο', { area: 70 }, 70],
    ['τίποτα ⇒ `null`', {}, null],
  ])('%s', (_label, source, expected) => {
    expect(propertyDisplayArea(source)).toBe(expected);
  });
});

describe('Ε2 — `0` = «δεν μετρήθηκε»: η αλυσίδα προχωρά, ποτέ «0 m²»', () => {
  it('μικτό 0 ⇒ το καθαρό', () => {
    expect(propertyDisplayArea({ areas: { gross: 0, net: 80 } })).toBe(80);
  });

  it('όλα 0 ⇒ `null`', () => {
    expect(propertyDisplayArea({ areas: { gross: 0, net: 0 }, area: 0 })).toBeNull();
  });
});

describe('Ε3 — ανεκτικός αναγνώστης: ωμό έγγραφο Firestore δεν περνά ό,τι δεν είναι μέτρηση', () => {
  it.each([
    ['συμβολοσειρά', '95'],
    ['αρνητικό', -95],
    ['άπειρο', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
  ])('μικτό ως %s ⇒ παραλείπεται, μετρά το επόμενο', (_label, gross) => {
    expect(propertyDisplayArea({ areas: { gross, net: 80 } })).toBe(80);
  });

  it('`areas` που δεν είναι αντικείμενο ⇒ το παλιό `area`', () => {
    expect(propertyDisplayArea({ areas: 'x', area: 70 })).toBe(70);
    expect(propertyDisplayArea({ areas: null, area: 70 })).toBe(70);
  });
});
