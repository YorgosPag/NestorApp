/**
 * ADR-914 §8.18 — ΕΝΑΣ κανόνας ετικέτας για έγγραφο ορόφου.
 *
 * Το περιστατικό (παραγωγή, 2026-10-12): ο οδηγός εισαγωγής έδειχνε «F» / «SP» ενώ οι καρτέλες
 * ορόφων έδειχναν «Θεμελίωση» / «Απόληξη Κλιμακοστασίου» — δύο κανόνες για το ίδιο έγγραφο.
 */

import { storedFloorLabel } from '../floor-label-bundle';

describe('storedFloorLabel', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: το πλήρες όνομα νικά τον σύντομο κωδικό', () => {
    expect(storedFloorLabel({ number: -2, name: 'F', longName: 'Θεμελίωση', kind: 'foundation' })).toBe('Θεμελίωση');
    expect(storedFloorLabel({ number: 5, name: 'SP', longName: 'Απόληξη Κλιμακοστασίου', kind: 'stair-penthouse' }))
      .toBe('Απόληξη Κλιμακοστασίου');
  });

  it('χωρίς πλήρες όνομα ⇒ το όνομα του εγγράφου', () => {
    expect(storedFloorLabel({ number: 1, name: 'Όροφος καταστημάτων' })).toBe('Όροφος καταστημάτων');
    expect(storedFloorLabel({ number: 1, name: 'A', longName: '' })).toBe('A');
  });

  it('χωρίς κανένα όνομα ⇒ η canonical ετικέτα από είδος + αριθμό, ποτέ καρφωτό κείμενο', () => {
    expect(storedFloorLabel({ number: 0, name: '' })).toBe('Ισόγειο');
    expect(storedFloorLabel({ number: 3 })).toBe('3ος Όροφος');
    expect(storedFloorLabel({ number: 0, name: null, longName: null, kind: 'pilotis' })).toBe('Πυλωτή');
  });
});
