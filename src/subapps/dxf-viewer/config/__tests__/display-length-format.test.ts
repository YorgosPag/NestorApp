/**
 * ADR-462 — display-length formatter + display-unit store SSoT tests.
 *
 * Verifies that the canonical-mm length formatter converts to the active display
 * unit, appends/omits the unit label, follows the store selection, and that the
 * store notifies subscribers on change (and not on a no-op write).
 */

import {
  formatLengthMm,
  formatLengthForDisplay,
  formatSceneLengthForDisplay,
  formatAreaForDisplay,
  formatCoordinateForDisplay,
  currentDisplayUnitLabel,
} from '../display-length-format';
import { displayUnitState } from '../display-unit-state';
import { DEFAULT_DISPLAY_UNIT } from '../units';
import { canvasToMmScaleFor } from '../../utils/scene-units';

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

describe('formatLengthForDisplay', () => {
  it('is the canonical impl that formatLengthMm aliases', () => {
    expect(formatLengthForDisplay(9750, { unit: 'm' })).toBe(formatLengthMm(9750, { unit: 'm' }));
    expect(formatLengthForDisplay(250, { unit: 'cm' })).toBe(formatLengthMm(250, { unit: 'cm' }));
  });

  it('follows the active store selection by default', () => {
    displayUnitState.setUnit('cm');
    expect(formatLengthForDisplay(5000)).toBe(formatLengthForDisplay(5000, { unit: 'cm' }));
  });
});

describe('formatSceneLengthForDisplay (scene→mm→display SSoT bridge)', () => {
  it('mm scene units: value is already mm (identity with the mm formatter)', () => {
    expect(formatSceneLengthForDisplay(250, 'mm', { unit: 'mm' })).toBe(formatLengthForDisplay(250, { unit: 'mm' }));
  });

  it('metre scene units: 5 scene-metres → 5000 mm → "5 m"', () => {
    expect(numOf(formatSceneLengthForDisplay(5, 'm', { unit: 'm' }))).toBeCloseTo(5, 3);
  });

  it('cm scene units: 250 scene-cm → 2500 mm → 2,5 m', () => {
    expect(numOf(formatSceneLengthForDisplay(250, 'cm', { unit: 'm' }))).toBeCloseTo(2.5, 3);
  });

  it('is exactly formatLengthForDisplay(scene × canvasToMmScaleFor) — the ONE bridge', () => {
    for (const u of ['mm', 'cm', 'm', 'in', 'ft'] as const) {
      const scene = 7;
      expect(formatSceneLengthForDisplay(scene, u, { unit: 'm' }))
        .toBe(formatLengthForDisplay(scene * canvasToMmScaleFor({ sceneUnits: u }), { unit: 'm' }));
    }
  });

  it('forwards opts (withUnit:false drops the label)', () => {
    expect(labelOf(formatSceneLengthForDisplay(5, 'm', { unit: 'm', withUnit: false }))).toBe('');
  });
});

describe('formatAreaForDisplay', () => {
  it('converts mm² → the unit squared with a squared label', () => {
    // 25 m² = 25_000_000 mm²
    const m2 = formatAreaForDisplay(25_000_000, { unit: 'm' });
    expect(numOf(m2)).toBeCloseTo(25, 3);
    expect(labelOf(m2)).toBe('m²');

    // same area in cm²: 25 m² = 250_000 cm²
    const cm2 = formatAreaForDisplay(25_000_000, { unit: 'cm' });
    expect(numOf(cm2)).toBeCloseTo(250_000, 0);
    expect(labelOf(cm2)).toBe('cm²');
  });

  it('omits the squared label when withUnit:false', () => {
    expect(labelOf(formatAreaForDisplay(25_000_000, { unit: 'm', withUnit: false }))).toBe('');
  });

  it('follows the active store selection by default', () => {
    displayUnitState.setUnit('m');
    expect(formatAreaForDisplay(1_000_000)).toBe(formatAreaForDisplay(1_000_000, { unit: 'm' }));
  });
});

describe('formatCoordinateForDisplay', () => {
  it('keeps the sign (coordinates can be negative)', () => {
    const neg = formatCoordinateForDisplay(-1200, { unit: 'm' });
    expect(numOf(neg)).toBeCloseTo(-1.2, 3);
    expect(labelOf(neg)).toBe('m');

    const pos = formatCoordinateForDisplay(1200, { unit: 'm' });
    expect(numOf(pos)).toBeCloseTo(1.2, 3);
  });

  it('omits the label when withUnit:false', () => {
    expect(labelOf(formatCoordinateForDisplay(-1200, { unit: 'm', withUnit: false }))).toBe('');
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
