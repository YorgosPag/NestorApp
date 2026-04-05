/**
 * @tests Entity Code Configuration — ADR-233 §3.4
 *
 * Validates the canonical building code suggestion and the building-letter
 * extraction used to generate unit codes (e.g. "A-DI-1.01").
 *
 * Covered:
 *   • suggestNextBuildingCode() — empty, sequential, gap-filling, beyond Ω
 *   • extractBuildingLetter()  — object + string signatures
 *   • buildBuildingCode() / getGreekLetterAt() — edge cases
 */

import {
  suggestNextBuildingCode,
  extractBuildingLetter,
  buildBuildingCode,
  getGreekLetterAt,
  BUILDING_CODE_PREFIX,
  GREEK_UPPERCASE_LETTERS,
} from '../entity-code-config';

// =============================================================================
// suggestNextBuildingCode()
// =============================================================================

describe('suggestNextBuildingCode()', () => {
  it('returns "Κτήριο Α" when no buildings exist', () => {
    expect(suggestNextBuildingCode([])).toBe(`${BUILDING_CODE_PREFIX} Α`);
  });

  it('returns the next sequential letter when Α is taken', () => {
    expect(suggestNextBuildingCode(['Κτήριο Α'])).toBe(`${BUILDING_CODE_PREFIX} Β`);
  });

  it('returns the next sequential letter after Α, Β', () => {
    expect(suggestNextBuildingCode(['Κτήριο Α', 'Κτήριο Β'])).toBe(`${BUILDING_CODE_PREFIX} Γ`);
  });

  it('fills the first gap (Α, Γ → Β)', () => {
    expect(suggestNextBuildingCode(['Κτήριο Α', 'Κτήριο Γ'])).toBe(`${BUILDING_CODE_PREFIX} Β`);
  });

  it('fills the first gap regardless of insertion order', () => {
    expect(suggestNextBuildingCode(['Κτήριο Γ', 'Κτήριο Α'])).toBe(`${BUILDING_CODE_PREFIX} Β`);
  });

  it('ignores null/empty entries defensively', () => {
    // Only well-formed `code` strings reach production, but the helper must
    // be resilient to stale/partial documents during migrations.
    expect(suggestNextBuildingCode(['', 'Κτήριο Α', ''])).toBe(`${BUILDING_CODE_PREFIX} Β`);
  });

  it('returns numeric suffix when all 24 Greek letters are taken', () => {
    const allTaken = GREEK_UPPERCASE_LETTERS.map(l => `${BUILDING_CODE_PREFIX} ${l}`);
    expect(suggestNextBuildingCode(allTaken)).toBe(`${BUILDING_CODE_PREFIX} 25`);
  });

  it('increments past the highest numeric suffix', () => {
    const allTaken = GREEK_UPPERCASE_LETTERS.map(l => `${BUILDING_CODE_PREFIX} ${l}`);
    expect(suggestNextBuildingCode([...allTaken, 'Κτήριο 25', 'Κτήριο 27'])).toBe(`${BUILDING_CODE_PREFIX} 28`);
  });

  it('treats trailing tokens case-insensitively', () => {
    expect(suggestNextBuildingCode(['κτήριο α'])).toBe(`${BUILDING_CODE_PREFIX} Β`);
  });
});

// =============================================================================
// extractBuildingLetter() — object signature
// =============================================================================

describe('extractBuildingLetter() — object input', () => {
  it('prefers `code` over `name`', () => {
    expect(extractBuildingLetter({ code: 'Κτήριο Β', name: 'TestBuildingOK' })).toBe('B');
  });

  it('falls back to `name` when `code` is missing', () => {
    expect(extractBuildingLetter({ name: 'Κτήριο Γ' })).toBe('G');
  });

  it('falls back to `name` when `code` is empty string', () => {
    expect(extractBuildingLetter({ code: '', name: 'Κτήριο Δ' })).toBe('D');
  });

  it('returns "?" for empty object', () => {
    expect(extractBuildingLetter({})).toBe('?');
  });

  it('returns "?" for null/undefined fields', () => {
    expect(extractBuildingLetter({ code: null, name: null })).toBe('?');
  });
});

// =============================================================================
// extractBuildingLetter() — string signature (backward compatibility)
// =============================================================================

describe('extractBuildingLetter() — string input', () => {
  it('extracts trailing Greek letter from "Κτήριο Α"', () => {
    expect(extractBuildingLetter('Κτήριο Α')).toBe('A');
  });

  it('extracts trailing Latin letter from "Building B"', () => {
    expect(extractBuildingLetter('Building B')).toBe('B');
  });

  it('extracts trailing digit from "Κτήριο 25"', () => {
    expect(extractBuildingLetter('Κτήριο 25')).toBe('25');
  });

  it('converts single Greek letter to Latin', () => {
    expect(extractBuildingLetter('Γ')).toBe('G');
  });

  it('returns single Latin letter as-is', () => {
    expect(extractBuildingLetter('A')).toBe('A');
  });

  it('returns "?" for empty string', () => {
    expect(extractBuildingLetter('')).toBe('?');
  });

  it('returns "?" for whitespace-only string', () => {
    expect(extractBuildingLetter('   ')).toBe('?');
  });

  it('falls back to first character when no trailing pattern matches', () => {
    // "TestBuildingOK" → fallback to "T" (historical regression case)
    expect(extractBuildingLetter('TestBuildingOK')).toBe('T');
  });

  it('handles Greek-only fallback ("Πολυκατοικία" → "P")', () => {
    expect(extractBuildingLetter('Πολυκατοικία')).toBe('P');
  });
});

// =============================================================================
// buildBuildingCode() / getGreekLetterAt()
// =============================================================================

describe('buildBuildingCode() / getGreekLetterAt()', () => {
  it('buildBuildingCode(0) → "Κτήριο Α"', () => {
    expect(buildBuildingCode(0)).toBe(`${BUILDING_CODE_PREFIX} Α`);
  });

  it('buildBuildingCode(23) → "Κτήριο Ω"', () => {
    expect(buildBuildingCode(23)).toBe(`${BUILDING_CODE_PREFIX} Ω`);
  });

  it('buildBuildingCode(24) → "Κτήριο 25" (numeric fallback)', () => {
    expect(buildBuildingCode(24)).toBe(`${BUILDING_CODE_PREFIX} 25`);
  });

  it('getGreekLetterAt(-1) returns "?"', () => {
    expect(getGreekLetterAt(-1)).toBe('?');
  });

  it('getGreekLetterAt covers the full 24-letter alphabet', () => {
    for (let i = 0; i < GREEK_UPPERCASE_LETTERS.length; i++) {
      expect(getGreekLetterAt(i)).toBe(GREEK_UPPERCASE_LETTERS[i]);
    }
  });
});
