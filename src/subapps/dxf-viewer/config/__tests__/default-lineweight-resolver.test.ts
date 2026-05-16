/**
 * Default Lineweight Resolver tests — ADR-358 Phase 2B (§5.3.ter).
 *
 * Covers the 3-level cascade:
 *   1. Project setting wins when concrete.
 *   2. User preference wins when project is null/undefined/special.
 *   3. SYSTEM_DEFAULT_LINEWEIGHT (0.25mm) when both upstream are absent/special.
 *
 * Special sentinels (-3 DEFAULT / -2 ByLayer / -1 ByBlock) at any cascade level
 * are skipped (would recurse or have no semantic meaning as a "default").
 */

import { describe, it, expect } from '@jest/globals';
import {
  SYSTEM_DEFAULT_LINEWEIGHT,
  resolveDefaultLineweight,
} from '../default-lineweight-resolver';

describe('SYSTEM_DEFAULT_LINEWEIGHT', () => {
  it('is 0.25mm (AutoCAD/BricsCAD canonical default)', () => {
    expect(SYSTEM_DEFAULT_LINEWEIGHT).toBe(0.25);
  });
});

describe('resolveDefaultLineweight — cascade', () => {
  it('returns SYSTEM_DEFAULT when no input given', () => {
    expect(resolveDefaultLineweight({})).toBe(SYSTEM_DEFAULT_LINEWEIGHT);
  });

  it('returns SYSTEM_DEFAULT when both null', () => {
    expect(
      resolveDefaultLineweight({ projectSetting: null, userPreference: null }),
    ).toBe(SYSTEM_DEFAULT_LINEWEIGHT);
  });

  it('returns project setting when concrete', () => {
    expect(
      resolveDefaultLineweight({ projectSetting: 0.5, userPreference: 0.18 }),
    ).toBe(0.5);
  });

  it('returns user preference when project missing', () => {
    expect(
      resolveDefaultLineweight({ projectSetting: null, userPreference: 0.18 }),
    ).toBe(0.18);
  });

  it('returns user preference when project undefined', () => {
    expect(resolveDefaultLineweight({ userPreference: 0.7 })).toBe(0.7);
  });

  it('accepts lw=0 (hairline) as a valid concrete value', () => {
    expect(resolveDefaultLineweight({ projectSetting: 0 })).toBe(0);
    expect(resolveDefaultLineweight({ userPreference: 0 })).toBe(0);
  });
});

describe('resolveDefaultLineweight — special sentinel skip', () => {
  it('skips project -3 DEFAULT (would recurse) and falls through', () => {
    expect(
      resolveDefaultLineweight({ projectSetting: -3, userPreference: 0.5 }),
    ).toBe(0.5);
  });

  it('skips project -2 ByLayer (no semantic meaning)', () => {
    expect(
      resolveDefaultLineweight({ projectSetting: -2, userPreference: 0.6 }),
    ).toBe(0.6);
  });

  it('skips project -1 ByBlock (no semantic meaning)', () => {
    expect(
      resolveDefaultLineweight({ projectSetting: -1, userPreference: 0.7 }),
    ).toBe(0.7);
  });

  it('skips user-preference special sentinels and falls to SYSTEM', () => {
    expect(
      resolveDefaultLineweight({ projectSetting: null, userPreference: -3 }),
    ).toBe(SYSTEM_DEFAULT_LINEWEIGHT);
    expect(
      resolveDefaultLineweight({ projectSetting: null, userPreference: -2 }),
    ).toBe(SYSTEM_DEFAULT_LINEWEIGHT);
    expect(
      resolveDefaultLineweight({ projectSetting: null, userPreference: -1 }),
    ).toBe(SYSTEM_DEFAULT_LINEWEIGHT);
  });

  it('skips both special and returns SYSTEM_DEFAULT', () => {
    expect(
      resolveDefaultLineweight({ projectSetting: -3, userPreference: -2 }),
    ).toBe(SYSTEM_DEFAULT_LINEWEIGHT);
  });
});
