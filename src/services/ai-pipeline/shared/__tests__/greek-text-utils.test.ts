/**
 * GREEK TEXT UTILITIES TESTS — Fuzzy Name Matching
 *
 * Tests transliterateGreekToLatin, greekStemMatch, fuzzyGreekMatch
 * covering: digraphs, declension tolerance, cross-script matching,
 * accent normalization, and edge cases.
 *
 * @see ADR-145 (Super Admin AI Assistant)
 * @module __tests__/greek-text-utils
 */

// ── Mock server-only (via moduleNameMapper) ──

// ── Mock centralized greek-text utils ──
jest.mock('@/utils/greek-text', () => ({
  stripAccents: (text: string) =>
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  normalizeGreekText: (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
}));

import {
  transliterateGreekToLatin,
  greekStemMatch,
  fuzzyGreekMatch,
  stripAccents,
  normalizeGreekText,
} from '../greek-text-utils';

// ============================================================================
// STRIP ACCENTS / NORMALIZE (re-exported from @/utils/greek-text)
// ============================================================================

describe('stripAccents', () => {
  it('removes accents from Greek text', () => {
    expect(stripAccents('Γιώργος')).toBe('Γιωργος');
  });

  it('removes accents from Σοφία', () => {
    expect(stripAccents('Σοφία')).toBe('Σοφια');
  });

  it('preserves Latin text unchanged', () => {
    expect(stripAccents('Hello World')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(stripAccents('')).toBe('');
  });
});

describe('normalizeGreekText', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeGreekText('Γιώργος')).toBe('γιωργος');
  });

  it('normalizes mixed case + accented text', () => {
    expect(normalizeGreekText('ΣΟΦΙΑ')).toBe('σοφια');
  });
});

// ============================================================================
// TRANSLITERATION: GREEK → LATIN
// ============================================================================

describe('transliterateGreekToLatin', () => {
  it('transliterates simple name "Γιώργος" → "giorgos"', () => {
    expect(transliterateGreekToLatin('Γιώργος')).toBe('giorgos');
  });

  it('transliterates "Σοφία" → "sofia"', () => {
    expect(transliterateGreekToLatin('Σοφία')).toBe('sofia');
  });

  it('handles digraph "ου" → "ou"', () => {
    expect(transliterateGreekToLatin('Ρούλα')).toContain('ou');
  });

  it('handles digraph "μπ" → "b"', () => {
    expect(transliterateGreekToLatin('μπαλα')).toContain('b');
  });

  it('handles digraph "ντ" → "d"', () => {
    expect(transliterateGreekToLatin('ντολμα')).toContain('d');
  });

  it('handles digraph "γκ" → "g"', () => {
    expect(transliterateGreekToLatin('γκαζι')).toContain('g');
  });

  it('handles digraph "τσ" → "ts"', () => {
    expect(transliterateGreekToLatin('τσαι')).toContain('ts');
  });

  it('handles digraph "τζ" → "tz"', () => {
    expect(transliterateGreekToLatin('τζατζικι')).toContain('tz');
  });

  it('handles final sigma "ς" same as "σ"', () => {
    const result = transliterateGreekToLatin('Νίκος');
    expect(result).toBe('nikos');
  });

  it('passes through numbers and symbols', () => {
    expect(transliterateGreekToLatin('123!')).toBe('123!');
  });

  it('handles empty string', () => {
    expect(transliterateGreekToLatin('')).toBe('');
  });

  it('transliterates full name "Παπαδόπουλος"', () => {
    const result = transliterateGreekToLatin('Παπαδόπουλος');
    expect(result).toBe('papadopoulos');
  });

  it('transliterates "Δημήτριος" correctly', () => {
    const result = transliterateGreekToLatin('Δημήτριος');
    expect(result).toBe('dimitrios');
  });
});

// ============================================================================
// GREEK STEM MATCHING
// ============================================================================

