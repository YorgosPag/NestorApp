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
    minInnerGoing: 0, // default = legacy reach-P apex; newel tests override
    ...overrides,
  };
}

/** Distance of a 2-D point from the pivot. */
function distFromPivot(v: { x: number; y: number }, pivot: { x: number; y: number }): number {
  return Math.hypot(v.x - pivot.x, v.y - pivot.y);
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

  it('minInnerGoing 0 (legacy) — wedges reach the pivot P, no newel core', () => {
    const input = makeInput();
    const run = buildBalancedWinderRun(input);
    const atPivot = run.treads.filter((t) =>
      t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6),
    );
    expect(atPivot.length).toBeGreaterThanOrEqual(2);
    expect(run.newelCore).toBeNull();
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
      t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6),
    );
    expect(atPivot.length).toBeGreaterThanOrEqual(2);
    expect(run.treads).toHaveLength(17);
  });
});

// ─── ADR-630 Φ2c — newel / min-inner boundary ─────────────────────────────────

describe('buildBalancedWinderRun — newel core (minInnerGoing > 0)', () => {
  // width 1000 → halfW 500, k=2 → g = (2·2·280 + 500·π/2)/7 ≈ 272.2.
  const G = (2 * 2 * 280 + 500 * HALF_PI) / 7;
  const MIN_INNER = 130;
  const R_IN = (MIN_INNER * 500) / G; // ≈ 238.8

  it('no tread converges to the pivot P — the acute miter is gone', () => {
    const input = makeInput({ minInnerGoing: MIN_INNER });
    const run = buildBalancedWinderRun(input);
    const atPivot = run.treads.filter((t) =>
      t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6),
    );
    expect(atPivot).toHaveLength(0);
  });

  it('emits a filled newel core polygon that contains P (no hole)', () => {
    const input = makeInput({ minInnerGoing: MIN_INNER });
    const run = buildBalancedWinderRun(input);
    expect(run.newelCore).not.toBeNull();
    const core = run.newelCore ?? [];
    expect(core.length).toBeGreaterThanOrEqual(3);
    expect(core.some((v) => distFromPivot(v, input.pivotXY) < 1e-6)).toBe(true);
  });

  it('arc risers stop on the inner circle r_in = minInnerGoing·halfW/g', () => {
    const input = makeInput({ minInnerGoing: MIN_INNER });
    const run = buildBalancedWinderRun(input);
    const core = run.newelCore ?? [];
    // The core's farthest vertices from P are the arc samples at radius r_in (the
    // two transition endpoints sit closer, on the flight edges). The resulting
    // inner-end going (r_in·g/halfW) equals the code minimum.
    const radii = core.map((v) => distFromPivot(v, input.pivotXY));
    const rIn = Math.max(...radii);
    expect(rIn).toBeCloseTo(R_IN, 3);
    expect((rIn * G) / 500).toBeCloseTo(MIN_INNER, 3);
  });

  it('preserves the tread count + numbering split (core is out-of-band)', () => {
    const run = buildBalancedWinderRun(makeInput({ minInnerGoing: MIN_INNER }));
    expect(run.treads).toHaveLength(17);
    const [a, b, c] = run.flightSplit;
    expect(a + b + c).toBe(17);
  });

  it('caps r_in just inside the walkline for an oversized minInnerGoing', () => {
    // minInnerGoing ≥ g would push r_in past halfW → clamp to 0.98·halfW.
    const run = buildBalancedWinderRun(makeInput({ minInnerGoing: 10_000 }));
    const core = run.newelCore ?? [];
    const maxR = Math.max(...core.map((v) => distFromPivot(v, { x: 7 * 280, y: 500 })));
    expect(maxR).toBeLessThanOrEqual(500 * 0.98 + 1e-6);
  });
});
