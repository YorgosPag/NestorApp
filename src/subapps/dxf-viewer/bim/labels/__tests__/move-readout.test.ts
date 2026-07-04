/**
 * ADR-363 / ADR-462 — move-readout SSoT tests.
 *
 * Verifies the live move-distance readout helpers: the formatter routes through the
 * display-length SSoT (display unit + label, ADR-462) and the scene-unit→metre
 * conversion matches the scene-units table.
 */

import { formatMoveDistance, sceneDistanceToMeters, formatMoveAngle } from '../move-readout';
import { formatAngleLocale } from '../../../rendering/entities/shared/distance-label-utils';
import { formatLengthMm } from '../../../config/display-length-format';
import { displayUnitState } from '../../../config/display-unit-state';

describe('formatMoveDistance', () => {
  afterEach(() => displayUnitState.setUnit('cm')); // restore default

  it('routes the metre input through the display-length SSoT (mm-based)', () => {
    // 1.5 m → 1500 mm → formatLengthMm in the active display unit.
    expect(formatMoveDistance(1.5)).toBe(formatLengthMm(1500));
    expect(formatMoveDistance(0)).toBe(formatLengthMm(0));
  });

  it('uses the absolute value (a negative displacement reads the same)', () => {
    expect(formatMoveDistance(-2.34)).toBe(formatMoveDistance(2.34));
  });

  it('follows the selected display unit (compared to the SSoT formatter)', () => {
    displayUnitState.setUnit('m');
    expect(formatMoveDistance(9.75)).toBe(formatLengthMm(9750, { unit: 'm' }));
    displayUnitState.setUnit('cm');
    expect(formatMoveDistance(9.75)).toBe(formatLengthMm(9750, { unit: 'cm' }));
  });
});

describe('sceneDistanceToMeters', () => {
  it('converts each supported scene unit to metres', () => {
    expect(sceneDistanceToMeters(1000, 'mm')).toBeCloseTo(1, 9);
    expect(sceneDistanceToMeters(100, 'cm')).toBeCloseTo(1, 9);
    expect(sceneDistanceToMeters(5, 'm')).toBeCloseTo(5, 9);
    expect(sceneDistanceToMeters(12, 'in')).toBeCloseTo(0.3048, 6);
    expect(sceneDistanceToMeters(1, 'ft')).toBeCloseTo(0.3048, 6);
  });

  it('is zero for a zero displacement', () => {
    expect(sceneDistanceToMeters(0, 'mm')).toBe(0);
  });
});

describe('formatMoveAngle', () => {
  it('delegates to the locale angle formatter (degree symbol included)', () => {
    expect(formatMoveAngle(30)).toBe(formatAngleLocale(30));
    expect(formatMoveAngle(45)).toContain('°');
  });
});
