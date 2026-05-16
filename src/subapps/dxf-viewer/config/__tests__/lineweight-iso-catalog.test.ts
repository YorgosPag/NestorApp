/**
 * Lineweight ISO Catalog tests — ADR-358 Phase 2B.
 *
 * Covers:
 *   - 24 ISO values present, ascending, no duplicates
 *   - Special sentinels frozen + correct values
 *   - isConcreteLineweight type guard
 *   - lineweightToPx conversion (mm × dpi / 25.4) + special → 0
 *   - parseDxfCode370 round-trip with encodeDxfCode370
 *   - parseDxfCode370 snap-to-nearest + DEFAULT fallback
 *   - isIsoBaselineLineweight
 */

import { describe, it, expect } from '@jest/globals';
import {
  LINEWEIGHT_ISO_VALUES,
  LINEWEIGHT_SPECIAL,
  LINEWEIGHT_SPECIAL_VALUES,
  isConcreteLineweight,
  lineweightToPx,
  parseDxfCode370,
  encodeDxfCode370,
  isIsoBaselineLineweight,
} from '../lineweight-iso-catalog';

describe('LINEWEIGHT_ISO_VALUES', () => {
  it('contains exactly 24 ISO baseline values', () => {
    expect(LINEWEIGHT_ISO_VALUES).toHaveLength(24);
  });

  it('is sorted ascending', () => {
    for (let i = 1; i < LINEWEIGHT_ISO_VALUES.length; i++) {
      expect(LINEWEIGHT_ISO_VALUES[i]).toBeGreaterThan(LINEWEIGHT_ISO_VALUES[i - 1]);
    }
  });

  it('contains AutoCAD canonical values', () => {
    expect(LINEWEIGHT_ISO_VALUES).toContain(0);
    expect(LINEWEIGHT_ISO_VALUES).toContain(0.25);
    expect(LINEWEIGHT_ISO_VALUES).toContain(0.5);
    expect(LINEWEIGHT_ISO_VALUES).toContain(1.0);
    expect(LINEWEIGHT_ISO_VALUES).toContain(2.11);
  });

  it('is immutable (frozen)', () => {
    expect(Object.isFrozen(LINEWEIGHT_ISO_VALUES)).toBe(true);
  });
});

describe('LINEWEIGHT_SPECIAL', () => {
  it('exposes DEFAULT=-3, BYLAYER=-2, BYBLOCK=-1', () => {
    expect(LINEWEIGHT_SPECIAL.DEFAULT).toBe(-3);
    expect(LINEWEIGHT_SPECIAL.BYLAYER).toBe(-2);
    expect(LINEWEIGHT_SPECIAL.BYBLOCK).toBe(-1);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(LINEWEIGHT_SPECIAL)).toBe(true);
  });

  it('LINEWEIGHT_SPECIAL_VALUES mirrors the trio', () => {
    expect(LINEWEIGHT_SPECIAL_VALUES).toEqual([-3, -2, -1]);
  });
});

describe('isConcreteLineweight', () => {
  it('returns true for all 24 ISO values', () => {
    for (const v of LINEWEIGHT_ISO_VALUES) {
      expect(isConcreteLineweight(v)).toBe(true);
    }
  });

  it('returns false for special sentinels', () => {
    expect(isConcreteLineweight(-3)).toBe(false);
    expect(isConcreteLineweight(-2)).toBe(false);
    expect(isConcreteLineweight(-1)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isConcreteLineweight(null)).toBe(false);
    expect(isConcreteLineweight(undefined)).toBe(false);
  });
});

describe('lineweightToPx', () => {
  it('returns 0 for special sentinels', () => {
    expect(lineweightToPx(-3)).toBe(0);
    expect(lineweightToPx(-2)).toBe(0);
    expect(lineweightToPx(-1)).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(lineweightToPx(null)).toBe(0);
    expect(lineweightToPx(undefined)).toBe(0);
  });

  it('converts 0.25mm @ 96dpi correctly (≈0.945 px)', () => {
    const px = lineweightToPx(0.25, 96);
    expect(px).toBeCloseTo((0.25 * 96) / 25.4, 6);
  });

  it('defaults to 96 dpi when omitted', () => {
    expect(lineweightToPx(1.0)).toBeCloseTo(lineweightToPx(1.0, 96), 6);
  });

  it('scales linearly with dpi', () => {
    const a = lineweightToPx(0.5, 96);
    const b = lineweightToPx(0.5, 192);
    expect(b).toBeCloseTo(a * 2, 6);
  });

  it('returns 0 for lw=0 (hairline)', () => {
    expect(lineweightToPx(0, 96)).toBe(0);
  });
});

describe('parseDxfCode370 / encodeDxfCode370', () => {
  it('passes through special sentinels unchanged', () => {
    expect(parseDxfCode370(-3)).toBe(-3);
    expect(parseDxfCode370(-2)).toBe(-2);
    expect(parseDxfCode370(-1)).toBe(-1);
  });

  it('encodes concrete mm to hundredths', () => {
    expect(encodeDxfCode370(0.25)).toBe(25);
    expect(encodeDxfCode370(1.0)).toBe(100);
    expect(encodeDxfCode370(2.11)).toBe(211);
  });

  it('encodes special sentinels unchanged', () => {
    expect(encodeDxfCode370(-3)).toBe(-3);
    expect(encodeDxfCode370(-2)).toBe(-2);
    expect(encodeDxfCode370(-1)).toBe(-1);
  });

  it('round-trips all 24 ISO values', () => {
    for (const v of LINEWEIGHT_ISO_VALUES) {
      expect(parseDxfCode370(encodeDxfCode370(v))).toBe(v);
    }
  });

  it('decodes exact integer DXF values to ISO mm', () => {
    expect(parseDxfCode370(25)).toBe(0.25);
    expect(parseDxfCode370(100)).toBe(1.0);
    expect(parseDxfCode370(211)).toBe(2.11);
  });

  it('falls back to DEFAULT (-3) for non-catalog integers (snap tolerance 0.005mm — DXF must be exact)', () => {
    expect(parseDxfCode370(26)).toBe(-3);
    expect(parseDxfCode370(24)).toBe(-3);
    expect(parseDxfCode370(9999)).toBe(-3);
    expect(parseDxfCode370(7)).toBe(-3);
  });
});

describe('isIsoBaselineLineweight', () => {
  it('accepts all 24 catalog values', () => {
    for (const v of LINEWEIGHT_ISO_VALUES) {
      expect(isIsoBaselineLineweight(v)).toBe(true);
    }
  });

  it('rejects values not in catalog', () => {
    expect(isIsoBaselineLineweight(0.123)).toBe(false);
    expect(isIsoBaselineLineweight(1.5)).toBe(false);
    expect(isIsoBaselineLineweight(-3)).toBe(false);
  });
});
