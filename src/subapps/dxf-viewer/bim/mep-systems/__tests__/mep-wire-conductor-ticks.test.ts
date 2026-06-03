/**
 * ADR-408 Φ7 — home-run conductor tick geometry (pure SSoT). Asserts: one tick
 * per conductor, hot-before-neutral-before-ground order, long-vs-short lengths,
 * monotonic march along the leg, and the degenerate guards.
 */

import { buildConductorTicks, type ConductorTick } from '../mep-wire-conductor-ticks';
import type { Point2D } from '../../../rendering/types/Types';

const tip: Point2D = { x: 0, y: 0 };
const from: Point2D = { x: 100, y: 0 };

const lenOf = (t: ConductorTick): number => Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y);
const midDistFromTip = (t: ConductorTick): number =>
  Math.hypot((t.a.x + t.b.x) / 2 - tip.x, (t.a.y + t.b.y) / 2 - tip.y);

describe('buildConductorTicks', () => {
  it('emits one tick per conductor (hot + neutral + ground)', () => {
    const ticks = buildConductorTicks(tip, from, { hot: 2, neutral: 1, ground: 1 });
    expect(ticks).toHaveLength(4);
  });

  it('orders the ticks hots → neutrals → grounds', () => {
    const ticks = buildConductorTicks(tip, from, { hot: 2, neutral: 1, ground: 1 });
    expect(ticks.map((t) => t.kind)).toEqual(['hot', 'hot', 'neutral', 'ground']);
  });

  it('draws hot slashes longer than neutral / ground slashes', () => {
    const ticks = buildConductorTicks(tip, from, { hot: 1, neutral: 1, ground: 1 });
    const hot = ticks.find((t) => t.kind === 'hot')!;
    const neutral = ticks.find((t) => t.kind === 'neutral')!;
    const ground = ticks.find((t) => t.kind === 'ground')!;
    expect(lenOf(hot)).toBeGreaterThan(lenOf(neutral));
    expect(lenOf(neutral)).toBeCloseTo(lenOf(ground), 6); // neutral & ground share the short length
  });

  it('marches the ticks monotonically along the leg from the panel end', () => {
    const ticks = buildConductorTicks(tip, from, { hot: 3, neutral: 0, ground: 0 });
    for (let i = 1; i < ticks.length; i++) {
      expect(midDistFromTip(ticks[i]!)).toBeGreaterThan(midDistFromTip(ticks[i - 1]!));
    }
  });

  it('returns [] for a degenerate (zero-length) leg', () => {
    expect(buildConductorTicks(tip, { x: 0, y: 0 }, { hot: 2, neutral: 1, ground: 1 })).toEqual([]);
  });

  it('returns [] when there are no conductors', () => {
    expect(buildConductorTicks(tip, from, { hot: 0, neutral: 0, ground: 0 })).toEqual([]);
  });
});
