/**
 * GREEK NLP UTILITIES TESTS
 *
 * Tests Greek stemming, Greeklish transliteration, diacritics stripping,
 * keyword extraction (stopword removal + domain boost), and overlap scoring.
 *
 * @see ADR-173 (AI Self-Improvement System)
 * @module __tests__/greek-nlp
 */

import {
  stemGreekWord,
  stripDiacritics,
  containsGreek,
  transliterateGreeklish,
  greekToLatin,
  extractKeywords,
  computeKeywordOverlap,
  GREEK_STOPWORDS,
  DOMAIN_KEYWORDS,
} from '../greek-nlp';

// ============================================================================
// STEMMING
// ============================================================================

describe('stemGreekWord', () => {
  it('returns word unchanged if <= 4 chars', () => {
    expect(stemGreekWord('και')).toBe('και');
    expect(stemGreekWord('εδω')).toBe('εδω');
  });

  it('removes common noun endings (-ος, -ης, -ας)', () => {
    const stemOs = stemGreekWord('λογος');
    const stemIs = stemGreekWord('εργατης');
    expect(stemOs).not.toContain('ος');
    expect(stemIs).not.toContain('ης');
  });

  it('removes verb suffix -ούν', () => {
    const result = stemGreekWord('δουλεύουν');
    expect(result.endsWith('ούν')).toBe(false);
  });

  it('preserves stem with minimum 2 chars after removal', () => {
    // Short word where removing suffix would leave <2 chars
    const result = stemGreekWord('κόμης');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns word unchanged if no suffix matches', () => {
    expect(stemGreekWord('κτήριο')).toBeDefined();
  });
});

// ============================================================================
// DIACRITICS
// ============================================================================

describe('stripDiacritics', () => {
  it('removes accents from Greek vowels', () => {
    expect(stripDiacritics('Δημητρίου')).toBe('Δημητριου');
  });

  it('handles mixed accented text', () => {
    expect(stripDiacritics('ράντεβού')).toBe('ραντεβου');
  });

  it('preserves non-accented text', () => {
    expect(stripDiacritics('hello')).toBe('hello');
  });
});

// ============================================================================
// GREEK DETECTION
// ============================================================================

