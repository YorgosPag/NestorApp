/**
 * @fileoverview normalizeGreekHomoglyphs — Latin letters masquerading as Greek.
 *
 * Every fixture below is a **measured** string from the real survey drawing
 * `G753_ergasia F.dxf` (ADR-745 §2.3), not an invented example. The Latin `H`
 * inside `ΣΥΝΤΑΞΗ` is what motivated the function: it renders identically and
 * defeats every string comparison silently.
 */

import { normalizeGreekHomoglyphs, normalizeForSearch } from '../greek-text';

/** Code points, so a failure reports *which* letter differs rather than an identical-looking diff. */
const points = (s: string): string =>
  [...s].map(c => c.codePointAt(0)!.toString(16).padStart(4, '0')).join(' ');

describe('normalizeGreekHomoglyphs', () => {
  describe('the measured case', () => {
    // Built from code points so the fixture cannot be "fixed" by an editor
    // silently normalising the character.
    const CONTAMINATED = 'ΣΥΝΤΑΞ' + String.fromCodePoint(0x0048); // Latin capital H
    const CLEAN = 'ΣΥΝΤΑΞΗ'; // Greek capital Η (U+0397)

    it('the two strings really are different before the fold', () => {
      expect(CONTAMINATED).not.toBe(CLEAN);
      expect(points(CONTAMINATED)).toBe('03a3 03a5 039d 03a4 0391 039e 0048');
      expect(points(CLEAN)).toBe('03a3 03a5 039d 03a4 0391 039e 0397');
    });

    it('folds the Latin H into the Greek Η', () => {
      expect(normalizeGreekHomoglyphs(CONTAMINATED)).toBe(CLEAN);
    });

    it('normalizeForSearch alone does NOT fix it — this is why the function exists', () => {
      expect(normalizeForSearch(CONTAMINATED)).not.toBe(normalizeForSearch(CLEAN));
      expect(normalizeForSearch(normalizeGreekHomoglyphs(CONTAMINATED)))
        .toBe(normalizeForSearch(CLEAN));
    });
  });

  describe('leaves genuinely Latin text alone', () => {
    it.each([
      ['www.nikolaou.com.gr'],
      ['info@nikolaou.com.gr'],
      ['Arial'],
      ['Times New Roman'],
      ['OTE'],   // all-homoglyph, but no Greek letter → not a contaminated Greek word
      ['NOTE'],
      ['T1'],    // the drawing number
    ])('%s', input => {
      expect(normalizeGreekHomoglyphs(input)).toBe(input);
    });

    it('does not touch a Latin word sitting next to Greek words', () => {
      const line = 'site: www.nikolaou.com.gr e-mail: info@nikolaou.com.gr';
      expect(normalizeGreekHomoglyphs(line)).toBe(line);
    });
  });

  describe('leaves clean Greek unchanged (idempotent)', () => {
    it.each([
      ['ΕΡΓΟΔΟΤΗΣ'],
      ['ΖΕΡΒΑ ΓΕΩΡΓΙΑ'],
      ['ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.'],
      ['ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.'],
      ['ΤΟΠΟΓΡΑΦΙΚΟ ΔΙΑΓΡΑΜΜΑ'],
      ['ΙΟΥΛΙΟΣ 2026'],
    ])('%s', input => {
      expect(normalizeGreekHomoglyphs(input)).toBe(input);
    });

    it('applying it twice changes nothing further', () => {
      const once = normalizeGreekHomoglyphs('ΣΥΝΤΑΞ' + String.fromCodePoint(0x0048));
      expect(normalizeGreekHomoglyphs(once)).toBe(once);
    });
  });

  describe('the Greek-context guard', () => {
    it('refuses to fold when the word carries a NON-homoglyph Latin letter', () => {
      // The word must contain BOTH a foldable letter and an unfoldable one, or the
      // assertion cannot tell "bailed out" apart from "folded nothing" — a mutation
      // that drops the bail and folds opportunistically survived the earlier fixture
      // (`ΜΗΧΑΝΙΚΟΣd`), because with no homoglyph present both paths return the input.
      const mixed = 'ΣΥΝΤΑΞ' + String.fromCodePoint(0x0048) + 'd'; // Greek + Latin H + Latin d
      expect(mixed).toContain('d');
      expect(normalizeGreekHomoglyphs(mixed)).toBe(mixed);
      // Explicitly: it must NOT fold the H just because the H alone is foldable.
      expect(normalizeGreekHomoglyphs(mixed)).not.toBe('ΣΥΝΤΑΞΗd');
    });

    it('folds each word independently within one string', () => {
      const input = `ΣΥΝΤΑΞ${String.fromCodePoint(0x0048)} Arial ΥΠΟΓΡΑΦΗ`;
      expect(normalizeGreekHomoglyphs(input)).toBe('ΣΥΝΤΑΞΗ Arial ΥΠΟΓΡΑΦΗ');
    });

    it('treats punctuation as a word boundary, so abbreviations survive', () => {
      // Π.Ε. — each letter is its own word run; none is contaminated.
      expect(normalizeGreekHomoglyphs('Π.Ε. 39')).toBe('Π.Ε. 39');
      expect(normalizeGreekHomoglyphs('Ο.Τ. Γ 753')).toBe('Ο.Τ. Γ 753');
    });

    it('keeps digits attached to a folded Greek word', () => {
      const input = 'ΟΙΚ' + String.fromCodePoint(0x004f) + '2'; // Latin O inside a Greek run
      expect(normalizeGreekHomoglyphs(input)).toBe('ΟΙΚΟ2');
    });
  });

  describe('degenerate input', () => {
    it.each([[''], ['   '], ['123'], ['1:200'], ['-'], ['...']])('%s passes through', input => {
      expect(normalizeGreekHomoglyphs(input)).toBe(input);
    });
  });
});
