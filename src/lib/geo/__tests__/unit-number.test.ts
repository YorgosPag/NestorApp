/**
 * ⚓ ADR-900 §8 #2 (2β.2) — ο ΕΝΑΣ κανονικοποιητής αριθμού μονάδας (RESO `UnitNumber`).
 * Εμφάνιση, όχι σύγκριση: τα ομόγλυφα τα κρίνει το κλειδί μονάδας (`place-unit.test.ts`).
 */

import { normalizeUnitNumber, UNIT_NUMBER_MAX_LENGTH } from '../unit-number';

describe('normalizeUnitNumber', () => {
  it.each([
    ['Α1', 'Α1'],
    [' α1 ', 'Α1'],
    ['α-1', 'Α1'],
    ['Α 1', 'Α1'],
    ['Β.2', 'Β2'],
    ['b2', 'B2'],
    ['12', '12'],
    [12, '12'],
    ['apt g', 'APTG'],
    ['3/4', '34'],
  ])('%p ⇒ %p', (raw, expected) => {
    expect(normalizeUnitNumber(raw)).toBe(expected);
  });

  it.each([[''], ['   '], [null], [undefined], [{}], ['x'.repeat(UNIT_NUMBER_MAX_LENGTH + 1)]])(
    '%p ⇒ null (ποτέ κενή συμβολοσειρά, ποτέ κείμενο-παράγραφος)',
    (raw) => {
      expect(normalizeUnitNumber(raw)).toBeNull();
    },
  );

  it('ιδεμποτικός', () => {
    for (const raw of ['α-1', 'Β 2', 'apt g']) {
      const once = normalizeUnitNumber(raw);
      expect(normalizeUnitNumber(once)).toBe(once);
    }
  });

  it('⚠️ ΔΕΝ ενώνει ελληνικό με λατινικό (εμφάνιση = ό,τι έγραψε ο άνθρωπος)', () => {
    expect(normalizeUnitNumber('Α1')).not.toBe(normalizeUnitNumber('A1'));
  });
});
