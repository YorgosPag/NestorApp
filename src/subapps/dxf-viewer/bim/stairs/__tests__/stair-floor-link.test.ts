/**
 * ADR-358 Phase 9B-2 — stair-floor-link unit tests.
 *
 * Coverage targets: pure reconciliation in mm / cm / m scenes, idempotency,
 * no-op when unlinked, hard-bound stepCount derivation, inverse helpers
 * (`deriveRiseFromStepCount`, `maxStepCountFor`, `minStepCountFor`).
 *
 * @see ../stair-floor-link.ts
 */

import {
  deriveRiseFromStepCount,
  maxStepCountFor,
  minStepCountFor,
  mmFactorFromWidth,
  reconcileLinkedStair,
} from '../stair-floor-link';
import type { StairParams, StairVariantStraight } from '../../../bim/types/stair-types';

const STRAIGHT: StairVariantStraight = { kind: 'straight' };

interface BuildOpts {
  readonly rise?: number;
  readonly tread?: number;
  readonly width?: number;
  readonly stepCount?: number;
  readonly storyHeightMm?: number;
  readonly storyCount?: number;
  readonly linked?: boolean | 'absent';
}

function buildParams(opts: BuildOpts = {}): StairParams {
  const rise = opts.rise ?? 175;
  const tread = opts.tread ?? 280;
  const width = opts.width ?? 1200;
  const stepCount = opts.stepCount ?? 12;
  const linked = opts.linked ?? true;
  const storyHeight = opts.storyHeightMm ?? 3000;
  const storyCount = opts.storyCount ?? 1;
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread,
    nosing: 20,
    nosingSide: 'front',
    width,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: tread * Math.max(0, stepCount - 1),
    pitch: (Math.atan2(rise, tread) * 180) / Math.PI,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant: STRAIGHT,
    walklineOffset: 600,
    handrails: { inner: true, outer: true, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'all',
    treadLabelRestartPerFlight: false,
    codeProfile: 'nok',
    ...(linked === 'absent'
      ? {}
      : {
          multiStoryConfig: {
            topLevel: 'floor_test',
            storyHeight,
            storyCount,
            linkedToFloor: linked === true,
          },
        }),
  };
}

describe('mmFactorFromWidth', () => {
  test('mm scene (width 1200) → factor 1', () => {
    expect(mmFactorFromWidth(1200)).toBe(1);
  });

  test('cm scene (width 90, < 100) → factor 10', () => {
    expect(mmFactorFromWidth(90)).toBe(10);
  });

  test('m scene (width 1.2) → factor 1000', () => {
    expect(mmFactorFromWidth(1.2)).toBe(1000);
  });

  test('NaN / non-positive width falls back to 1', () => {
    expect(mmFactorFromWidth(Number.NaN)).toBe(1);
    expect(mmFactorFromWidth(0)).toBe(1);
    expect(mmFactorFromWidth(-5)).toBe(1);
  });
});

describe('maxStepCountFor', () => {
  test('NOK 3000mm × 1 → floor(3000 / 130) = 23', () => {
    expect(maxStepCountFor(3000, 1, 'nok')).toBe(23);
  });

  test('IBC 3000mm × 1 → floor(3000 / 102) = 29', () => {
    expect(maxStepCountFor(3000, 1, 'ibc')).toBe(29);
  });

  test('atrium NOK 3000mm × 2 → floor(6000 / 130) = 46', () => {
    expect(maxStepCountFor(3000, 2, 'nok')).toBe(46);
  });

  test('non-positive story → falls back to 2', () => {
    expect(maxStepCountFor(0, 1, 'nok')).toBe(2);
    expect(maxStepCountFor(-100, 1, 'nok')).toBe(2);
  });
});

describe('minStepCountFor', () => {
  test('NOK 3000mm × 1 → ceil(3000 / 180) = 17', () => {
    expect(minStepCountFor(3000, 1, 'nok')).toBe(17);
  });

  test('Eurocode 3000mm × 1 → ceil(3000 / 200) = 15', () => {
    expect(minStepCountFor(3000, 1, 'eurocode')).toBe(15);
  });
});

describe('deriveRiseFromStepCount', () => {
  test('17 steps × 3000mm story in mm scene → 176.47mm rise (≈)', () => {
    const rise = deriveRiseFromStepCount(17, 3000, 1, 1);
    expect(rise).toBeCloseTo(3000 / 17, 5);
  });

  test('17 steps × 3000mm story in m scene → 0.17647m rise', () => {
    const rise = deriveRiseFromStepCount(17, 3000, 1, 1000);
    expect(rise).toBeCloseTo(3000 / 17 / 1000, 5);
  });

  test('zero stepCount safely clamped to 2', () => {
    const rise = deriveRiseFromStepCount(0, 3000, 1, 1);
    expect(rise).toBeCloseTo(3000 / 2, 5);
  });

  test('zero story → 0 rise', () => {
    expect(deriveRiseFromStepCount(10, 0, 1, 1)).toBe(0);
  });
});

