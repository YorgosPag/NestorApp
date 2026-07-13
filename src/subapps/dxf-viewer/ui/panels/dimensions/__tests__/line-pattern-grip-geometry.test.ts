/**
 * Tests — ADR-642 Φ6-A (§6.7.4): the pure grip-overlay geometry (layout, hit-test, drag mapping).
 */

import { describe, it, expect } from '@jest/globals';
import {
  HANDLE_IDS,
  handleAxis,
  layoutHandles,
  hitTestHandle,
  outwardDeltaPx,
  computeDragFactor,
} from '../line-pattern-grip-geometry';

const box = { width: 200, height: 40, inset: 6 };

describe('layoutHandles', () => {
  it('lays out all 8 handles at corners + edge mid-points', () => {
    const handles = layoutHandles(box);
    expect(handles.map((h) => h.id)).toEqual([...HANDLE_IDS]);
    const byId = Object.fromEntries(handles.map((h) => [h.id, h]));
    expect(byId.tl).toMatchObject({ x: 6, y: 6 });
    expect(byId.tm).toMatchObject({ x: 100, y: 6 });
    expect(byId.tr).toMatchObject({ x: 194, y: 6 });
    expect(byId.ml).toMatchObject({ x: 6, y: 20 });
    expect(byId.mr).toMatchObject({ x: 194, y: 20 });
    expect(byId.br).toMatchObject({ x: 194, y: 34 });
  });

  it('tags each handle with its axis', () => {
    expect(handleAxis('tm')).toBe('vertical');
    expect(handleAxis('ml')).toBe('horizontal');
    expect(handleAxis('tl')).toBe('both');
  });
});

describe('hitTestHandle', () => {
  const handles = layoutHandles(box);
  it('returns the nearest handle within radius', () => {
    expect(hitTestHandle(handles, 7, 7, 10)).toBe('tl');
    expect(hitTestHandle(handles, 100, 8, 10)).toBe('tm');
  });
  it('returns null when nothing is within radius', () => {
    expect(hitTestHandle(handles, 100, 20, 5)).toBeNull();
  });
});

describe('outwardDeltaPx', () => {
  it('top grows upward (−dy), bottom downward (+dy)', () => {
    expect(outwardDeltaPx('tm', 0, -5)).toEqual({ vertical: 5, horizontal: 0 });
    expect(outwardDeltaPx('bm', 0, 5)).toEqual({ vertical: 5, horizontal: 0 });
  });
  it('left grows leftward (−dx), right rightward (+dx)', () => {
    expect(outwardDeltaPx('ml', -5, 0)).toEqual({ vertical: 0, horizontal: 5 });
    expect(outwardDeltaPx('mr', 5, 0)).toEqual({ vertical: 0, horizontal: 5 });
  });
  it('corner contributes on both axes', () => {
    expect(outwardDeltaPx('tr', 4, -6)).toEqual({ vertical: 6, horizontal: 4 });
  });
});

describe('computeDragFactor', () => {
  const common = { axisHalfPx: 20, stepMm: 0.5, minMm: 0.05, free: true };

  it('is scale-free: ratio of new to old half-dimension', () => {
    // +20px on a 20px half → doubled
    expect(computeDragFactor({ ...common, outwardPx: 20, baseMm: 3 })).toBeCloseTo(2, 5);
    // −10px on a 20px half → 0.5×
    expect(computeDragFactor({ ...common, outwardPx: -10, baseMm: 3 })).toBeCloseTo(0.5, 5);
  });

  it('snaps the target mm to the step when not free', () => {
    // raw 1.5× on base 3mm → 4.5mm, already on the 0.5 grid
    expect(computeDragFactor({ ...common, free: false, outwardPx: 10, baseMm: 3 })).toBeCloseTo(4.5 / 3, 5);
    // raw 1.1× on base 3mm → 3.3mm → snaps to 3.5mm
    expect(computeDragFactor({ ...common, free: false, outwardPx: 2, baseMm: 3 })).toBeCloseTo(3.5 / 3, 5);
  });

  it('min-guards the target mm', () => {
    // huge shrink → clamped so targetMm ≥ minMm
    const f = computeDragFactor({ ...common, outwardPx: -19.9, baseMm: 3 });
    expect(f * 3).toBeGreaterThanOrEqual(0.05);
  });

  it('is a no-op (factor 1) when baseMm ≤ 0', () => {
    expect(computeDragFactor({ ...common, outwardPx: 40, baseMm: 0 })).toBe(1);
  });

  it('is a no-op (factor 1) when axisHalfPx ≤ 0', () => {
    expect(computeDragFactor({ ...common, axisHalfPx: 0, outwardPx: 40, baseMm: 3 })).toBe(1);
  });
});
