/**
 * ADR-654 — editable-input display formatters (config/units.ts).
 *
 * Guards το big-player rounding SSoT στο οποίο βασίζεται πλέον το `toDisp` (bridge readouts
 * line/block/image) + ο νέος `formatAngleValue` (rotation). Καθαρές συναρτήσεις, dot-separated
 * & parseable (round-trip με `parseFloat`/`fromDisplay`).
 */

import { describe, it, expect } from '@jest/globals';
import {
  formatDisplayValue,
  formatAngleValue,
  DEFAULT_ANGLE_PRECISION,
  DEFAULT_DISPLAY_UNIT,
  DEFAULT_DISPLAY_PRECISION,
  DEFAULT_AREA_PRECISION,
  DEFAULT_COORDINATE_PRECISION,
  fromDisplay,
  toDisplay,
} from '../units';

/**
 * ADR-677 Φάση 1 — the default-unit contract.
 *
 * These are not style assertions: metres is the ONE project unit, so it governs how
 * every typed number (ring length, direct-distance entry) is interpreted, not just how
 * readouts look. The precision pins exist because 2 decimals on metres would silently
 * round every value to the centimetre against a canonical-mm store (ADR-462).
 */
describe('ADR-677 — default display unit is metres, millimetre-exact', () => {
  it('defaults to metres', () => {
    expect(DEFAULT_DISPLAY_UNIT).toBe('m');
  });

  it('gives metres 3 decimals across length, area and coordinate readouts', () => {
    expect(DEFAULT_DISPLAY_PRECISION.m).toBe(3);
    expect(DEFAULT_AREA_PRECISION.m).toBe(3);
    expect(DEFAULT_COORDINATE_PRECISION.m).toBe(3);
  });

  it('round-trips a whole millimetre through the default unit without loss', () => {
    // 895 mm → 0.895 m → back to 895 mm. This is the case απόφαση #9 was chosen for.
    expect(formatDisplayValue(895, DEFAULT_DISPLAY_UNIT)).toBe('0.895');
    expect(fromDisplay(parseFloat(formatDisplayValue(895, DEFAULT_DISPLAY_UNIT)), 'm')).toBeCloseTo(895, 6);
  });

  it('round-trips typical BIM dimensions (mm → m → mm) to the millimetre', () => {
    // Opening widths (ADR-677 απόφαση #3: presets become 0,70/0,80/0,90) + a wall run.
    for (const mm of [700, 800, 900, 2500, 3000, 12_345]) {
      const shown = formatDisplayValue(mm, 'm');
      expect(fromDisplay(parseFloat(shown), 'm')).toBeCloseTo(mm, 6);
    }
  });

  it('interprets a typed "3" as 3 metres, not 3 millimetres', () => {
    // The direct-distance-entry contract (ADR-513): typed display value → mm.
    expect(fromDisplay(3, DEFAULT_DISPLAY_UNIT)).toBe(3000);
    expect(toDisplay(3000, DEFAULT_DISPLAY_UNIT).value).toBeCloseTo(3, 9);
    expect(toDisplay(3000, DEFAULT_DISPLAY_UNIT).label).toBe('m');
  });

  it('survives a mm → m → mm round-trip for every 1 mm step in a door-width band', () => {
    // Guards against a precision regression that would only bite on odd millimetres.
    for (let mm = 890; mm <= 910; mm++) {
      expect(fromDisplay(parseFloat(formatDisplayValue(mm, 'm')), 'm')).toBeCloseTo(mm, 6);
    }
  });
});

describe('formatDisplayValue — LUPREC-style per-unit rounding', () => {
  it('rounds cm to 2 decimals (no float noise)', () => {
    // 6370.83130782605 mm → 637.083… cm → "637.08"
    expect(formatDisplayValue(6370.83130782605, 'cm')).toBe('637.08');
  });

  it('rounds mm to 0 decimals (no sub-mm in construction)', () => {
    expect(formatDisplayValue(5000.4, 'mm')).toBe('5000');
  });

  it('rounds m to 3 decimals', () => {
    // 1234.5 mm → 1.2345 m → toFixed(3) = "1.234" (IEEE: 1.2345 stored as 1.23449…).
    expect(formatDisplayValue(1234.5, 'm')).toBe('1.234');
  });

  it('keeps the sign for negative coordinates', () => {
    expect(formatDisplayValue(-2527.7368402751, 'cm')).toBe('-252.77');
  });

  it('stays dot-separated & parseable (round-trips through fromDisplay)', () => {
    const s = formatDisplayValue(6370.83, 'cm');
    expect(s).not.toContain(',');
    // rounded cm → parseFloat → fromDisplay(cm) → mm within display precision (0.01cm = 0.1mm)
    expect(fromDisplay(parseFloat(s), 'cm')).toBeCloseTo(6370.83, 0);
  });
});

describe('formatAngleValue — AUPREC-style degree rounding', () => {
  it('defaults to 2 decimals', () => {
    expect(DEFAULT_ANGLE_PRECISION).toBe(2);
    expect(formatAngleValue(-0.7050491969792)).toBe('-0.71');
  });

  it('formats a whole angle with trailing zeros (CAD standard, no zero suppression)', () => {
    expect(formatAngleValue(90)).toBe('90.00');
    expect(formatAngleValue(0)).toBe('0.00');
  });

  it('snaps sub-precision magnitudes to 0 (never emits "-0.00")', () => {
    expect(formatAngleValue(-0.001)).toBe('0.00');
    expect(formatAngleValue(0.004)).toBe('0.00');
  });

  it('honours a custom precision override', () => {
    expect(formatAngleValue(45.12345, 1)).toBe('45.1');
    // toFixed(4) = "45.1234" (IEEE: 45.12345 stored as 45.12344…).
    expect(formatAngleValue(45.12345, 4)).toBe('45.1234');
  });

  it('stays dot-separated & parseable', () => {
    const s = formatAngleValue(-0.7050491969792);
    expect(s).not.toContain(',');
    expect(s).toBe('-0.71');
    expect(parseFloat(s)).toBeCloseTo(-0.71, 2);
  });
});
