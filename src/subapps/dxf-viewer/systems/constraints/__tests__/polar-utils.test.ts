/**
 * Unit tests — polar-utils.ts (ADR-357 Phase 1)
 * Tests applyPolar pure function: increment snapping, additional angles, no-snap passthrough.
 */

import { applyPolar, formatPolarLabel } from '../polar-utils';
import type { PolarTrackingConfig } from '../polar-utils';

const REF = { x: 0, y: 0 };

const cfg90: PolarTrackingConfig = {
  incrementAngle: 90,
  additionalAngles: [],
  angleTolerance: 3,
};

describe('applyPolar — increment snapping', () => {
  it('snaps to 0° when cursor is exactly east', () => {
    const result = applyPolar({ x: 100, y: 0 }, REF, cfg90);
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(0);
    expect(result.point.x).toBeCloseTo(100);
    expect(result.point.y).toBeCloseTo(0);
  });

  it('snaps to 90° when cursor is exactly north', () => {
    const result = applyPolar({ x: 0, y: 100 }, REF, cfg90);
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(90);
    expect(result.point.x).toBeCloseTo(0);
    expect(result.point.y).toBeCloseTo(100);
  });

  it('snaps to 90° when cursor is within tolerance of north (89°)', () => {
    const rad = (89 * Math.PI) / 180;
    const point = { x: 100 * Math.cos(rad), y: 100 * Math.sin(rad) };
    const result = applyPolar(point, REF, cfg90);
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(90);
  });

  it('does NOT snap when cursor is mid-angle (45°, not within 3° of a 90 multiple)', () => {
    const rad = (45 * Math.PI) / 180;
    const point = { x: 100 * Math.cos(rad), y: 100 * Math.sin(rad) };
    const result = applyPolar(point, REF, cfg90);
    expect(result.isSnapped).toBe(false);
    expect(result.snappedAngle).toBeNull();
  });

  it('preserves distance after snapping', () => {
    const point = { x: 99, y: 5 }; // ~1° off east, within 3° tolerance
    const result = applyPolar(point, REF, cfg90);
    expect(result.isSnapped).toBe(true);
    const origDist = Math.sqrt(99 * 99 + 5 * 5);
    const snapDist = Math.sqrt(result.point.x ** 2 + result.point.y ** 2);
    expect(snapDist).toBeCloseTo(origDist, 3);
  });

  it('returns original point when distance is ~0', () => {
    const result = applyPolar({ x: 0, y: 0 }, REF, cfg90);
    expect(result.isSnapped).toBe(false);
    expect(result.distance).toBe(0);
  });

  it('handles 45° increment correctly', () => {
    const cfg45: PolarTrackingConfig = { incrementAngle: 45, additionalAngles: [], angleTolerance: 3 };
    const rad = (46 * Math.PI) / 180;
    const point = { x: 100 * Math.cos(rad), y: 100 * Math.sin(rad) };
    const result = applyPolar(point, REF, cfg45);
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(45);
  });

  it('works with non-origin ref point', () => {
    const ref = { x: 50, y: 50 };
    const point = { x: 150, y: 51 }; // ~1° off east from ref
    const result = applyPolar(point, ref, cfg90);
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(0);
    expect(result.point.y).toBeCloseTo(50); // snapped to horizontal
  });
});

describe('applyPolar — additional angles', () => {
  const cfgAdditional: PolarTrackingConfig = {
    incrementAngle: 90,
    additionalAngles: [33, 67],
    angleTolerance: 3,
  };

  it('snaps to additional angle 33° when cursor is within tolerance', () => {
    const rad = (34 * Math.PI) / 180;
    const point = { x: 100 * Math.cos(rad), y: 100 * Math.sin(rad) };
    const result = applyPolar(point, REF, cfgAdditional);
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(33);
  });

  it('increment wins over additional when both match (increment checked first)', () => {
    // 90° is both increment (90) and could be additional if added — increment takes priority
    const result = applyPolar({ x: 0, y: 100 }, REF, { ...cfgAdditional, additionalAngles: [90] });
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(90); // from increment
  });

  it('does not snap additional angle outside tolerance', () => {
    const rad = (40 * Math.PI) / 180; // 7° away from 33°
    const point = { x: 100 * Math.cos(rad), y: 100 * Math.sin(rad) };
    const result = applyPolar(point, REF, cfgAdditional);
    expect(result.isSnapped).toBe(false);
  });
});

describe('formatPolarLabel', () => {
  it('formats angle and distance with 1 decimal', () => {
    expect(formatPolarLabel(45, 125.333)).toBe('45.0° / 125.3');
  });

  it('shows 0.0 for zero distance', () => {
    expect(formatPolarLabel(90, 0)).toBe('90.0° / 0.0');
  });
});
