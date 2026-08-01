/**
 * @fileoverview containsWordSequence / matchesWordSequenceAt — the shared word matcher.
 *
 * Promoted from the titleblock reader in ADR-745 §6.4 so that `src/config` can reach it.
 * The behaviour tested here is the behaviour the titleblock label matcher already relied
 * on; what is new is the **contiguity** guarantee, which the reverse profession resolver
 * depends on to reject text that merely contains the right words far apart.
 */

import {
  containsWordSequence,
  matchesWordSequenceAt,
  normalizeForLabelMatch,
  splitIntoWords,
} from '../greek-text';

/** The phrase in the same comparison form the matcher expects on both sides. */
const phrase = (text: string): string[] =>
  splitIntoWords(text).map((word) => word.normalized);

const contains = (haystack: string, needle: string): boolean =>
  containsWordSequence(splitIntoWords(haystack), phrase(needle));

describe('splitIntoWords', () => {
  it('keeps the position in the ORIGINAL string, not in the normalized one', () => {
    const [first, second] = splitIntoWords('ΕΡΓΟΔΟΤΗΣ: ΖΕΡΒΑ');
    expect(first).toMatchObject({ raw: 'ΕΡΓΟΔΟΤΗΣ', start: 0, end: 9 });
    expect(second).toMatchObject({ raw: 'ΖΕΡΒΑ', start: 11, end: 16 });
  });

  it('drops runs that degenerate to nothing — a lone dash is a separator, not a word', () => {
    expect(splitIntoWords('ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ').map((w) => w.raw)).toEqual([
      'ΜΕΛΕΤΕΣ',
      'ΕΦΑΡΜΟΓΕΣ',
    ]);
  });

  it('keeps a dotted abbreviation as ONE word', () => {
    expect(splitIntoWords('ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.').map((w) => w.normalized)).toEqual([
      'μηχανικος',
      'απθ',
    ]);
  });

  it('has no words for empty or punctuation-only text', () => {
    expect(splitIntoWords('')).toEqual([]);
    expect(splitIntoWords('  -  ()  ')).toEqual([]);
  });
});

describe('matchesWordSequenceAt', () => {
  const words = splitIntoWords('ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ 2024');

  it('matches on the exact offset and nowhere else', () => {
    expect(matchesWordSequenceAt(words, 0, phrase('ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ'))).toBe(true);
    expect(matchesWordSequenceAt(words, 1, phrase('ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ'))).toBe(false);
  });

  it('never reads past the end of the words', () => {
    expect(matchesWordSequenceAt(words, 2, phrase('2024 ΚΑΤΙ'))).toBe(false);
  });

  it('compares WORDS, not substrings — «ΜΕΛΕΤΗ» is not inside «ΜΕΛΕΤΗΣ»', () => {
    expect(matchesWordSequenceAt(words, 1, phrase('ΜΕΛΕΤΗ'))).toBe(false);
    expect(matchesWordSequenceAt(words, 1, phrase('ΜΕΛΕΤΗΣ'))).toBe(true);
  });
});

describe('containsWordSequence', () => {
  it('finds the phrase at the start, in the middle and at the end', () => {
    expect(contains('ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.', 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ')).toBe(true);
    expect(contains('Ο ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ ΥΠΟΓΡΑΦΕΙ', 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ')).toBe(true);
    expect(contains('ΥΠΟΓΡΑΦΗ: ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ', 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ')).toBe(true);
  });

  it('🔴 requires ADJACENCY — the same words scattered apart do NOT match', () => {
    expect(contains('ΠΟΛΙΤΙΚΟΣ ΥΠΑΛΛΗΛΟΣ ΚΑΙ ΜΗΧΑΝΙΚΟΣ ΑΥΤΟΚΙΝΗΤΩΝ', 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ'))
      .toBe(false);
  });

  it('is not fooled by word ORDER either', () => {
    expect(contains('ΜΗΧΑΝΙΚΟΣ ΠΟΛΙΤΙΚΟΣ', 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ')).toBe(false);
  });

  it('treats a dash between the words as a separator, so they stay adjacent', () => {
    expect(contains('ΠΟΛΙΤΙΚΟΣ - ΜΗΧΑΝΙΚΟΣ', 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ')).toBe(true);
  });

  it('an empty phrase matches NOTHING — it is a compilation accident, not a wildcard', () => {
    expect(containsWordSequence(splitIntoWords('ΟΤΙΔΗΠΟΤΕ'), [])).toBe(false);
    expect(containsWordSequence([], [])).toBe(false);
  });

  it('a phrase longer than the text cannot match', () => {
    expect(contains('ΜΗΧΑΝΙΚΟΣ', 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ')).toBe(false);
  });
});

describe('normalizeForLabelMatch — the ORDER of the two steps is the mechanism', () => {
  it('folds the homoglyph BEFORE lowercasing, so a Latin H still becomes Η', () => {
    const contaminated = 'ΣΥΝΤΑΞ' + String.fromCodePoint(0x0048);
    expect(normalizeForLabelMatch(contaminated)).toBe(normalizeForLabelMatch('ΣΥΝΤΑΞΗ'));
  });

  it('leaves genuinely Latin text alone', () => {
    expect(normalizeForLabelMatch('www.nikolaou.com.gr')).toBe('wwwnikolaoucomgr');
  });
});
