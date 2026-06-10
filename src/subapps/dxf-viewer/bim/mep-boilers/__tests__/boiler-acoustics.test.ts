/**
 * ADR-408 Εύρος Β #2 — Boiler sound power level (L_WA) SSoT unit tests.
 *
 * Pins the pure `resolveAcousticBand`: the placement-suitability band (quiet ≤45,
 * standard ≤55, loud >55 dB(A)) — a guidance heuristic, NOT a legal limit. Absent or
 * non-positive figures resolve to `null` (a boiler is never genuinely silent).
 */

import {
  ACOUSTIC_QUIET_MAX_DBA,
  ACOUSTIC_STANDARD_MAX_DBA,
  resolveAcousticBand,
} from '../boiler-acoustics';

describe('acoustic thresholds', () => {
  it('exposes the guidance band ceilings', () => {
    expect(ACOUSTIC_QUIET_MAX_DBA).toBe(45);
    expect(ACOUSTIC_STANDARD_MAX_DBA).toBe(55);
  });
});

describe('resolveAcousticBand — quiet (≤45 dB(A))', () => {
  it('a quiet wall-hung figure is quiet', () => {
    expect(resolveAcousticBand(40)).toBe('quiet');
  });
  it('exactly at the quiet ceiling is quiet (≤ inclusive)', () => {
    expect(resolveAcousticBand(45)).toBe('quiet');
  });
});

describe('resolveAcousticBand — standard (≤55 dB(A))', () => {
  it('just above the quiet ceiling is standard', () => {
    expect(resolveAcousticBand(46)).toBe('standard');
  });
  it('a typical mid figure is standard', () => {
    expect(resolveAcousticBand(50)).toBe('standard');
  });
  it('exactly at the standard ceiling is standard (≤ inclusive)', () => {
    expect(resolveAcousticBand(55)).toBe('standard');
  });
});

describe('resolveAcousticBand — loud (>55 dB(A))', () => {
  it('just above the standard ceiling is loud', () => {
    expect(resolveAcousticBand(56)).toBe('loud');
  });
  it('a floor-standing oil figure is loud', () => {
    expect(resolveAcousticBand(60)).toBe('loud');
  });
});

describe('resolveAcousticBand — edges', () => {
  it('absent value → null', () => {
    expect(resolveAcousticBand(undefined)).toBeNull();
  });
  it('zero → null (a boiler is never silent)', () => {
    expect(resolveAcousticBand(0)).toBeNull();
  });
  it('a negative figure is invalid → null', () => {
    expect(resolveAcousticBand(-5)).toBeNull();
  });
});
