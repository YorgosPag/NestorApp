/**
 * ADR-366 §C.1.Q4 — preset bezier mapping tests.
 */

import { describe, expect, it } from 'vitest';
import { cubicBezier } from '../../../viewport/bezier-easing';
import {
  EASING_PRESET_IDS,
  type EasingPresetId,
} from '../../animation-types';
import { PRESET_BEZIER_MAPPING, getPresetBezier } from '../preset-bezier-defaults';

describe('PRESET_BEZIER_MAPPING — completeness', () => {
  it('περιέχει entry για κάθε EasingPresetId', () => {
    for (const id of EASING_PRESET_IDS) {
      expect(PRESET_BEZIER_MAPPING[id]).toBeDefined();
    }
  });

  it('κάθε entry έχει 2 control points (p1, p2) με 2 αριθμητικά coords', () => {
    for (const id of EASING_PRESET_IDS) {
      const bezier = PRESET_BEZIER_MAPPING[id];
      expect(bezier.p1).toHaveLength(2);
      expect(bezier.p2).toHaveLength(2);
      expect(typeof bezier.p1[0]).toBe('number');
      expect(typeof bezier.p1[1]).toBe('number');
      expect(typeof bezier.p2[0]).toBe('number');
      expect(typeof bezier.p2[1]).toBe('number');
    }
  });

  it('p1.x και p2.x είναι σε [0, 1] (X-axis clamp invariant)', () => {
    for (const id of EASING_PRESET_IDS) {
      const bezier = PRESET_BEZIER_MAPPING[id];
      expect(bezier.p1[0]).toBeGreaterThanOrEqual(0);
      expect(bezier.p1[0]).toBeLessThanOrEqual(1);
      expect(bezier.p2[0]).toBeGreaterThanOrEqual(0);
      expect(bezier.p2[0]).toBeLessThanOrEqual(1);
    }
  });

  it('registry είναι frozen (read-only)', () => {
    expect(Object.isFrozen(PRESET_BEZIER_MAPPING)).toBe(true);
  });
});

describe('getPresetBezier — resolver', () => {
  it('επιστρέφει σωστό entry για γνωστό id', () => {
    expect(getPresetBezier('ease-in')).toEqual({ p1: [0.42, 0], p2: [1, 1] });
    expect(getPresetBezier('ease-out')).toEqual({ p1: [0, 0], p2: [0.58, 1] });
    expect(getPresetBezier('ease-in-out')).toEqual({ p1: [0.42, 0], p2: [0.58, 1] });
  });

  it('linear preset συμμετρικό (identity-style)', () => {
    const linear = getPresetBezier('linear');
    expect(linear.p1[0]).toBe(linear.p1[1]);
    expect(linear.p2[0]).toBe(linear.p2[1]);
  });

  it('elastic έχει overshoot (P1.y < 0, P2.y > 1)', () => {
    const elastic = getPresetBezier('elastic');
    expect(elastic.p1[1]).toBeLessThan(0);
    expect(elastic.p2[1]).toBeGreaterThan(1);
  });
});

describe('preset bezier curves — boundary correctness', () => {
  it('κάθε preset bezier επιστρέφει 0 στο t=0 και 1 στο t=1', () => {
    for (const id of EASING_PRESET_IDS as readonly EasingPresetId[]) {
      const { p1, p2 } = getPresetBezier(id);
      const fn = cubicBezier(p1[0], p1[1], p2[0], p2[1]);
      expect(fn(0)).toBe(0);
      expect(fn(1)).toBe(1);
    }
  });

  it('linear bezier ≈ y=t στο midpoint', () => {
    const { p1, p2 } = getPresetBezier('linear');
    const fn = cubicBezier(p1[0], p1[1], p2[0], p2[1]);
    expect(fn(0.5)).toBeCloseTo(0.5, 6);
  });
});
