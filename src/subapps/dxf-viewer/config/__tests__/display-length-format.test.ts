/**
 * ADR-462 — display-length formatter + display-unit store SSoT tests.
 *
 * Verifies that the canonical-mm length formatter converts to the active display
 * unit, appends/omits the unit label, follows the store selection, and that the
 * store notifies subscribers on change (and not on a no-op write).
 */

import { formatLengthMm, currentDisplayUnitLabel } from '../display-length-format';
import { displayUnitState } from '../display-unit-state';
import { DEFAULT_DISPLAY_UNIT } from '../units';

afterEach(() => displayUnitState.setUnit(DEFAULT_DISPLAY_UNIT));

/** Numeric part of a formatted length, locale-separator agnostic (small values, no thousands sep). */
function numOf(formatted: string): number {
  return parseFloat(formatted.replace(/[^\d,.-]/g, '').replace(',', '.'));
}
/** Unit label suffix of a formatted length. */
function labelOf(formatted: string): string {
  return formatted.replace(/[\d,.\s-]/g, '');
}

describe('formatLengthMm', () => {
  it('converts mm → the explicit unit with a label (locale-agnostic)', () => {
    const m = formatLengthMm(9750, { unit: 'm' });
    expect(numOf(m)).toBeCloseTo(9.75, 3);
    expect(labelOf(m)).toBe('m');

    const cm = formatLengthMm(9750, { unit: 'cm' });
    expect(numOf(cm)).toBeCloseTo(975, 2);
    expect(labelOf(cm)).toBe('cm');

    const mm = formatLengthMm(250, { unit: 'mm' });
    expect(numOf(mm)).toBeCloseTo(250, 0);
    expect(labelOf(mm)).toBe('mm');
  });

  it('omits the label when withUnit:false', () => {
    expect(labelOf(formatLengthMm(9750, { unit: 'm', withUnit: false }))).toBe('');
    expect(numOf(formatLengthMm(9750, { unit: 'm', withUnit: false }))).toBeCloseTo(9.75, 3);
  });

  it('respects an explicit precision override', () => {
    expect(numOf(formatLengthMm(9750, { unit: 'm', precision: 2 }))).toBeCloseTo(9.75, 2);
  });

  it('follows the active store selection by default', () => {
    displayUnitState.setUnit('m');
    expect(formatLengthMm(9750)).toBe(formatLengthMm(9750, { unit: 'm' }));
    expect(currentDisplayUnitLabel()).toBe('m');
  });

  it('uses the absolute value (negative input reads the same)', () => {
    expect(formatLengthMm(-9750, { unit: 'm' })).toBe(formatLengthMm(9750, { unit: 'm' }));
  });
});

describe('displayUnitState', () => {
  it('notifies subscribers on change, not on a no-op write', () => {
    displayUnitState.setUnit('m');
    let hits = 0;
    const off = displayUnitState.subscribe(() => { hits += 1; });
    displayUnitState.setUnit('m'); // no-op (unchanged)
    expect(hits).toBe(0);
    displayUnitState.setUnit('cm'); // change
    expect(hits).toBe(1);
    off();
    displayUnitState.setUnit('mm'); // after unsubscribe → no hit
    expect(hits).toBe(1);
  });
});
