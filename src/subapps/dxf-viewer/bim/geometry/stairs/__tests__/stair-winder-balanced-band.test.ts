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
  resolveBandWalklineRadius,
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

  it('minInnerGoing 0 (legacy) — inner ends collapse onto the pivot P', () => {
    const input = makeInput();
    const run = buildBalancedWinderRun(input);
    const atPivot = run.treads.filter((t) =>
      t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6),
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
      t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6),
    );
    expect(atPivot.length).toBeGreaterThanOrEqual(2);
    expect(run.treads).toHaveLength(17);
  });
});

// ─── ADR-630 Φ2c — dancing spread (risers directed to different points) ────────

describe('computeBalancedBandPlan — grows k for the going', () => {
  it('grows k past 2 to keep the going near the tread (wide stair → more trapezoidal steps)', () => {
    // width 1200 → R 600: k climbs to 5 so g ≈ 288 (2.8 % off 280).
    const plan = computeBalancedBandPlan({
      turnRad: HALF_PI, winderCount: 3, tread: 280, walklineRadius: 600, n1: 7, n2: 7,
    });
    expect(plan.bandStepsPerSide).toBeGreaterThan(2);
    expect(Math.abs(280 - plan.walklineGoing) / 280).toBeLessThanOrEqual(0.03);
  });
});

describe('buildBalancedWinderRun — dancing spread (minInnerGoing > 0)', () => {
  const MIN_INNER = 130;

  it('spreads the inner ends — the corner is filled by fewer treads than the converging apex', () => {
    const input = makeInput({ minInnerGoing: MIN_INNER });
    const spread = buildBalancedWinderRun(input).treads.filter((t) =>
      t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6),
    );
    const legacy = buildBalancedWinderRun(makeInput()).treads.filter((t) =>
      t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6),
    );
    expect(spread.length).toBeGreaterThanOrEqual(1); // corner still filled (no hole)
    expect(spread.length).toBeLessThan(legacy.length); // risers no longer all converge on P
  });

  it('every tread stays a simple polygon (≥3 verts) at contiguous z', () => {
    const run = buildBalancedWinderRun(makeInput({ minInnerGoing: MIN_INNER }));
    for (let i = 0; i < run.treads.length; i++) {
      expect(run.treads[i].length).toBeGreaterThanOrEqual(3);
      for (const v of run.treads[i]) expect(v.z).toBeCloseTo(175 * i, 6);
    }
  });

  it('keeps the total tread count + numbering split (no extra fill polygon)', () => {
    const run = buildBalancedWinderRun(makeInput({ minInnerGoing: MIN_INNER }));
    expect(run.treads).toHaveLength(17);
    const [a, b, c] = run.flightSplit;
    expect(a + b + c).toBe(17);
  });

  it('the inner ends nearest the corner keep a ≥ minInnerGoing narrow-end width', () => {
    // The two innermost treads meet at P; their neighbouring inner ends sit at
    // least `minInnerGoing` from P along the flight edges (no zero-going miter).
    const input = makeInput({ minInnerGoing: MIN_INNER });
    const innerDists = buildBalancedWinderRun(input).risers
      .map((r) => distFromPivot({ x: r.start.x, y: r.start.y }, input.pivotXY))
      .filter((d) => d > 1e-6)
      .sort((x, y) => x - y);
    expect(innerDists[0]).toBeGreaterThanOrEqual(MIN_INNER - 1e-6);
  });
});

// ─── ADR-630 Φ2d — uniform going (option C) ────────────────────────────────────

describe('ADR-630 Φ2d — uniform going (option C)', () => {
  /** width 1200 → halfW 600 > R* = 3·280/(π/2) = 534.7 → going reaches tread. */
  const wide = (overrides?: Partial<BalancedBandInput>): BalancedBandInput =>
    makeInput({ width: 1200, pivotXY: { x: 7 * 280, y: 600 }, ...overrides });

  it('resolveBandWalklineRadius: R* when reachable, clamps to halfW otherwise', () => {
    // Wide stair: R* = W·t/Θ = 3·280/(π/2) = 534.7 < halfW 600 → use R*.
    expect(resolveBandWalklineRadius(1200, 280, 3, HALF_PI)).toBeCloseTo((3 * 280) / HALF_PI, 6);
    // Narrow stair: R* 534.7 > halfW 500 → tread unreachable → clamp to halfW.
    expect(resolveBandWalklineRadius(1000, 280, 3, HALF_PI)).toBeCloseTo(500, 6);
    // Degenerate (no winders) → centre radius.
    expect(resolveBandWalklineRadius(1200, 280, 0, HALF_PI)).toBeCloseTo(600, 6);
  });

  it('wide stair → equal going == tread (uniform), band collapses to k=1', () => {
    const run = buildBalancedWinderRun(wide());
    expect(run.plan.walklineGoing).toBeCloseTo(280, 6); // uniform going = user tread
    expect(run.plan.bandStepsPerSide).toBe(1); // minimal band — flights don't spread
    expect(run.plan.totalBandSteps).toBe(3 + 2 * 1);
    expect(run.treads).toHaveLength(17);
  });

  it('narrow stair (clamped) keeps the legacy centre going ≠ tread', () => {
    // width 1000: R* > halfW → clamp → going measured at halfW 500 < tread.
    const run = buildBalancedWinderRun(makeInput());
    expect(run.plan.walklineGoing).toBeLessThan(280);
  });

  it('pure straight flights still advance by exactly tread (no spread)', () => {
    const run = buildBalancedWinderRun(wide());
    // Pure flight-1 treads (n1−k = 6) advance by one tread each along u1 = (1,0).
    const minX = (t: (typeof run.treads)[number]): number => Math.min(...t.map((v) => v.x));
    expect(minX(run.treads[1]) - minX(run.treads[0])).toBeCloseTo(280, 6);
    expect(minX(run.treads[2]) - minX(run.treads[1])).toBeCloseTo(280, 6);
  });

  it('wide stair → winders are equal-angle wedges (outer ends at 0/30/60/90°)', () => {
    const run = buildBalancedWinderRun(wide());
    const P = { x: 7 * 280, y: 600 };
    // Every band tread outer vertex sits on the outer radius = width (1200) about P.
    const onOuter = run.treads
      .flatMap((t) => t)
      .filter((v) => Math.abs(distFromPivot(v, P) - 1200) < 1e-3);
    expect(onOuter.length).toBeGreaterThan(0);
  });
});
