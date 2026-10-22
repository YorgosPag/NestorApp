/**
 * ⚓ ADR-777 §8.97 — το ΕΝΑ «μετρήθηκε;» και η ΜΙΑ ισότητα του μπλοκ εμβαδών.
 */

import { measuredAreaOrNull, OPTIONAL_AREA_KEYS, sameAreas, writtenAreasOf } from '../property-areas';

describe('measuredAreaOrNull', () => {
  it.each([[35, 35], [0.5, 0.5]])('%p ⇒ μετρήθηκε', (value, expected) => {
    expect(measuredAreaOrNull(value)).toBe(expected);
  });

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY, '35', null, undefined])('%p ⇒ «δεν μετρήθηκε»', (value) => {
    expect(measuredAreaOrNull(value)).toBeNull();
  });
});

describe('writtenAreasOf', () => {
  it('το μικτό πάντα· κάθε προαιρετικό ΜΟΝΟ όταν μετρήθηκε', () => {
    expect(writtenAreasOf({ gross: 80, net: 72, balcony: 0, terrace: 0, garden: 12 })).toEqual({ gross: 80, net: 72, garden: 12 });
    expect(writtenAreasOf({ gross: 0, net: 0, balcony: 0, terrace: 0, garden: 0 })).toEqual({ gross: 0 });
  });
});

describe('sameAreas', () => {
  it.each(OPTIONAL_AREA_KEYS)('`%s: 0` ≡ απουσία', (key) => {
    expect(sameAreas({ gross: 80, [key]: 0 }, { gross: 80 })).toBe(true);
  });

  it('απόν μπλοκ ≡ μπλοκ χωρίς μετρημένη τιμή', () => {
    expect(sameAreas(undefined, { gross: 0 })).toBe(true);
    expect(sameAreas(null, {})).toBe(true);
  });

  it('διαφορετική μετρημένη τιμή, σε ΟΠΟΙΟΔΗΠΟΤΕ κλειδί ⇒ όχι ίδια', () => {
    for (const key of ['gross', ...OPTIONAL_AREA_KEYS]) {
      expect(sameAreas({ gross: 80, [key]: 5 }, { gross: 80, [key]: 6 })).toBe(false);
    }
    expect(sameAreas({ gross: 80, terrace: 4 }, { gross: 80 })).toBe(false);
  });
});
