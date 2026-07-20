/**
 * Round-trip contract for the slider value units (ADR-682).
 *
 * The whole point of a unit is that it is INVERTIBLE. If `parse(format(v))`
 * ever drifts from `v`, an editable field built on it silently rewrites the
 * user's setting on a bare Tab — which is precisely the class of bug this
 * suite exists to prevent.
 */

import { SLIDER_VALUE_UNITS, type SliderValueUnitId } from '../slider-value-units';

const ROUND_TRIP_SAMPLES: Record<SliderValueUnitId, readonly number[]> = {
  percent01: [0, 0.05, 0.2, 0.29, 0.6, 0.8, 0.995, 1],
  percent100: [0, 5, 33, 60, 99.5, 100],
  pixels: [0, 1, 12, 48.5, 400],
  milliseconds: [0, 50, 250, 1000, 1500, 2000],
  degrees: [0, 15, 45, 90.5, 180, 359],
  scalar: [0, 1, 2.5, -3.25, 1000],
  hourOfDay: [0, 6, 8.75, 12.5, 18.25, 23.5, 24],
};

describe('slider value units — round trip', () => {
  const unitIds = Object.keys(SLIDER_VALUE_UNITS) as SliderValueUnitId[];

  // Net: if a unit is added to the registry without samples here, fail loudly
  // instead of passing vacuously (an anchor without a subject is green forever).
  it('covers every registered unit', () => {
    expect(unitIds.sort()).toEqual(Object.keys(ROUND_TRIP_SAMPLES).sort());
    expect(unitIds.length).toBeGreaterThanOrEqual(6);
  });

  it.each(unitIds)('%s: parse(format(v)) === v', (id) => {
    const unit = SLIDER_VALUE_UNITS[id];
    for (const value of ROUND_TRIP_SAMPLES[id]) {
      expect(unit.parse(unit.format(value))).toBe(value);
    }
  });

  it.each(unitIds)('%s: parse(formatEdit(v)) === v', (id) => {
    const unit = SLIDER_VALUE_UNITS[id];
    for (const value of ROUND_TRIP_SAMPLES[id]) {
      expect(unit.parse(unit.formatEdit(value))).toBe(value);
    }
  });

  it.each(unitIds)('%s: rejects invalid input with null, never a coerced 0', (id) => {
    const unit = SLIDER_VALUE_UNITS[id];
    for (const bad of ['', '   ', 'abc', '--1', '1e5', 'Infinity', 'NaN', '12abc']) {
      expect(unit.parse(bad)).toBeNull();
    }
  });

  it.each(unitIds)('%s: accepts comma as the decimal separator', (id) => {
    const unit = SLIDER_VALUE_UNITS[id];
    expect(unit.parse('0,5')).not.toBeNull();
  });
});

describe('percent01 — the unit that broke in round 1', () => {
  const unit = SLIDER_VALUE_UNITS.percent01;

  it('formats model space as percent display', () => {
    expect(unit.format(0.6)).toBe('60%');
    expect(unit.format(0.8)).toBe('80%');
    expect(unit.formatEdit(0.6)).toBe('60');
  });

  it('parses "80", "80%" and "80 %" to 0.8 — not to a clamped 1', () => {
    expect(unit.parse('80')).toBe(0.8);
    expect(unit.parse('80%')).toBe(0.8);
    expect(unit.parse('80 %')).toBe(0.8);
    expect(unit.parse('  80%  ')).toBe(0.8);
  });

  it('parses a Greek-keyboard decimal', () => {
    expect(unit.parse('0,5')).toBe(0.005);
    expect(unit.parse('50,5%')).toBe(0.505);
  });
});

describe('percent100', () => {
  const unit = SLIDER_VALUE_UNITS.percent100;

  it('is identity apart from the symbol', () => {
    expect(unit.format(60)).toBe('60%');
    expect(unit.parse('60%')).toBe(60);
    expect(unit.parse('60')).toBe(60);
  });
});

describe('pixels and degrees', () => {
  it('accepts the symbol optionally', () => {
    expect(SLIDER_VALUE_UNITS.pixels.format(12)).toBe('12px');
    expect(SLIDER_VALUE_UNITS.pixels.parse('12')).toBe(12);
    expect(SLIDER_VALUE_UNITS.pixels.parse('12px')).toBe(12);
    expect(SLIDER_VALUE_UNITS.degrees.format(45)).toBe('45°');
    expect(SLIDER_VALUE_UNITS.degrees.parse('45')).toBe(45);
    expect(SLIDER_VALUE_UNITS.degrees.parse('45°')).toBe(45);
    expect(SLIDER_VALUE_UNITS.degrees.parse('45deg')).toBe(45);
  });
});

