/**
 * ADR-408 Φ14 #2 — slope (κλίση) as a derived + invertible projection of the
 * per-endpoint z SSoT. Pins the sign convention (positive = downhill toward end),
 * the start-anchored inverse, the apply→derive round-trip, and the vertical/zero
 * plan-run guards (no NaN/Infinity, no z corruption).
 */

import {
  derivePlanLengthMm,
  deriveSlopePercent,
  applySlopePercentToEndpoints,
  resolveSegmentEndpointElevationsMm,
  MIN_PLAN_LENGTH_FOR_SLOPE_MM,
} from '../mep-segment-types';
import type { MepSegmentParams } from '../mep-segment-types';

// 'mm' scene ⇒ 1 canvas unit = 1 mm. A=(0,0)→B=(1000,0) ⇒ plan run 1000 mm.
function pipe(startZ = 2800, endZ = 2800, end = { x: 1000, y: 0 }): MepSegmentParams {
  return {
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: 0, y: 0, z: startZ },
    endPoint: { x: end.x, y: end.y, z: endZ },
    centerlineElevationMm: (startZ + endZ) / 2,
    diameter: 110,
    sceneUnits: 'mm',
  };
}

describe('derivePlanLengthMm', () => {
  it('returns the 2D plan run in mm (ignores z)', () => {
    expect(derivePlanLengthMm(pipe(2800, 2785))).toBeCloseTo(1000, 6);
  });

  it('is z-independent — a steep run has the same plan length', () => {
    expect(derivePlanLengthMm(pipe(0, 5000))).toBeCloseTo(1000, 6);
  });

  it('a vertical-in-plan (zero XY) run → 0', () => {
    expect(derivePlanLengthMm(pipe(0, 3000, { x: 0, y: 0 }))).toBe(0);
  });
});

describe('deriveSlopePercent', () => {
  it('positive = downhill toward end (start higher)', () => {
    expect(deriveSlopePercent(2800, 2785, 1000)).toBeCloseTo(1.5, 6);
  });

  it('negative = uphill toward end (start lower)', () => {
    expect(deriveSlopePercent(2785, 2800, 1000)).toBeCloseTo(-1.5, 6);
  });

  it('flat run → 0', () => {
    expect(deriveSlopePercent(2800, 2800, 1000)).toBe(0);
  });

  it('zero / sub-epsilon plan run → 0 (no divide-by-zero, no Infinity)', () => {
    const v = deriveSlopePercent(0, 3000, 0);
    expect(v).toBe(0);
    expect(Number.isFinite(v)).toBe(true);
    expect(deriveSlopePercent(0, 3000, MIN_PLAN_LENGTH_FOR_SLOPE_MM)).toBe(0);
  });
});

describe('applySlopePercentToEndpoints', () => {
  it('anchors start, drops end by planLen·%/100', () => {
    const out = applySlopePercentToEndpoints(pipe(2800, 2800), 1.5);
    expect(out.startPoint.z).toBe(2800);
    expect(out.endPoint.z).toBeCloseTo(2785, 6);
    expect(out.centerlineElevationMm).toBeCloseTo(2792.5, 6);
  });

  it('round-trips: apply(slope) then derive returns the same slope', () => {
    for (const slope of [0, 1, 1.5, 2, 3, -2]) {
      const out = applySlopePercentToEndpoints(pipe(2800, 2800), slope);
      const e = resolveSegmentEndpointElevationsMm(out);
      expect(deriveSlopePercent(e.startMm, e.endMm, derivePlanLengthMm(out))).toBeCloseTo(slope, 6);
    }
  });

  it('preserves plan x/y (only z moves)', () => {
    const out = applySlopePercentToEndpoints(pipe(2800, 2800), 2);
    expect(out.startPoint.x).toBe(0);
    expect(out.endPoint.x).toBe(1000);
    expect(out.endPoint.y).toBe(0);
  });

  it('vertical / zero plan run → no-op (never corrupts z)', () => {
    const riser = pipe(0, 3000, { x: 0, y: 0 });
    const out = applySlopePercentToEndpoints(riser, 1.5);
    expect(out).toBe(riser); // unchanged reference — pure no-op
  });
});
