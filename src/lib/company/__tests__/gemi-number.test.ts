/**
 * @fileoverview Άγκυρες της **κανονικής μορφής του αριθμού ΓΕΜΗ** — ADR-841 §7 Α23 (Φ1).
 *
 * 🔴 Το σενάριο που φυλάνε: το ΓΕΜΗ επιστρέφει `arGemi` ως **ακέραιο**. Χωρίς κανονικοποίηση,
 * κάθε σωστή δήλωση με αρχικά μηδενικά θα διαβαζόταν «διαφορετικός αριθμός από το ΓΕΜΗ».
 */

import {
  canonicalGemiNumber,
  GEMI_NUMBER_MAX_DIGITS,
  sameGemiNumber,
} from '@/lib/company/gemi-number';

describe('Α — η κανονική μορφή', () => {
  it('Α1 — 12 ψηφία μένουν ως έχουν', () => {
    expect(canonicalGemiNumber('123456789000')).toBe('123456789000');
  });

  it('Α2 — κενά, τελείες και παύλες του ανθρώπου δεν αλλάζουν τον αριθμό', () => {
    expect(canonicalGemiNumber(' 1234 5678-9000 ')).toBe('123456789000');
    expect(canonicalGemiNumber('123.456.789.000')).toBe('123456789000');
  });

  it('Α3 — 🔴 τα αρχικά μηδενικά φεύγουν (το μητρώο τα έχει ήδη χάσει)', () => {
    expect(canonicalGemiNumber('000123401000')).toBe('123401000');
  });

  it('Α4 — ακέραιος από το σύρμα ⇒ ίδια μορφή με το κείμενο του ανθρώπου', () => {
    expect(canonicalGemiNumber(123456789000)).toBe('123456789000');
  });

  it(`Α5 — πάνω από ${GEMI_NUMBER_MAX_DIGITS} ψηφία ⇒ null`, () => {
    expect(canonicalGemiNumber('1234567890001')).toBeNull();
  });

  it('Α6 — ό,τι δεν είναι αριθμός ΓΕΜΗ ⇒ null, ποτέ «κάτι»', () => {
    for (const input of ['', '   ', 'abc', '12a4', '0000', null, undefined, -5, 1.5, 0]) {
      expect(canonicalGemiNumber(input)).toBeNull();
    }
  });
});

describe('Σ — η σύγκριση', () => {
  it('Σ1 — ίδιος αριθμός με και χωρίς μηδενικά / ως κείμενο και ως ακέραιος', () => {
    expect(sameGemiNumber('000123401000', 123401000)).toBe(true);
  });

  it('Σ2 — διαφορετικοί αριθμοί ⇒ όχι', () => {
    expect(sameGemiNumber('123456789000', '123456789001')).toBe(false);
  });

  it('Σ3 — 🔑 δύο απουσίες ΔΕΝ «ταιριάζουν»', () => {
    expect(sameGemiNumber(null, null)).toBe(false);
    expect(sameGemiNumber('', '')).toBe(false);
  });
});
