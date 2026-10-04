/**
 * @fileoverview `indexWithin` — η ΜΙΑ απάντηση στο «τι έρχεται μετά την τελευταία;» (ADR-899 §9 · θέμα 4).
 * Μεταλλάξεις: clamp που κάνει λούπα (modal: → στο 4/4 πήγαινε 1/4) · wrap χωρίς `+ total` (αρνητικό) · κενή λίστα ⇒ NaN.
 */

import { indexWithin } from '../array-utils';

describe('indexWithin', () => {
  it('clamp: σταματά στα δύο άκρα', () => {
    expect(indexWithin(4, 4, 'clamp')).toBe(3);
    expect(indexWithin(-1, 4, 'clamp')).toBe(0);
    expect(indexWithin(2, 4, 'clamp')).toBe(2);
  });

  it('wrap: έρχεται γύρω και στα δύο άκρα (και από αρνητικό)', () => {
    expect(indexWithin(4, 4, 'wrap')).toBe(0);
    expect(indexWithin(-1, 4, 'wrap')).toBe(3);
    expect(indexWithin(9, 4, 'wrap')).toBe(1);
  });

  it('μία φωτογραφία ⇒ πάντα 0 · κενή λίστα ⇒ 0, ποτέ NaN', () => {
    expect(indexWithin(1, 1, 'clamp')).toBe(0);
    expect(indexWithin(-1, 1, 'wrap')).toBe(0);
    expect(indexWithin(1, 0, 'wrap')).toBe(0);
    expect(indexWithin(1, 0, 'clamp')).toBe(0);
  });
});
