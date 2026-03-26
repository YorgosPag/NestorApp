/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * ESCO SEARCH UTILS — Unit Tests for Pure Functions
 * =============================================================================
 *
 * Tests ONLY pure/synchronous functions: normalizeEsco, queryToTokens.
 * Skips: searchEscoOccupations, searchEscoSkills, enforceEscoOccupation,
 *        enforceEscoSkill (Firestore-dependent).
 */

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { ESCO_CACHE: 'esco_cache', ESCO_SKILLS_CACHE: 'esco_skills_cache' },
}));

import { normalizeEsco, queryToTokens } from '../esco-search-utils';

// ===========================================================================
// 1. normalizeEsco
// ===========================================================================

describe('normalizeEsco', () => {
  it('strips diacritics from Greek text', () => {
    expect(normalizeEsco('Τεχνίτης')).toBe('τεχνιτης');
  });

  it('lowercases uppercase Greek', () => {
    expect(normalizeEsco('ΜΑΓΕΙΡΑΣ')).toBe('μαγειρας');
  });

  it('trims whitespace', () => {
    expect(normalizeEsco('  test  ')).toBe('test');
  });

  it('handles combined diacritics + uppercase + whitespace', () => {
    expect(normalizeEsco('  Ελαιοχρωματιστής  ')).toBe('ελαιοχρωματιστης');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeEsco('')).toBe('');
  });

  it('passes plain ASCII through unchanged', () => {
    expect(normalizeEsco('plumber')).toBe('plumber');
  });
});

// ===========================================================================
// 2. queryToTokens
// ===========================================================================

describe('queryToTokens', () => {
  it('splits Greek query into normalized tokens', () => {
    expect(queryToTokens('τεχνίτης κρεάτων')).toEqual(['τεχνιτης', 'κρεατων']);
  });

  it('returns empty array for empty string', () => {
    expect(queryToTokens('')).toEqual([]);
  });

  it('filters tokens shorter than 2 characters', () => {
    expect(queryToTokens('a b cd')).toEqual(['cd']);
  });

  it('splits on various delimiters (comma, dash, slash)', () => {
    const result = queryToTokens('one,two-three/four');
    expect(result).toEqual(['one', 'two', 'three', 'four']);
  });
});