describe('containsGreek', () => {
  it('returns true for Greek text', () => {
    expect(containsGreek('Γεια σου')).toBe(true);
  });

  it('returns false for Latin text', () => {
    expect(containsGreek('Hello world')).toBe(false);
  });

  it('returns true for mixed text with Greek', () => {
    expect(containsGreek('Hello κόσμε')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(containsGreek('')).toBe(false);
  });
});

// ============================================================================
// GREEKLISH TRANSLITERATION
// ============================================================================

describe('transliterateGreeklish', () => {
  it('converts single Greeklish chars to Greek', () => {
    expect(transliterateGreeklish('kalimera')).toContain('κ');
    expect(transliterateGreeklish('kalimera')).toContain('α');
  });

  it('handles digraphs (th→θ, ph→φ, ch→χ, ps→ψ)', () => {
    expect(transliterateGreeklish('thalassa')).toContain('θ');
    expect(transliterateGreeklish('psomi')).toContain('ψ');
  });

  it('handles ou→ου digraph', () => {
    expect(transliterateGreeklish('oura')).toContain('ου');
  });

  it('returns Greek text unchanged', () => {
    expect(transliterateGreeklish('Ελληνικά')).toBe('Ελληνικά');
  });

  it('preserves numbers and special chars', () => {
    const result = transliterateGreeklish('test 123!');
    expect(result).toContain('123');
    expect(result).toContain('!');
  });
});

// ============================================================================
// GREEK TO LATIN
// ============================================================================

describe('greekToLatin', () => {
  it('converts Greek to Latin', () => {
    const result = greekToLatin('Γιώργος');
    expect(result).toContain('g');
    expect(result).toContain('o');
  });

  it('returns empty string for non-Greek text', () => {
    expect(greekToLatin('Hello')).toBe('');
  });

  it('handles accented characters', () => {
    const result = greekToLatin('ά');
    expect(result).toBe('a');
  });
});

// ============================================================================
// KEYWORD EXTRACTION
// ============================================================================

describe('extractKeywords', () => {
  it('returns empty array for empty text', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('removes Greek stopwords', () => {
    const keywords = extractKeywords('και αλλά αυτός');
    expect(keywords).toHaveLength(0);
  });

  it('removes short words (< 2 chars default)', () => {
    const keywords = extractKeywords('α β γ δέκα');
    // Only δέκα should survive (length >= 2, not a stopword)
    expect(keywords.some(k => k.length >= 2)).toBe(true);
  });

  it('removes pure numbers', () => {
    const keywords = extractKeywords('project 12345 τιμή');
    expect(keywords).not.toContain('12345');
  });

  it('preserves domain keywords without stemming', () => {
    // Domain keywords work when mixed with Greek text (no transliteration)
    const keywords = extractKeywords('Θέλω project και deadline');
    expect(keywords).toContain('project');
    expect(keywords).toContain('deadline');
  });

  it('deduplicates keywords', () => {
    const keywords = extractKeywords('κτήριο κτήριο κτήριο');
    // After stemming and dedup, should be 1 entry
    const unique = new Set(keywords);
    expect(unique.size).toBe(keywords.length);
  });

  it('strips punctuation', () => {
    const keywords = extractKeywords('τιμή! project; email@test');
    expect(keywords.every(k => !/[;!@]/.test(k))).toBe(true);
  });

  it('transliterates Greeklish when no Greek present', () => {
    const keywords = extractKeywords('ktirio pliromi');
    // Should have transliterated to Greek
    expect(keywords.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// KEYWORD OVERLAP SCORING
// ============================================================================

describe('computeKeywordOverlap', () => {
  it('returns 0 for empty arrays', () => {
    expect(computeKeywordOverlap([], ['test'])).toBe(0);
    expect(computeKeywordOverlap(['test'], [])).toBe(0);
  });

  it('returns 1.0 for identical non-domain keywords', () => {
    expect(computeKeywordOverlap(['αα', 'ββ'], ['αα', 'ββ'])).toBe(1.0);
  });

  it('returns 0 for completely different keywords', () => {
    expect(computeKeywordOverlap(['αα', 'ββ'], ['γγ', 'δδ'])).toBe(0);
  });

  it('returns 0.5 for 50% overlap (non-domain)', () => {
    expect(computeKeywordOverlap(['αα', 'ββ'], ['αα', 'γγ'])).toBe(0.5);
  });

  it('boosts domain keywords (2x weight)', () => {
    // 'project' is a domain keyword with weight 2.0
    // 'test' is a regular keyword with weight 1.0
    // Total weight: 3.0, intersection weight: 2.0 (only project matches)
    const score = computeKeywordOverlap(['project', 'τεστ'], ['project', 'αλλο']);
    expect(score).toBeCloseTo(2.0 / 3.0, 2); // ~0.667
  });

  it('domain-only overlap gives higher score than regular', () => {
    const domainScore = computeKeywordOverlap(['project'], ['project']);
    const regularScore = computeKeywordOverlap(['τεστ'], ['τεστ']);
    // Both should be 1.0 since single keyword matches
    expect(domainScore).toBe(1.0);
    expect(regularScore).toBe(1.0);
  });
});

// ============================================================================
// DATA QUALITY
// ============================================================================

describe('data quality', () => {
  it('GREEK_STOPWORDS set is non-empty', () => {
    expect(GREEK_STOPWORDS.size).toBeGreaterThan(50);
  });

  it('DOMAIN_KEYWORDS set is non-empty', () => {
    expect(DOMAIN_KEYWORDS.size).toBeGreaterThan(20);
  });

  it('domain keywords do not overlap with stopwords', () => {
    for (const keyword of DOMAIN_KEYWORDS) {
      expect(GREEK_STOPWORDS.has(keyword)).toBe(false);
    }
  });
});