describe('hourOfDay', () => {
  const unit = SLIDER_VALUE_UNITS.hourOfDay;

  it('formats decimal hours as zero-padded clock time', () => {
    expect(unit.format(8.5)).toBe('08:30');
    expect(unit.format(8.75)).toBe('08:45');
    expect(unit.format(0)).toBe('00:00');
    expect(unit.format(24)).toBe('24:00');
  });

  it('carries a rounded-up minute instead of emitting an invalid ":60"', () => {
    expect(unit.format(8.999)).toBe('09:00');
  });

  it('accepts BOTH clock and decimal input', () => {
    expect(unit.parse('8:45')).toBe(8.75);
    expect(unit.parse('08:45')).toBe(8.75);
    expect(unit.parse('8.75')).toBe(8.75);
    expect(unit.parse('8,75')).toBe(8.75);
  });

  it('rejects impossible minutes', () => {
    expect(unit.parse('8:60')).toBeNull();
    expect(unit.parse('8:99')).toBeNull();
    expect(unit.parse('8:5.5')).toBeNull();
    expect(unit.parse('8:')).toBeNull();
    expect(unit.parse('8:30:00')).toBeNull();
  });
});

// =============================================================================
// ROUND 3 — separators. Previously `replace(',', '.')` ran unconditionally, so
// "1,000" parsed as 1: a SILENT collapse to the minimum on a 0..1000 range
// (GripSettings `gripObjLimit`). The user asked for the maximum and got the
// minimum with nothing on screen to say so.
// =============================================================================

describe('decimal / thousands separators', () => {
  const unit = SLIDER_VALUE_UNITS.scalar;

  it('still reads a comma as the decimal separator (Greek keyboard)', () => {
    expect(unit.parse('60,5')).toBe(60.5);
    expect(unit.parse('0,25')).toBe(0.25);
    // A leading zero rules out grouping, so three decimals stay decimals.
    expect(unit.parse('0,500')).toBe(0.5);
  });

  it('REJECTS the genuinely ambiguous single-comma grouping instead of guessing', () => {
    // "1,000" is one thousand to an en-US typist and 1.0 to a Greek one.
    // Either guess is silently wrong half the time — so it is refused, and
    // the field paints the refusal (status `rejected`).
    expect(unit.parse('1,000')).toBeNull();
    expect(unit.parse('12,345')).toBeNull();
    expect(unit.parse('999,999')).toBeNull();
  });

  it('accepts unambiguous grouping (more than one separator)', () => {
    expect(unit.parse('1,000,000')).toBe(1000000);
    expect(unit.parse('1.234,56')).toBe(1234.56);
    expect(unit.parse('1,234.56')).toBe(1234.56);
  });

  it('treats a lone dot as a decimal point, always', () => {
    expect(unit.parse('1.000')).toBe(1);
    expect(unit.parse('0.8')).toBe(0.8);
    expect(unit.parse('12.5')).toBe(12.5);
  });

  it('rejects malformed grouping rather than salvaging digits', () => {
    expect(unit.parse('1,00')).toBe(1); // 2 decimals — not grouping shape
    expect(unit.parse('1.2.3')).toBeNull();
    expect(unit.parse('1,23.456')).toBeNull();
    expect(unit.parse('1.234,56,7')).toBeNull();
  });

  it('keeps rejecting everything it rejected before', () => {
    for (const bad of ['1e5', 'Infinity', '12abc', '--1', '', '   ', 'NaN']) {
      expect(unit.parse(bad)).toBeNull();
    }
  });
});

describe('milliseconds', () => {
  const unit = SLIDER_VALUE_UNITS.milliseconds;

  it('formats with the symbol and edits without it', () => {
    expect(unit.format(250)).toBe('250ms');
    expect(unit.formatEdit(250)).toBe('250');
  });

  it('accepts the symbol optionally', () => {
    expect(unit.parse('250')).toBe(250);
    expect(unit.parse('250ms')).toBe(250);
    expect(unit.parse(' 250 ms ')).toBe(250);
  });
});
