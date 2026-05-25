/**
 * ADR-366 Phase 9 / C.1.a — Easing presets registry tests.
 */

import {
  EASING_PRESETS,
  TURNTABLE_DEFAULTS,
  createDefaultAnimationConfig,
  getEasingFunction,
} from '../../animation/presets/animation-presets';
import { EASING_PRESET_IDS, type EasingPresetId } from '../../animation/animation-types';

describe('EASING_PRESETS registry', () => {
  it('contains exactly the 8 EasingPresetId entries', () => {
    expect(Object.keys(EASING_PRESETS).sort()).toEqual([...EASING_PRESET_IDS].sort());
  });

  it.each(EASING_PRESET_IDS)(
    '%s satisfies f(0)=0 and f(1)=1 (boundary contract)',
    (id) => {
      const fn = EASING_PRESETS[id];
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    },
  );

  it.each<[EasingPresetId, number, (v: number) => boolean]>([
    ['linear', 0.5, (v) => Math.abs(v - 0.5) < 1e-6],
    ['ease-in', 0.5, (v) => v < 0.5],
    ['ease-out', 0.5, (v) => v > 0.5],
    ['ease-in-out', 0.5, (v) => Math.abs(v - 0.5) < 1e-6],
    ['ease-in-quart', 0.5, (v) => v < 0.5],
    ['ease-out-quart', 0.5, (v) => v > 0.5],
    ['smooth-step', 0.5, (v) => Math.abs(v - 0.5) < 1e-6],
  ])('%s at t=%f has expected behavior', (id, t, predicate) => {
    expect(predicate(EASING_PRESETS[id](t))).toBe(true);
  });

  it('quartic ease-in is slower than cubic ease-in at t=0.5', () => {
    expect(EASING_PRESETS['ease-in-quart'](0.5)).toBeLessThan(
      EASING_PRESETS['ease-in'](0.5),
    );
  });

  it('elastic overshoots in mid-range', () => {
    // Elastic εμφανίζει oscillation — κάποιο point > 1 ή < 0 ενδιάμεσα ή απλά != linear.
    const elastic = EASING_PRESETS['elastic'];
    const linear = EASING_PRESETS['linear'];
    const diffs = [0.2, 0.4, 0.6, 0.8].map((t) => Math.abs(elastic(t) - linear(t)));
    const hasDivergence = diffs.some((d) => d > 0.01);
    expect(hasDivergence).toBe(true);
  });
});

describe('getEasingFunction', () => {
  it('returns linear για unknown preset id (defensive fallback)', () => {
    const fn = getEasingFunction('unknown-preset' as EasingPresetId);
    expect(fn(0)).toBe(0);
    expect(fn(0.5)).toBeCloseTo(0.5, 10);
    expect(fn(1)).toBe(1);
  });

  it('returns the registered curve για a known id', () => {
    expect(getEasingFunction('linear')).toBe(EASING_PRESETS['linear']);
    expect(getEasingFunction('elastic')).toBe(EASING_PRESETS['elastic']);
  });
});

describe('TURNTABLE_DEFAULTS', () => {
  it('matches ADR-366 §C.1.Q1 industry convergence (8s @ 30fps, Y-axis, CCW)', () => {
    expect(TURNTABLE_DEFAULTS.durationSec).toBe(8);
    expect(TURNTABLE_DEFAULTS.fps).toBe(30);
    expect(TURNTABLE_DEFAULTS.axis).toBe('y');
    expect(TURNTABLE_DEFAULTS.direction).toBe('ccw');
    expect(TURNTABLE_DEFAULTS.easingToNext).toBe('linear');
  });
});

describe('createDefaultAnimationConfig', () => {
  it('returns a fresh empty config mirroring turntable defaults', () => {
    const config = createDefaultAnimationConfig();
    expect(config.waypoints).toEqual([]);
    expect(config.durationSec).toBe(TURNTABLE_DEFAULTS.durationSec);
    expect(config.fps).toBe(TURNTABLE_DEFAULTS.fps);
    expect(config.axis).toBe(TURNTABLE_DEFAULTS.axis);
    expect(config.direction).toBe(TURNTABLE_DEFAULTS.direction);
    expect(config.splitTracks).toBe(false);
  });

  it('returns a NEW object each call (no shared mutable ref)', () => {
    const a = createDefaultAnimationConfig();
    const b = createDefaultAnimationConfig();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
