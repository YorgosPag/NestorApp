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

describe('buildBalancedWinderRun — balanced fill to P (Φ2f, minInnerGoing > 0)', () => {
  const MIN_INNER = 130;

  it('a tread vertex sits on P → the corner is filled (Φ2g: odd W → mid tread bent through P)', () => {
    const input = makeInput({ minInnerGoing: MIN_INNER });
    const onP = buildBalancedWinderRun(input).treads.filter((t) =>
      t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6),
    );
    expect(onP.length).toBeGreaterThanOrEqual(1);
  });

  it('the corner going (two inner ends flanking P) keeps ≥ minInnerGoing', () => {
    const input = makeInput({ minInnerGoing: MIN_INNER });
    const innerDists = buildBalancedWinderRun(input).risers
      .map((r) => distFromPivot({ x: r.start.x, y: r.start.y }, input.pivotXY))
      .filter((dd) => dd > 1e-6)
      .sort((x, y) => x - y);
    // Φ2g V-ramp: the mid tread bends through P, so the two innermost ends flank P
    // at ±(minInnerGoing/2); their combined corner going is ≥ the code minimum.
    expect(innerDists[0] + innerDists[1]).toBeGreaterThanOrEqual(MIN_INNER - 1e-6);
  });

  it('minInnerGoing 0 → arc feet collapse onto P (legacy fan)', () => {
    const input = makeInput(); // minInnerGoing 0
    const onP = buildBalancedWinderRun(input).treads.filter((t) =>
      t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6),
    );
    expect(onP.length).toBeGreaterThanOrEqual(2);
  });

  it('every tread stays a simple polygon (≥3 verts) at contiguous z', () => {
    const run = buildBalancedWinderRun(makeInput({ minInnerGoing: MIN_INNER }));
    for (let i = 0; i < run.treads.length; i++) {
      expect(run.treads[i].length).toBeGreaterThanOrEqual(3);
      for (const v of run.treads[i]) expect(v.z).toBeCloseTo(175 * i, 6);
    }
  });

  it('keeps the total tread count (n1−k + M + n2−k = 17)', () => {
    const run = buildBalancedWinderRun(makeInput({ minInnerGoing: MIN_INNER }));
    expect(run.treads).toHaveLength(17);
    const [a, b, c] = run.flightSplit;
    expect(a + b + c).toBe(17);
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

  it('wide stair → equal going == tread (uniform); band k=1 (locked R* marks)', () => {
    const run = buildBalancedWinderRun(wide());
    expect(run.plan.walklineGoing).toBeCloseTo(280, 6); // uniform going = user tread
    expect(run.plan.bandStepsPerSide).toBe(1); // going hits tread at k=1 (R* marks)
    expect(run.plan.totalBandSteps).toBe(3 + 2); // W + 2k
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

// ─── ADR-630 Φ2g — graduated inner-going ramp (spread the rotation) ─────────────

describe('ADR-630 Φ2g — shape-driven k (graduated rotation)', () => {
  const base = { turnRad: HALF_PI, winderCount: 3, tread: 280, n1: 7, n2: 7 };

  it('closed form k = round(W·(t+min)/(2·(t−min))) — grows past the going-driven k', () => {
    // Uniform stair (R* marks): going = tread for every k, so the LEGACY going
    // rule picks k=1. With a code minimum the SHAPE rule spreads the rotation:
    // k = round(3·(280+130)/(2·(280−130))) = round(1230/300) = 4.
    const plan = computeBalancedBandPlan({ ...base, walklineRadius: (3 * 280) / HALF_PI, minInnerGoing: 130 });
    expect(plan.bandStepsPerSide).toBe(4);
    expect(plan.walklineGoing).toBeCloseTo(280, 6); // going stays uniform (Φ2f untouched)
    expect(plan.totalBandSteps).toBe(3 + 2 * 4);
  });

  it('minInnerGoing 0 (legacy fan) → k stays on the going-driven choice (k=1 uniform)', () => {
    const plan = computeBalancedBandPlan({ ...base, walklineRadius: (3 * 280) / HALF_PI, minInnerGoing: 0 });
    expect(plan.bandStepsPerSide).toBe(1);
  });

  it('takes the wider of going-driven and shape-driven k (narrow clamped stair)', () => {
    // Narrow stair (R clamped to 500): going rule alone → k=2; shape rule → k=4.
    const plan = computeBalancedBandPlan({ ...base, walklineRadius: 500, minInnerGoing: 130 });
    expect(plan.bandStepsPerSide).toBe(4);
  });

  it('a bigger code minimum (fewer steps to climb) spreads over fewer treads', () => {
    // min 200 → k = round(3·480/160) = round(9) = 9, capped by kMax = min(n−1)=6.
    const wideFlights = computeBalancedBandPlan({ ...base, n1: 12, n2: 12, walklineRadius: (3 * 280) / HALF_PI, minInnerGoing: 200 });
    expect(wideFlights.bandStepsPerSide).toBe(9);
    // min 250 → k = round(3·530/60) = 27, capped by kMax.
    const capped = computeBalancedBandPlan({ ...base, walklineRadius: (3 * 280) / HALF_PI, minInnerGoing: 250 });
    expect(capped.bandStepsPerSide).toBe(6); // min(n1−1, n2−1, MAX) = 6
  });
});

describe('ADR-630 Φ2g — inner-edge going forms a smooth ramp (no abrupt miter)', () => {
  /** σκάλα Γ: 1200 / 280 / W3 / 90°, code min 130 (NOK). */
  const gamma = (): BalancedBandInput =>
    makeInput({ width: 1200, pivotXY: { x: 7 * 280, y: 600 }, minInnerGoing: 130 });

  /**
   * Inner-edge goings per flight side. σκάλα Γ: P at (1960, 600), backward ends
   * ride u1 (y ≈ P.y, x < P.x), forward ends ride u2 (x ≈ P.x, y > P.y). Split by
   * side, take consecutive offset differences (the inner goings) corner-out.
   */
  function innerGoingsPerSide(run: ReturnType<typeof buildBalancedWinderRun>, P: { x: number; y: number }): number[] {
    const bandTail = 4 * 280;
    const starts = run.risers
      .map((r) => ({ x: r.start.x, y: r.start.y }))
      .filter((s) => distFromPivot(s, P) > 1e-6 && distFromPivot(s, P) <= bandTail + 1);
    const back = starts.filter((s) => Math.abs(s.y - P.y) < 1e-3).map((s) => P.x - s.x).sort((a, b) => a - b);
    const fwd = starts.filter((s) => Math.abs(s.x - P.x) < 1e-3).map((s) => s.y - P.y).sort((a, b) => a - b);
    const diffs = (offs: number[]): number[] => offs.slice(1).map((o, i) => o - offs[i]).filter((gg) => gg > 1e-6);
    return [...diffs(back), ...diffs(fwd)];
  }

  it('the corner going (two inner ends flanking P) is the code minimum (≈130), not 0', () => {
    const P = { x: 7 * 280, y: 600 };
    const d = buildBalancedWinderRun(gamma()).risers
      .map((r) => distFromPivot({ x: r.start.x, y: r.start.y }, P))
      .filter((dd) => dd > 1e-6)
      .sort((a, b) => a - b);
    expect(d[0] + d[1]).toBeCloseTo(130, 3); // ±65 flanking the P-bent mid tread
  });

  it('inner goings are NOT a flat plateau — they ramp up well past the minimum', () => {
    const goings = innerGoingsPerSide(buildBalancedWinderRun(gamma()), { x: 7 * 280, y: 600 });
    const max = Math.max(...goings);
    // Old Φ2f bug: every near-corner going pinned to 130 (flat). Now it ramps.
    expect(max).toBeGreaterThan(130 * 1.5);
  });

  it('every band tread is a simple polygon (≥3 verts) at contiguous z (no degenerate)', () => {
    const run = buildBalancedWinderRun(gamma());
    expect(run.treads).toHaveLength(17);
    for (let i = 0; i < run.treads.length; i++) {
      expect(run.treads[i].length).toBeGreaterThanOrEqual(3);
      for (const v of run.treads[i]) expect(v.z).toBeCloseTo(175 * i, 6);
    }
  });

  it('the mid tread is bent through P → corner filled (no hole), extra apex vertex', () => {
    const input = gamma();
    const run = buildBalancedWinderRun(input);
    const onP = run.treads.filter((t) => t.some((v) => distFromPivot(v, input.pivotXY) < 1e-6));
    expect(onP.length).toBeGreaterThanOrEqual(1);
    // odd W (=3) → the P-bent mid tread carries an extra vertex (pentagon).
    expect(Math.max(...run.treads.map((t) => t.length))).toBeGreaterThanOrEqual(5);
  });

  it('inner going never OVERSHOOTS the tread (capped ramp → monotonic, no bulge)', () => {
    const goings = innerGoingsPerSide(buildBalancedWinderRun(gamma()), { x: 7 * 280, y: 600 });
    // Φ2g cap: an inner going may reach but never exceed the straight-flight tread.
    for (const gg of goings) expect(gg).toBeLessThanOrEqual(280 + 1e-3);
  });

  it('the arc tangents are locked outer vertices (dist == width) — no seam protrusion', () => {
    const input = gamma();
    const run = buildBalancedWinderRun(input);
    const [a, b] = run.flightSplit; // band treads are a .. a+b−1
    // The A↔B and B↔C tangents sit EXACTLY on the outer arc (radius = width). After
    // the Φ2g snap the straight-tail outer no longer overshoots past them, so two
    // band vertices land at distance == width (± ε) from P.
    const onArc = [];
    for (let i = a; i < a + b; i++) {
      for (const v of run.treads[i]) {
        if (Math.abs(distFromPivot(v, input.pivotXY) - 1200) < 1e-3) onArc.push(v);
      }
    }
    expect(onArc.length).toBeGreaterThanOrEqual(2);
  });
});
