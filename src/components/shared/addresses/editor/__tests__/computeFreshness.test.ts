/**
 * Unit tests for `computeFreshness` (ADR-332 Phase 8).
 *
 * Pure helper — uses injected `nowMs` for deterministic time arithmetic.
 */

import { computeFreshness } from '../helpers/computeFreshness';

const NOW = 1_736_000_000_000; // 2026-01-04T11:33:20Z (frozen reference)
const ONE_DAY = 24 * 60 * 60 * 1000;

describe('computeFreshness', () => {
  it('returns level "never" when verifiedAt is null', () => {
    const result = computeFreshness(null, NOW);
    expect(result).toEqual({ verifiedAt: null, level: 'never' });
  });

  it('returns level "never" when verifiedAt is undefined', () => {
    const result = computeFreshness(undefined, NOW);
    expect(result).toEqual({ verifiedAt: null, level: 'never' });
  });

  it('returns "fresh" when age < 24h', () => {
    const result = computeFreshness(NOW - 1000, NOW);
    expect(result.level).toBe('fresh');
    expect(result.verifiedAt).toBe(NOW - 1000);
    expect(result.staleReason).toBeUndefined();
  });

  it('returns "fresh" exactly at boundary − 1ms (under 1 day)', () => {
    const result = computeFreshness(NOW - (ONE_DAY - 1), NOW);
    expect(result.level).toBe('fresh');
  });

  it('returns "recent" at the 1-day boundary', () => {
    const result = computeFreshness(NOW - ONE_DAY, NOW);
    expect(result.level).toBe('recent');
  });

  it('returns "recent" for ages between 1d and 7d', () => {
    const result = computeFreshness(NOW - 3 * ONE_DAY, NOW);
    expect(result.level).toBe('recent');
  });

  it('returns "aging" at the 7-day boundary with staleReason "time-elapsed"', () => {
    const result = computeFreshness(NOW - 7 * ONE_DAY, NOW);
    expect(result.level).toBe('aging');
    expect(result.staleReason).toBe('time-elapsed');
  });

  it('returns "aging" for ages between 7d and 30d', () => {
    const result = computeFreshness(NOW - 14 * ONE_DAY, NOW);
    expect(result.level).toBe('aging');
  });

  it('returns "stale" at the 30-day boundary', () => {
    const result = computeFreshness(NOW - 30 * ONE_DAY, NOW);
    expect(result.level).toBe('stale');
    expect(result.staleReason).toBe('time-elapsed');
  });

  it('returns "stale" for very old timestamps', () => {
    const result = computeFreshness(NOW - 365 * ONE_DAY, NOW);
    expect(result.level).toBe('stale');
  });

  it('uses Date.now() when nowMs is omitted', () => {
    const realNowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      const result = computeFreshness(NOW - 5000);
      expect(result.level).toBe('fresh');
    } finally {
      realNowSpy.mockRestore();
    }
  });

  it('preserves the input verifiedAt verbatim in the output', () => {
    const ts = NOW - 12345;
    const result = computeFreshness(ts, NOW);
    expect(result.verifiedAt).toBe(ts);
  });
});
