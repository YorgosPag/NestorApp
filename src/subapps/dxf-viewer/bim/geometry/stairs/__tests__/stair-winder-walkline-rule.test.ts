/**
 * ADR-630 — winder walkline rule SSoT tests.
 *
 * Covers the two code rules for direction-changing stairs: the inner-corner
 * cut (no zero-going miter) and the walkline going compliance, plus the
 * unit-agnostic minimum resolver and the wedge polygon shape.
 *
 * @see ../stair-winder-walkline-rule.ts
 */

import type { StairCodeProfile } from '../../../../bim/types/stair-types';
import {
  WINDER_CODE_MINIMUMS_MM,
  buildWinderWedge,
  computeWinderWalklineRule,
  resolveWinderMinimums,
} from '../stair-winder-walkline-rule';

const ALL_PROFILES: readonly StairCodeProfile[] = [
  'nok', 'ibc', 'eurocode', 'nbc', 'nfpa', 'as1657', 'din', 'ada', 'none',
];

describe('WINDER_CODE_MINIMUMS_MM', () => {
  it('covers every code profile', () => {
    for (const p of ALL_PROFILES) {
      expect(WINDER_CODE_MINIMUMS_MM[p]).toBeDefined();
    }
  });

  it('disables the rule for the "none" profile', () => {
    expect(WINDER_CODE_MINIMUMS_MM.none).toEqual({
      walklineOffsetMm: 0,
      minWalklineGoingMm: 0,
      minInnerGoingMm: 0,
    });
  });
});

describe('resolveWinderMinimums', () => {
  it('returns raw mm when width is already in mm (scale = 1)', () => {
    const m = resolveWinderMinimums('nok', 1200);
    expect(m.walklineOffset).toBeCloseTo(300, 6);
    expect(m.minWalklineGoing).toBeCloseTo(250, 6);
    expect(m.minInnerGoing).toBeCloseTo(130, 6);
  });

  it('scales to scene units when width is in metres', () => {
    const m = resolveWinderMinimums('nok', 1.2); // 1.2 → metres → ×0.001
    expect(m.walklineOffset).toBeCloseTo(0.3, 9);
    expect(m.minInnerGoing).toBeCloseTo(0.13, 9);
  });

  it('scales to scene units when width is in centimetres', () => {
    const m = resolveWinderMinimums('ibc', 90); // 90 → cm range [10,100) → ×0.1
    expect(m.walklineOffset).toBeCloseTo(30.5, 6);
    expect(m.minInnerGoing).toBeCloseTo(15.2, 6);
  });
});

