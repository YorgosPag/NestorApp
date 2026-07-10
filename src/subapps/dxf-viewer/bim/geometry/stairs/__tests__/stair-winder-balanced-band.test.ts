/**
 * ADR-630 Phase 2b — balanced / dancing winder band SSoT tests.
 *
 * Covers the auto-`k` plan (equal going, widen-to-tolerance, degenerate/cap) and
 * the assembled run geometry (tread count, wedges reaching the pivot P = no hole,
 * contiguous z, footprint-preserving flight split).
 *
 * @see ../stair-winder-balanced-band.ts
 */

import {
  type BalancedBandInput,
  buildBalancedWinderRun,
  computeBalancedBandPlan,
} from '../stair-winder-balanced-band';

const HALF_PI = Math.PI / 2;

/** 90° left quarter-turn, n1=n2=7, W=3, tread 280, width 1000 (→ R 500). */
function makeInput(overrides?: Partial<BalancedBandInput>): BalancedBandInput {
  const width = 1000;
  const tread = 280;
  const n1 = 7;
  const halfW = width / 2;
  const pivotXY = { x: n1 * tread, y: halfW }; // basePoint + u1·(n1·t) + v1·(+halfW)
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    u1: { x: 1, y: 0 },
    v1: { x: 0, y: 1 },
    u2: { x: 0, y: 1 },
    ray0: { x: 0, y: -1 },
    pivotXY,
    turnSign: 1,
    turnRad: HALF_PI,
    width,
    tread,
    nosing: 0,
    rise: 175,
    n1,
    n2: 7,
    winderCount: 3,
    ...overrides,
  };
}

describe('computeBalancedBandPlan', () => {
  const base = { turnRad: HALF_PI, winderCount: 3, tread: 280, walklineRadius: 500 };

  it('equal going g = (2·k·t + R·Θ)/(W+2k)', () => {
    const plan = computeBalancedBandPlan({ ...base, n1: 7, n2: 7 });
    const g = (2 * plan.bandStepsPerSide * 280 + 500 * HALF_PI) / (3 + 2 * plan.bandStepsPerSide);
    expect(plan.walklineGoing).toBeCloseTo(g, 6);
    expect(plan.totalBandSteps).toBe(3 + 2 * plan.bandStepsPerSide);
  });

  it('widens k from 1 to 2 when k=1 going is >3% off the tread (steps 6/12)', () => {
    // k=1 → 269 (3.9% off 280) → widen; k=2 → 272 (2.8%) ≤ 3%.
    const plan = computeBalancedBandPlan({ ...base, n1: 7, n2: 7 });
    expect(plan.bandStepsPerSide).toBe(2);
  });

  it('stays at k=1 when the equal going is already within tolerance', () => {
    // R·Θ ≈ 3·tread → k=1 going (2t+RΘ)/5 ≈ tread (≈1.4% off) → no widening.
    const plan = computeBalancedBandPlan({
      turnRad: HALF_PI, winderCount: 3, tread: 300, walklineRadius: 560, n1: 7, n2: 7,
    });
    expect(plan.bandStepsPerSide).toBe(1);
  });

  it('falls back to k=0 (pure fan) when the flights are too short to borrow', () => {
    const plan = computeBalancedBandPlan({ ...base, n1: 1, n2: 7 });
    expect(plan.bandStepsPerSide).toBe(0);
    expect(plan.walklineGoing).toBeCloseTo((500 * HALF_PI) / 3, 6); // R·Θ/W
    expect(plan.totalBandSteps).toBe(3);
  });

  it('degenerates safely for winderCount 0 (going = tread)', () => {
    const plan = computeBalancedBandPlan({ ...base, winderCount: 0, n1: 7, n2: 7 });
    expect(plan.walklineGoing).toBe(280);
    expect(plan.totalBandSteps).toBe(0);
  });
});

describe('buildBalancedWinderRun', () => {
  it('preserves the total tread count (n1 + W + n2)', () => {
    const run = buildBalancedWinderRun(makeInput());
    expect(run.treads).toHaveLength(7 + 3 + 7);
    const [a, b, c] = run.flightSplit;
    expect(a + b + c).toBe(17);
  });

  it('wedges reach the pivot P — several turn treads share it (no hole)', () => {
    const input = makeInput();
    const run = buildBalancedWinderRun(input);
    const atPivot = run.treads.filter((t) =>
      t.some((v) => Math.hypot(v.x - input.pivotXY.x, v.y - input.pivotXY.y) < 1e-6),
    );
    expect(atPivot.length).toBeGreaterThanOrEqual(2);
  });

  it('every tread is a simple polygon at a single contiguous elevation z = i·rise', () => {
    const run = buildBalancedWinderRun(makeInput());
    for (let i = 0; i < run.treads.length; i++) {
      const t = run.treads[i];
      expect(t.length).toBeGreaterThanOrEqual(3);
      for (const v of t) expect(v.z).toBeCloseTo(175 * i, 6);
    }
  });

  it('mirrors for a clockwise (right) turn — still reaches the pivot', () => {
    const input = makeInput({
      turnSign: -1, turnRad: -HALF_PI, u2: { x: 0, y: -1 }, ray0: { x: 0, y: 1 },
      pivotXY: { x: 7 * 280, y: -500 }, // basePoint + u1·(n1·t) + v1·(−halfW)
    });
    const run = buildBalancedWinderRun(input);
    const atPivot = run.treads.filter((t) =>
      t.some((v) => Math.hypot(v.x - input.pivotXY.x, v.y - input.pivotXY.y) < 1e-6),
    );
    expect(atPivot.length).toBeGreaterThanOrEqual(2);
    expect(run.treads).toHaveLength(17);
  });
});
