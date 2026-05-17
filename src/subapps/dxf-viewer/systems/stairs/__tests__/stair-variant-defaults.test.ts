/**
 * ADR-358 Phase 3d — `buildDefaultVariantFor` factory tests.
 *
 * Covers all 12 discriminated kinds: TS exhaustiveness check from the
 * factory's `default` branch backs this up at compile time; the runtime
 * suite asserts each kind produces a valid variant whose `kind` matches
 * the request + step-count-derived splits are bounded.
 *
 * @see ../stair-variant-defaults.ts
 */

import { buildDefaultVariantFor } from '../stair-variant-defaults';
import type { StairKind, StairParams } from '../../../types/stair';

function makeParams(overrides?: {
  stepCount?: number;
  width?: number;
  tread?: number;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 10;
  return {
    basePoint: { x: 100, y: 200, z: 0 },
    direction: 0,
    rise: 175,
    tread: overrides?.tread ?? 280,
    nosing: 25,
    nosingSide: 'front',
    width: overrides?.width ?? 1000,
    stepCount,
    totalRise: 175 * stepCount,
    totalRun: 280 * Math.max(stepCount - 1, 0),
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant: { kind: 'straight' },
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

const ALL_KINDS: readonly StairKind[] = [
  'straight',
  'l-shape',
  'u-shape',
  'gamma',
  'spiral',
  'helical',
  'elliptical',
  'winder',
  'triangular-fan',
  'triangular-outline',
  'sketch',
  'v-shape',
];

describe('buildDefaultVariantFor — Phase 3d factory', () => {
  it('Test 1: each of 12 kinds produces a variant with matching `kind`', () => {
    const params = makeParams();
    for (const kind of ALL_KINDS) {
      const v = buildDefaultVariantFor(kind, params);
      expect(v.kind).toBe(kind);
    }
  });

  it('Test 2: l-shape / u-shape splits stepCount into 2 flights summing to N', () => {
    for (const kind of ['l-shape', 'u-shape'] as const) {
      const v = buildDefaultVariantFor(kind, makeParams({ stepCount: 10 }));
      if (v.kind !== kind) throw new Error('narrow');
      expect(v.flightSplit[0] + v.flightSplit[1]).toBe(10);
      expect(v.flightSplit[0]).toBeGreaterThanOrEqual(1);
      expect(v.flightSplit[1]).toBeGreaterThanOrEqual(1);
    }
  });

  it('Test 3: gamma splits stepCount into 3 flights summing to N', () => {
    const v = buildDefaultVariantFor('gamma', makeParams({ stepCount: 12 }));
    if (v.kind !== 'gamma') throw new Error('narrow');
    const sum = v.flightSplit[0] + v.flightSplit[1] + v.flightSplit[2];
    expect(sum).toBe(12);
    for (const f of v.flightSplit) expect(f).toBeGreaterThanOrEqual(1);
  });

  it('Test 4: v-shape splits stepCount into 2 arms summing to N', () => {
    const v = buildDefaultVariantFor('v-shape', makeParams({ stepCount: 8 }));
    if (v.kind !== 'v-shape') throw new Error('narrow');
    expect(v.armSplit[0] + v.armSplit[1]).toBe(8);
    expect(v.armAngleDeg).toBe(90);
  });

  it('Test 5: spiral seeds centerPoint = basePoint and full 360° sweep', () => {
    const v = buildDefaultVariantFor('spiral', makeParams());
    if (v.kind !== 'spiral') throw new Error('narrow');
    expect(v.centerPoint).toEqual({ x: 100, y: 200, z: 0 });
    expect(v.innerRadius).toBe(0);
    expect(v.sweepAngle).toBe(360);
    expect(v.turnDirection).toBe('cw');
  });

  it('Test 6: helical seeds outerRadius = innerRadius + width', () => {
    const v = buildDefaultVariantFor('helical', makeParams({ width: 1200 }));
    if (v.kind !== 'helical') throw new Error('narrow');
    expect(v.outerRadius - v.innerRadius).toBe(1200);
  });

  it('Test 7: triangular-outline produces 3 distinct vertices', () => {
    const v = buildDefaultVariantFor('triangular-outline', makeParams());
    if (v.kind !== 'triangular-outline') throw new Error('narrow');
    const [v0, v1, v2] = v.triangleVertices;
    expect(v0).not.toEqual(v1);
    expect(v1).not.toEqual(v2);
    expect(v0).not.toEqual(v2);
  });

  it('Test 8: sketch walklinePath has at least 2 vertices', () => {
    const v = buildDefaultVariantFor('sketch', makeParams());
    if (v.kind !== 'sketch') throw new Error('narrow');
    expect(v.walklinePath.length).toBeGreaterThanOrEqual(2);
  });

  it('Test 9: winder clamps winderCount to max(stepCount−1, 1) so geometry is buildable', () => {
    const v = buildDefaultVariantFor('winder', makeParams({ stepCount: 2 }));
    if (v.kind !== 'winder') throw new Error('narrow');
    expect(v.winderCount).toBeLessThanOrEqual(2 - 1);
    expect(v.winderCount).toBeGreaterThanOrEqual(1);
  });

  it('Test 10: factory call does not mutate the input params', () => {
    const params = makeParams();
    const before = JSON.stringify(params);
    buildDefaultVariantFor('v-shape', params);
    buildDefaultVariantFor('spiral', params);
    buildDefaultVariantFor('triangular-outline', params);
    expect(JSON.stringify(params)).toBe(before);
  });
});