describe('computeWinderWalklineRule', () => {
  // 90° quarter-turn split into 3 winders → sweep = 30° per tread.
  const sweep30 = (30 * Math.PI) / 180;

  it('cuts the apex so the inner going reaches the minimum', () => {
    const rule = computeWinderWalklineRule({
      sweepPerTreadRad: sweep30,
      outerRadius: 1200,
      walklineOffset: 300,
      minInnerGoing: 130,
      minWalklineGoing: 250,
    });
    // innerRadius = minInnerGoing / sweep
    expect(rule.innerRadius).toBeCloseTo(130 / sweep30, 6);
    // going at the inner edge is exactly the requested minimum
    expect(rule.innerGoing).toBeCloseTo(130, 6);
    expect(rule.innerRadius).toBeGreaterThan(0);
  });

  it('places the walkline at inner edge + offset and measures its going', () => {
    const rule = computeWinderWalklineRule({
      sweepPerTreadRad: sweep30,
      outerRadius: 1200,
      walklineOffset: 300,
      minInnerGoing: 130,
      minWalklineGoing: 250,
    });
    expect(rule.walklineRadius).toBeCloseTo(rule.innerRadius + 300, 6);
    expect(rule.walklineGoing).toBeCloseTo((rule.innerRadius + 300) * sweep30, 6);
    // (248 + 300) * 0.523 ≈ 287 ≥ 250 → compliant, no warning
    expect(rule.warnings).not.toContain('winder-walkline-going-below-min');
  });

  it('keeps innerRadius 0 for the disabled ("none") profile inputs', () => {
    const rule = computeWinderWalklineRule({
      sweepPerTreadRad: sweep30,
      outerRadius: 1200,
      walklineOffset: 0,
      minInnerGoing: 0,
      minWalklineGoing: 0,
    });
    expect(rule.innerRadius).toBe(0);
    expect(rule.innerGoing).toBe(0);
    expect(rule.warnings).toHaveLength(0);
  });

  it('warns when too many winders crush the walkline going', () => {
    // 90° into 8 winders → sweep 11.25°; small radius → tiny going.
    const sweep = (90 * Math.PI) / 180 / 8;
    const rule = computeWinderWalklineRule({
      sweepPerTreadRad: sweep,
      outerRadius: 1000,
      walklineOffset: 300,
      minInnerGoing: 130,
      minWalklineGoing: 250,
    });
    expect(rule.warnings).toContain('winder-walkline-going-below-min');
  });

  it('clamps the walkline to mid-width and warns when the offset exceeds the tread', () => {
    const rule = computeWinderWalklineRule({
      sweepPerTreadRad: sweep30,
      outerRadius: 400,      // narrow
      walklineOffset: 900,   // way past the outer edge
      minInnerGoing: 130,
      minWalklineGoing: 250,
    });
    expect(rule.warnings).toContain('winder-walkline-offset-clamped');
    expect(rule.walklineRadius).toBeLessThanOrEqual(400);
    expect(rule.walklineRadius).toBeGreaterThan(rule.innerRadius);
  });

  it('caps the inner radius and warns when the minimum cannot fit the width', () => {
    const rule = computeWinderWalklineRule({
      sweepPerTreadRad: (90 * Math.PI) / 180, // one 90° wedge → inner radius demand 82.8
      outerRadius: 80, // maxInner = 72 < 82.8 → cannot fit
      walklineOffset: 100,
      minInnerGoing: 130,
      minWalklineGoing: 250,
    });
    expect(rule.warnings).toContain('winder-inner-going-below-min');
    expect(rule.innerRadius).toBeCloseTo(80 * 0.9, 6); // capped at 90% of outer
  });
});

describe('buildWinderWedge', () => {
  const pivot = { x: 0, y: 0 };
  const rayA = { x: 1, y: 0 };
  const rayB = { x: 0, y: 1 };

  it('emits a triangle (apex) when innerRadius is ~0', () => {
    const poly = buildWinderWedge(pivot, rayA, rayB, 0, 1000, 5, 1);
    expect(poly).toHaveLength(3);
    expect(poly[0]).toEqual({ x: 0, y: 0, z: 5 }); // apex at pivot
  });

  it('emits a trapezoid (no apex point) when innerRadius > 0', () => {
    const poly = buildWinderWedge(pivot, rayA, rayB, 200, 1000, 5, 1);
    expect(poly).toHaveLength(4);
    // [innerA, outerA, outerB, innerB]
    expect(poly[0]).toEqual({ x: 200, y: 0, z: 5 });
    expect(poly[1]).toEqual({ x: 1000, y: 0, z: 5 });
    expect(poly[2]).toEqual({ x: 0, y: 1000, z: 5 });
    expect(poly[3]).toEqual({ x: 0, y: 200, z: 5 });
    // no vertex sits on the pivot → the miter is gone
    expect(poly.some((p) => p.x === 0 && p.y === 0)).toBe(false);
  });

  it('reverses winding for a clockwise turn (turnSign = -1)', () => {
    const ccw = buildWinderWedge(pivot, rayA, rayB, 200, 1000, 5, 1);
    const cw = buildWinderWedge(pivot, rayA, rayB, 200, 1000, 5, -1);
    expect(cw[0]).toEqual(ccw[3]);
    expect(cw[3]).toEqual(ccw[0]);
  });
});
