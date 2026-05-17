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

import {
  buildDefaultVariantFor,
  buildLShapeWindersVariant,
  splitTwoFlightsWithLanding,
  splitThreeFlightsWithLandings,
  splitTwoFlightsForWinders,
} from '../stair-variant-defaults';
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

  it('Test 2: l-shape / u-shape splits (stepCount-1) into 2 flights (γ landing consumes 1)', () => {
    for (const kind of ['l-shape', 'u-shape'] as const) {
      const v = buildDefaultVariantFor(kind, makeParams({ stepCount: 10 }));
      if (v.kind !== kind) throw new Error('narrow');
      // Convention γ: n1 + landing(1) + n2 = stepCount → n1 + n2 = stepCount - 1
      expect(v.flightSplit[0] + v.flightSplit[1]).toBe(9);
      expect(v.flightSplit[0]).toBeGreaterThanOrEqual(1);
      expect(v.flightSplit[1]).toBeGreaterThanOrEqual(1);
    }
  });

  it('Test 3: gamma splits (stepCount-2) into 3 flights (γ 2 landings consume 2)', () => {
    const v = buildDefaultVariantFor('gamma', makeParams({ stepCount: 12 }));
    if (v.kind !== 'gamma') throw new Error('narrow');
    const sum = v.flightSplit[0] + v.flightSplit[1] + v.flightSplit[2];
    expect(sum).toBe(10); // 12 - 2 landings
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

  // ADR-358 Phase 3e — split helpers (convention γ count conservation).

  it('Test 11: splitTwoFlightsWithLanding(17) === [8, 8] (split of 16)', () => {
    expect(splitTwoFlightsWithLanding(17)).toEqual([8, 8]);
  });

  it('Test 12: splitThreeFlightsWithLandings(17) sums to 15 (17 − 2 landings)', () => {
    const s = splitThreeFlightsWithLandings(17);
    expect(s[0] + s[1] + s[2]).toBe(15);
    for (const f of s) expect(f).toBeGreaterThanOrEqual(1);
  });

  it('Test 13: splitTwoFlightsWithLanding(3) === [1, 1] (edge: stepCount=3 → split of 2)', () => {
    expect(splitTwoFlightsWithLanding(3)).toEqual([1, 1]);
  });

  it('Test 14: splitTwoFlightsWithLanding(2) clamps to [1, 1] (min buildable)', () => {
    expect(splitTwoFlightsWithLanding(2)).toEqual([1, 1]);
  });

  it('Test 15: splitThreeFlightsWithLandings(4) clamps to ≥1 per flight', () => {
    const s = splitThreeFlightsWithLandings(4);
    for (const f of s) expect(f).toBeGreaterThanOrEqual(1);
  });

  it('Test 16: switching straight (stepCount=17) → l-shape preserves total surfaces = 17', () => {
    const v = buildDefaultVariantFor('l-shape', makeParams({ stepCount: 17 }));
    if (v.kind !== 'l-shape') throw new Error('narrow');
    // n1 + landing(1) + n2 = 17
    expect(v.flightSplit[0] + 1 + v.flightSplit[1]).toBe(17);
  });

  // ADR-358 Phase 3f — l-shape winders factory + split helper.

  it('Test 17: buildDefaultVariantFor("l-shape") returns cornerStyle="landing" by default', () => {
    const v = buildDefaultVariantFor('l-shape', makeParams({ stepCount: 10 }));
    if (v.kind !== 'l-shape') throw new Error('narrow');
    expect(v.cornerStyle).toBe('landing');
  });

  it('Test 18: buildLShapeWindersVariant seeds NOK defaults (winderCount=3, equal-going)', () => {
    const params = makeParams({ stepCount: 17 });
    const v = buildLShapeWindersVariant(params);
    expect(v.kind).toBe('l-shape');
    expect(v.cornerStyle).toBe('winders');
    expect(v.winderCount).toBe(3);
    expect(v.winderMethod).toBe('equal-going');
    expect(v.flightSplit[0] + v.flightSplit[1]).toBe(14); // 17 − 3 winders
    expect(v.flightSplit[0]).toBeGreaterThanOrEqual(1);
    expect(v.flightSplit[1]).toBeGreaterThanOrEqual(1);
  });

  it('Test 19: buildLShapeWindersVariant preserves turnDirection from prev l-shape', () => {
    const base = makeParams({ stepCount: 12 });
    const prev: StairParams = {
      ...base,
      variant: {
        kind: 'l-shape',
        cornerStyle: 'landing',
        turnDirection: 'left',
        landingDepth: 'auto',
        flightSplit: [5, 6],
      },
    };
    const v = buildLShapeWindersVariant(prev);
    expect(v.turnDirection).toBe('left');
  });

  it('Test 20: splitTwoFlightsForWinders(17, 3) === [7, 7]', () => {
    expect(splitTwoFlightsForWinders(17, 3)).toEqual([7, 7]);
  });

  it('Test 21: splitTwoFlightsForWinders(5, 3) === [1, 1] (edge: stepCount=5)', () => {
    expect(splitTwoFlightsForWinders(5, 3)).toEqual([1, 1]);
  });

  it('Test 22: splitTwoFlightsForWinders clamps so both flights ≥ 1', () => {
    const s = splitTwoFlightsForWinders(4, 3);
    expect(s[0]).toBeGreaterThanOrEqual(1);
    expect(s[1]).toBeGreaterThanOrEqual(1);
  });
});
