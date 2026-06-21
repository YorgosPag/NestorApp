/**
 * Unit tests — polar-utils.ts (ADR-357 Phase 1)
 * Tests applyPolar pure function: increment snapping, additional angles, no-snap passthrough.
 */

import { applyPolar, formatPolarLabel, faceRelativeDisplayAngle } from '../polar-utils';
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

describe('applyPolar — relative-polar baseAngle (ADR-508)', () => {
  const cfg15: PolarTrackingConfig = { incrementAngle: 15, additionalAngles: [], angleTolerance: 3 };
  const BASE = 30; // a "face" oriented 30° off world east

  const pointAt = (deg: number, dist = 100, ref = REF) => {
    const rad = (deg * Math.PI) / 180;
    return { x: ref.x + dist * Math.cos(rad), y: ref.y + dist * Math.sin(rad) };
  };

  it('baseAngle = 0 is identical to world polar (backward-compat lock)', () => {
    const pt = pointAt(89);
    const world = applyPolar(pt, REF, cfg90);
    const explicitZero = applyPolar(pt, REF, { ...cfg90, baseAngle: 0 });
    expect(explicitZero.isSnapped).toBe(world.isSnapped);
    expect(explicitZero.snappedAngle).toBe(world.snappedAngle);
    expect(explicitZero.point.x).toBeCloseTo(world.point.x);
    expect(explicitZero.point.y).toBeCloseTo(world.point.y);
  });

  it('snaps to the base direction itself (0° relative) when cursor is near it', () => {
    const result = applyPolar(pointAt(BASE + 1), REF, { ...cfg15, baseAngle: BASE });
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(BASE); // world-absolute = base + 0
  });

  it('snaps perpendicular to the face (90° relative = base+90) — the flush case', () => {
    const result = applyPolar(pointAt(BASE + 90 + 1), REF, { ...cfg15, baseAngle: BASE });
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(BASE + 90); // 120° world
  });

  it('snaps to base + 45 relative (multiple of the 15° increment)', () => {
    const result = applyPolar(pointAt(BASE + 45 + 2), REF, { ...cfg15, baseAngle: BASE });
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(BASE + 45); // 75° world
  });

  it('does NOT snap when the cursor is between relative increments (outside tolerance)', () => {
    // base+7° is 7° from base (0 rel) and 8° from base+15 (15 rel) — both > 3° tol.
    const result = applyPolar(pointAt(BASE + 7), REF, { ...cfg15, baseAngle: BASE });
    expect(result.isSnapped).toBe(false);
    expect(result.snappedAngle).toBeNull();
  });

  it('offsets additionalAngles by baseAngle too', () => {
    const cfgAdd: PolarTrackingConfig = { incrementAngle: 90, additionalAngles: [33], angleTolerance: 3 };
    // 33° relative to base ⇒ world base+33 = 63°. Cursor 1° off → snaps.
    const result = applyPolar(pointAt(BASE + 33 + 1), REF, { ...cfgAdd, baseAngle: BASE });
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBe(BASE + 33); // 63° world
  });

  it('preserves distance under relative snapping', () => {
    const dist = 137;
    const result = applyPolar(pointAt(BASE + 1, dist), REF, { ...cfg15, baseAngle: BASE });
    const snapDist = Math.hypot(result.point.x, result.point.y);
    expect(snapDist).toBeCloseTo(dist, 3);
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

describe('faceRelativeDisplayAngle (ADR-508 — relative-polar-to-face tooltip)', () => {
  // perpBase = the perpendicular-to-face world direction used for snapping.
  it('perpendicular to face ⇒ 90° (the flush case, regardless of world heading)', () => {
    expect(faceRelativeDisplayAngle(41.9, 41.9)).toBeCloseTo(90); // wall along perp base
    expect(faceRelativeDisplayAngle(90, 90)).toBeCloseTo(90);
    expect(faceRelativeDisplayAngle(0, 0)).toBeCloseTo(90);
  });
  it('parallel to face ⇒ 0°', () => {
    // 90° off the perpendicular base = along the face surface.
    expect(faceRelativeDisplayAngle(131.9, 41.9)).toBeCloseTo(0);
    expect(faceRelativeDisplayAngle(41.9 - 90, 41.9)).toBeCloseTo(0);
  });
  it('45° off the face reads 45° either side', () => {
    expect(faceRelativeDisplayAngle(41.9 + 45, 41.9)).toBeCloseTo(45);
    expect(faceRelativeDisplayAngle(41.9 - 45, 41.9)).toBeCloseTo(45);
  });
  it('30° / 15° off the face read 30° / 15°', () => {
    expect(faceRelativeDisplayAngle(41.9 + 60, 41.9)).toBeCloseTo(30); // 60° off perp = 30° off face
    expect(faceRelativeDisplayAngle(41.9 + 75, 41.9)).toBeCloseTo(15);
  });
  it('always returns a value within [0, 90]', () => {
    for (let a = 0; a < 360; a += 7) {
      const v = faceRelativeDisplayAngle(a, 41.9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(90);
    }
  });
});
