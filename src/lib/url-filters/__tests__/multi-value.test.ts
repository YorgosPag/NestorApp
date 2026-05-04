/**
 * Tests for ADR-331 Phase C URL filter helpers.
 * parseFilterArray, serializeFilterArray, parseDateOrDefault.
 */

import {
  parseFilterArray,
  serializeFilterArray,
  parseDateOrDefault,
} from '@/lib/url-filters/multi-value';

// ============================================================================
// parseFilterArray
// ============================================================================

describe('parseFilterArray', () => {
  it('returns empty array for null', () => {
    expect(parseFilterArray(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseFilterArray(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseFilterArray('')).toEqual([]);
  });

  it('parses comma-separated values', () => {
    expect(parseFilterArray('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace from each value', () => {
    expect(parseFilterArray(' a , b ')).toEqual(['a', 'b']);
  });

  it('filters out empty entries after split', () => {
    expect(parseFilterArray('a,,b')).toEqual(['a', 'b']);
  });

  it('parses single value without comma', () => {
    expect(parseFilterArray('OIK-1')).toEqual(['OIK-1']);
  });
});

// ============================================================================
// serializeFilterArray
// ============================================================================

describe('serializeFilterArray', () => {
  it('returns undefined for empty array', () => {
    expect(serializeFilterArray([])).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(serializeFilterArray(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(serializeFilterArray(undefined)).toBeUndefined();
  });

  it('joins values with comma', () => {
    expect(serializeFilterArray(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('trims values before joining', () => {
    expect(serializeFilterArray([' a ', ' b '])).toBe('a,b');
  });

  it('returns undefined when all values are blank after trim', () => {
    expect(serializeFilterArray(['', '  '])).toBeUndefined();
  });

  it('serializes a single value without trailing comma', () => {
    expect(serializeFilterArray(['OIK-1'])).toBe('OIK-1');
  });
});

// ============================================================================
// parseDateOrDefault
// ============================================================================

describe('parseDateOrDefault', () => {
  it('returns valid YYYY-MM-DD param as-is', () => {
    expect(parseDateOrDefault('2026-01-15', '2026-01-01')).toBe('2026-01-15');
  });

  it('returns fallback for null', () => {
    expect(parseDateOrDefault(null, '2026-01-01')).toBe('2026-01-01');
  });

  it('returns fallback for undefined', () => {
    expect(parseDateOrDefault(undefined, '2026-01-01')).toBe('2026-01-01');
  });

  it('returns fallback for empty string', () => {
    expect(parseDateOrDefault('', '2026-01-01')).toBe('2026-01-01');
  });

  it('returns fallback for slash-separated format', () => {
    expect(parseDateOrDefault('2026/01/15', '2026-01-01')).toBe('2026-01-01');
  });

  it('returns fallback for non-date string', () => {
    expect(parseDateOrDefault('not-a-date', '2026-01-01')).toBe('2026-01-01');
  });

  it('accepts calendar-invalid date (no strict calendar check)', () => {
    expect(parseDateOrDefault('2026-02-30', '2026-01-01')).toBe('2026-02-30');
  });
});