describe('reconcileLinkedStair — no-op cases', () => {
  test('multiStoryConfig absent → returns same reference', () => {
    const p = buildParams({ linked: 'absent' });
    expect(reconcileLinkedStair(p)).toBe(p);
  });

  test('linkedToFloor !== true → returns same reference', () => {
    const p = buildParams({ linked: false });
    expect(reconcileLinkedStair(p)).toBe(p);
  });

  test('zero storyHeight → returns same reference', () => {
    const p = buildParams({ storyHeightMm: 0 });
    expect(reconcileLinkedStair(p)).toBe(p);
  });

  test('zero rise → returns same reference (guard)', () => {
    const p = buildParams({ rise: 0 });
    expect(reconcileLinkedStair(p)).toBe(p);
  });
});

describe('reconcileLinkedStair — derived stepCount (mm scene)', () => {
  test('floor 3000mm × rise 175mm → stepCount = 17, totalRise locked to 3000', () => {
    const p = buildParams({ stepCount: 12, rise: 175, storyHeightMm: 3000 });
    const r = reconcileLinkedStair(p);
    expect(r.stepCount).toBe(17);
    expect(r.totalRise).toBe(3000);
    expect(r.totalRun).toBe(280 * 16);
  });

  test('floor 3000mm × rise 200mm → stepCount = 15, totalRise locked to 3000', () => {
    const p = buildParams({ rise: 200, storyHeightMm: 3000 });
    const r = reconcileLinkedStair(p);
    expect(r.stepCount).toBe(15);
    expect(r.totalRise).toBe(3000);
  });

  test('floor 2700mm × rise 150mm → stepCount = 18', () => {
    const p = buildParams({ rise: 150, storyHeightMm: 2700 });
    const r = reconcileLinkedStair(p);
    expect(r.stepCount).toBe(18);
    expect(r.totalRise).toBe(2700);
  });

  test('atrium floor 3000mm × 2 (6000mm) → stepCount = 34 with rise 175', () => {
    const p = buildParams({ rise: 175, storyHeightMm: 3000, storyCount: 2 });
    const r = reconcileLinkedStair(p);
    expect(r.stepCount).toBe(34);
    expect(r.totalRise).toBe(6000);
  });
});

describe('reconcileLinkedStair — scene-unit conversion', () => {
  test('m scene: rise 0.175 (m) + width 1.2 (m) + floor 3000mm → stepCount 17, totalRise 3 (m)', () => {
    const p = buildParams({
      rise: 0.175,
      tread: 0.28,
      width: 1.2,
      storyHeightMm: 3000,
    });
    const r = reconcileLinkedStair(p);
    expect(r.stepCount).toBe(17);
    expect(r.totalRise).toBeCloseTo(3, 6);
    expect(r.totalRun).toBeCloseTo(0.28 * 16, 6);
  });

  test('cm scene: rise 17.5 (cm) + width 90 (cm) + floor 3000mm → stepCount 17, totalRise 300 (cm)', () => {
    // mmFactorFromWidth heuristic requires width < 100 to detect cm-scale;
    // 90 cm is a valid NOK "δευτερεύουσα" stair width.
    const p = buildParams({
      rise: 17.5,
      tread: 28,
      width: 90,
      storyHeightMm: 3000,
    });
    const r = reconcileLinkedStair(p);
    expect(r.stepCount).toBe(17);
    expect(r.totalRise).toBeCloseTo(300, 6);
  });
});

describe('reconcileLinkedStair — idempotency', () => {
  test('apply twice = apply once (same reference second time)', () => {
    const p = buildParams({ stepCount: 12, rise: 175, storyHeightMm: 3000 });
    const r1 = reconcileLinkedStair(p);
    const r2 = reconcileLinkedStair(r1);
    expect(r2).toBe(r1);
  });

  test('already-reconciled params return same reference', () => {
    // Seed → reconcile once to land on the stable shape, then ensure a
    // second reconcile returns the same instance.
    const seed = buildParams({ stepCount: 17, rise: 175, storyHeightMm: 3000 });
    const stable = reconcileLinkedStair(seed);
    expect(reconcileLinkedStair(stable)).toBe(stable);
  });
});