describe('greekStemMatch', () => {
  it('matches same word exactly', () => {
    expect(greekStemMatch('Γιάννης', 'Γιάννης')).toBe(true);
  });

  it('matches nominative vs vocative: Γιάννης ↔ Γιάννη', () => {
    expect(greekStemMatch('Γιάννης', 'Γιάννη')).toBe(true);
  });

  it('matches genitive: Σοφίας ↔ Σοφία', () => {
    expect(greekStemMatch('Σοφίας', 'Σοφία')).toBe(true);
  });

  it('returns false for short strings (< MIN_STEM_LENGTH)', () => {
    expect(greekStemMatch('Αν', 'Ανα')).toBe(false);
  });

  it('returns false for completely different names', () => {
    expect(greekStemMatch('Γιώργος', 'Σοφία')).toBe(false);
  });

  it('handles accent differences via normalization', () => {
    expect(greekStemMatch('Γιωργος', 'Γιώργος')).toBe(true);
  });
});

// ============================================================================
// FUZZY GREEK MATCH — 4-level algorithm
// ============================================================================

describe('fuzzyGreekMatch', () => {
  describe('Level 1: Direct substring match', () => {
    it('matches exact substring', () => {
      expect(fuzzyGreekMatch('Γιώργος Παπαδόπουλος', 'Γιώργος')).toBe(true);
    });

    it('matches case-insensitive', () => {
      expect(fuzzyGreekMatch('ΓΙΩΡΓΟΣ', 'γιωργος')).toBe(true);
    });
  });

  describe('Level 2: Accent-normalized match', () => {
    it('matches when accents differ: γιωργος vs Γιώργος', () => {
      expect(fuzzyGreekMatch('Γιώργος Παπαδόπουλος', 'γιωργος')).toBe(true);
    });
  });

  describe('Level 3: Stem match (declension)', () => {
    it('matches Γιάννη → Γιάννης (vocative → nominative)', () => {
      expect(fuzzyGreekMatch('Γιάννης Κουτσούρης', 'Γιάννη')).toBe(true);
    });

    it('matches Σοφίας → Σοφία (genitive → nominative)', () => {
      expect(fuzzyGreekMatch('Σοφία Παπαδοπούλου', 'Σοφίας')).toBe(true);
    });
  });

  describe('Level 4: Transliterated / cross-script match', () => {
    it('matches Greeklish input: "Giorgos" → "Γιώργος"', () => {
      // transliterateGreekToLatin("Γιώργος") = "giorgos"
      // transliterateGreekToLatin("Giorgos") = "giorgos" (Latin passes through)
      expect(fuzzyGreekMatch('Γιώργος', 'giorgos')).toBe(true);
    });

    it('matches Greeklish surname: "papadopoulos" → "Παπαδόπουλος"', () => {
      expect(fuzzyGreekMatch('Παπαδόπουλος', 'papadopoulos')).toBe(true);
    });

    it('matches cross-script: "dimitrios" → "Δημήτριος"', () => {
      expect(fuzzyGreekMatch('Δημήτριος', 'dimitrios')).toBe(true);
    });
  });

  describe('Negative cases', () => {
    it('returns false for completely unrelated strings', () => {
      expect(fuzzyGreekMatch('Γιώργος', 'Μαρία')).toBe(false);
    });

    it('short search term (2 chars) still matches via substring includes', () => {
      // Level 1 (direct substring) matches "Γι" inside "Γιώργος" — this is expected behavior
      expect(fuzzyGreekMatch('Γιώργος Παπαδόπουλος', 'Γι')).toBe(true);
    });

    it('returns false for short unrelated search term', () => {
      expect(fuzzyGreekMatch('Γιώργος', 'Ξε')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles empty candidate name', () => {
      expect(fuzzyGreekMatch('', 'test')).toBe(false);
    });

    it('handles empty search term', () => {
      // empty search matches via includes('')
      expect(fuzzyGreekMatch('Γιώργος', '')).toBe(true);
    });

    it('handles mixed Greek/Latin text', () => {
      expect(fuzzyGreekMatch('Γιώργος (George) Παπαδόπουλος', 'George')).toBe(true);
    });
  });
});
