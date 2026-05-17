/**
 * ADR-358 Phase 3b — Tread numbering (G21) tests.
 *
 * Verifies the central `buildTreadLabels` SSoT used by every kind. Exercised
 * through straight + l-shape variants (the only ones that hit this helper in
 * Phase 3b apart from u-shape/gamma which have their own suites).
 *
 * @see ../stair-geometry-labels.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  StairParams,
  StairVariantStraight,
  StairVariantLShape,
  StairTreadLabelDisplay,
} from '../../../types/stair';

function makeStraight(overrides: {
  treadLabelDisplay?: StairTreadLabelDisplay;
  treadLabelEveryN?: number;
  treadLabelRestartPerFlight?: boolean;
  treadNumberStart?: number;
}): StairParams {
  const variant: StairVariantStraight = { kind: 'straight' };
  return basicParams(variant, 10, overrides);
}

function makeLShape(overrides: {
  treadLabelDisplay?: StairTreadLabelDisplay;
  treadLabelEveryN?: number;
  treadLabelRestartPerFlight?: boolean;
  treadNumberStart?: number;
  flightSplit?: readonly [number, number];
}): StairParams {
  const flightSplit = overrides.flightSplit ?? ([5, 5] as const);
  const variant: StairVariantLShape = {
    kind: 'l-shape',
    cornerStyle: 'landing',
    turnDirection: 'right',
    landingDepth: 'auto',
    flightSplit,
  };
  return basicParams(variant, flightSplit[0] + flightSplit[1], overrides);
}

function basicParams(
  variant: StairParams['variant'],
  stepCount: number,
  overrides: {
    treadLabelDisplay?: StairTreadLabelDisplay;
    treadLabelEveryN?: number;
    treadLabelRestartPerFlight?: boolean;
    treadNumberStart?: number;
  },
): StairParams {
  const rise = 175;
  const tread = 280;
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread,
    nosing: 25,
    nosingSide: 'front',
    width: 1000,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: tread * Math.max(stepCount - 1, 0),
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: overrides.treadNumberStart ?? 1,
    treadLabelDisplay: overrides.treadLabelDisplay ?? 'all',
    treadLabelEveryN: overrides.treadLabelEveryN,
    treadLabelRestartPerFlight: overrides.treadLabelRestartPerFlight ?? false,
    codeProfile: 'none',
  };
}

describe('StairGeometryService — Tread labels (G21)', () => {
  it("Test 1: straight 'all' → stepCount labels, text 1..stepCount", () => {
    const g = computeStairGeometry(makeStraight({ treadLabelDisplay: 'all' }));
    expect(g.treadLabels).toHaveLength(10);
    expect(g.treadLabels!.map(l => l.text)).toEqual(
      ['1','2','3','4','5','6','7','8','9','10'],
    );
  });

  it("Test 2: straight 'none' → undefined", () => {
    const g = computeStairGeometry(makeStraight({ treadLabelDisplay: 'none' }));
    expect(g.treadLabels).toBeUndefined();
  });

  it("Test 3: straight 'nth' every=3 → labels at indices 0,3,6,9", () => {
    const g = computeStairGeometry(
      makeStraight({ treadLabelDisplay: 'nth', treadLabelEveryN: 3 }),
    );
    expect(g.treadLabels).toHaveLength(4);
    expect(g.treadLabels!.map(l => l.treadIndex)).toEqual([0, 3, 6, 9]);
    expect(g.treadLabels!.map(l => l.text)).toEqual(['1', '4', '7', '10']);
  });

  it('Test 4: l-shape continuous numbering with γ landing (flightSplit=[5,5] → 11 labels)', () => {
    const g = computeStairGeometry(
      makeLShape({ treadLabelDisplay: 'all', treadLabelRestartPerFlight: false }),
    );
    // ADR-358 Phase 3e γ: flight1(5) + landing(1) + flight2(5) = 11 labels.
    expect(g.treadLabels!.map(l => l.text)).toEqual(
      ['1','2','3','4','5','6','7','8','9','10','11'],
    );
    expect(g.treadLabels![5].kind).toBe('landing');
  });

  it('Test 5: l-shape restart per flight → 1..n1, landing=n1+1 (local), 1..n2', () => {
    const g = computeStairGeometry(
      makeLShape({ treadLabelDisplay: 'all', treadLabelRestartPerFlight: true }),
    );
    expect(g.treadLabels!.map(l => l.text)).toEqual(
      ['1','2','3','4','5','6','1','2','3','4','5'],
    );
    expect(g.treadLabels![5].kind).toBe('landing');
  });

  it('Test 6: treadNumberStart=5 → labels start at "5"', () => {
    const g = computeStairGeometry(
      makeStraight({ treadLabelDisplay: 'all', treadNumberStart: 5 }),
    );
    expect(g.treadLabels![0].text).toBe('5');
    expect(g.treadLabels![9].text).toBe('14');
  });

  it('Test 7: label position is centroid of corresponding tread polygon (xy)', () => {
    const g = computeStairGeometry(makeStraight({ treadLabelDisplay: 'all' }));
    const all = [...g.treadsBelowCut, ...g.treadsAboveCut];
    for (const label of g.treadLabels!) {
      let sx = 0;
      let sy = 0;
      for (const p of all[label.treadIndex]) {
        sx += p.x;
        sy += p.y;
      }
      const cx = sx / all[label.treadIndex].length;
      const cy = sy / all[label.treadIndex].length;
      expect(label.position.x).toBeCloseTo(cx, 6);
      expect(label.position.y).toBeCloseTo(cy, 6);
    }
  });

  it('Test 8: label z matches tread z', () => {
    const g = computeStairGeometry(makeStraight({ treadLabelDisplay: 'all' }));
    const all = [...g.treadsBelowCut, ...g.treadsAboveCut];
    for (const label of g.treadLabels!) {
      expect(label.position.z).toBeCloseTo(all[label.treadIndex][0].z, 9);
    }
  });
});
