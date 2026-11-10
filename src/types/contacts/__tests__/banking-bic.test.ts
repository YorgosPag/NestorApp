/**
 * BIC (ISO 9362:2014) — 8 ή 11 χαρακτήρες: συμμετέχων (4 αλφαριθμητικά) · χώρα (2 γράμματα) · τοποθεσία (2) · κατάστημα (3, προαιρετικό).
 * @see ADR-ACC-018 §15
 */

import { cleanBIC, isValidBIC } from '../banking';

describe('isValidBIC', () => {
  it('δέχεται 8 και 11 χαρακτήρες, πεζά και κενά', () => {
    expect(isValidBIC('ETHNGRAA')).toBe(true);
    expect(isValidBIC('PIRBGRAAXXX')).toBe(true);
    expect(isValidBIC('ethn graa')).toBe(true);
  });

  it('απορρίπτει λάθος μήκος και ψηφία στη θέση της χώρας', () => {
    expect(isValidBIC('ETHNGRA')).toBe(false);
    expect(isValidBIC('ETHNGRAAXX')).toBe(false);
    expect(isValidBIC('ETHN12AA')).toBe(false);
    expect(isValidBIC('')).toBe(false);
  });
});

describe('cleanBIC', () => {
  it('χωρίς κενά, κεφαλαία', () => {
    expect(cleanBIC(' ethn graa ')).toBe('ETHNGRAA');
  });
});
