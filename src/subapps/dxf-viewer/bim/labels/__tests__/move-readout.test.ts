/**
 * ADR-363 — move-readout SSoT tests.
 *
 * Verifies the live move-distance readout helpers: the formatter delegates to the
 * locale distance SSoT (no hardcoded unit), the scene-unit→metre conversion matches
 * the scene-units table, and the midpoint helper returns the true midpoint.
 */

import { formatMoveDistance, sceneDistanceToMeters, moveReadoutMid } from '../move-readout';
import { formatDistanceLocale } from '../../../rendering/entities/shared/distance-label-utils';

describe('formatMoveDistance', () => {
  it('delegates to the locale distance formatter (2 dp, no hardcoded unit)', () => {
    expect(formatMoveDistance(1.5)).toBe(formatDistanceLocale(1.5, 2));
    expect(formatMoveDistance(0)).toBe(formatDistanceLocale(0, 2));
  });

  it('uses the absolute value (a negative displacement reads the same)', () => {
    expect(formatMoveDistance(-2.34)).toBe(formatMoveDistance(2.34));
  });

  it('never embeds a unit token (N.11-safe — separator/digits only)', () => {
    expect(formatMoveDistance(1.23)).not.toMatch(/[a-zα-ω]/i);
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

describe('moveReadoutMid', () => {
  it('returns the midpoint of two points', () => {
    expect(moveReadoutMid({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });

  it('handles negative coordinates', () => {
    expect(moveReadoutMid({ x: -4, y: 6 }, { x: 4, y: -6 })).toEqual({ x: 0, y: 0 });
  });
});
