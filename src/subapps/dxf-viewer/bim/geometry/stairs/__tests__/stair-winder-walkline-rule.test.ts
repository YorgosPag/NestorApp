/**
 * ADR-630 Phase 2 — balanced winder rule SSoT tests.
 *
 * Covers the balanced-going angle solver (`computeBalancedWinderRule`), the
 * validator warning helper (`winderWalklineWarnings`), the radial↔edge
 * intersection used to tile the corner, the unit-agnostic minimum resolver and
 * the wedge polygon shape.
 *
 * @see ../stair-winder-walkline-rule.ts
 */

import type { StairCodeProfile } from '../../../../bim/types/stair-types';
import {
  WINDER_CODE_MINIMUMS_MM,
  buildWinderWedge,
  computeBalancedWinderRule,
  radialEdgeIntersect,
  resolveWinderMinimums,
  winderWalklineWarnings,
} from '../stair-winder-walkline-rule';

const ALL_PROFILES: readonly StairCodeProfile[] = [
  'nok', 'ibc', 'eurocode', 'nbc', 'nfpa', 'as1657', 'din', 'ada', 'none',
];

const HALF_PI = Math.PI / 2;

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

describe('computeBalancedWinderRule', () => {
  it('keeps equal walkline going g = (2·tread + R·Θ)/(W+2)', () => {
    const rule = computeBalancedWinderRule({
      turnRad: HALF_PI, winderCount: 3, tread: 280, walklineRadius: 500,
    });
    const g = (2 * 280 + 500 * HALF_PI) / 5;
    expect(rule.walklineGoing).toBeCloseTo(g, 6);
    expect(rule.winderSweepRad).toBeCloseTo(g / 500, 9);
    // δ = (W·φ − Θ)/2 ; the fan spans W·φ centred on Θ.
    expect(rule.encroachRad).toBeCloseTo((3 * (g / 500) - HALF_PI) / 2, 9);
    expect(rule.startAngleRad).toBeCloseTo(-rule.encroachRad, 9);
    expect(rule.bandStepsPerSide).toBe(1);
  });

  it('narrow stair (R·Θ/W < tread) → wedges steal from flights (δ > 0)', () => {
    // width 1000 → R 500; pure-fan going 262 < tread 280 → encroach positive.
    const rule = computeBalancedWinderRule({
      turnRad: HALF_PI, winderCount: 3, tread: 280, walklineRadius: 500,
    });
    expect(rule.encroachRad).toBeGreaterThan(0);
    expect(rule.startAngleRad).toBeLessThan(0); // winder-0 back edge into flight 1
  });

  it('wide stair (R·Θ/W > tread) → wedges give to flights (δ < 0)', () => {
    // width 1200 → R 600; pure-fan going 314 > tread 280 → encroach negative.
    const rule = computeBalancedWinderRule({
      turnRad: HALF_PI, winderCount: 3, tread: 280, walklineRadius: 600,
    });
    expect(rule.encroachRad).toBeLessThan(0);
    expect(rule.startAngleRad).toBeGreaterThan(0);
  });

  it('mirrors the sweep sign for a clockwise turn', () => {
    const ccw = computeBalancedWinderRule({
      turnRad: HALF_PI, winderCount: 3, tread: 280, walklineRadius: 500,
    });
    const cw = computeBalancedWinderRule({
      turnRad: -HALF_PI, winderCount: 3, tread: 280, walklineRadius: 500,
    });
    expect(cw.winderSweepRad).toBeCloseTo(-ccw.winderSweepRad, 9);
    expect(cw.startAngleRad).toBeCloseTo(-ccw.startAngleRad, 9);
    expect(cw.walklineGoing).toBeCloseTo(ccw.walklineGoing, 9);
  });

  it('degenerates safely for winderCount 0 (going = tread, no sweep)', () => {
    const rule = computeBalancedWinderRule({
      turnRad: HALF_PI, winderCount: 0, tread: 280, walklineRadius: 500,
    });
    expect(rule.winderSweepRad).toBe(0);
    expect(rule.startAngleRad).toBe(0);
    expect(rule.walklineGoing).toBe(280);
  });
});

describe('winderWalklineWarnings', () => {
  const rule = computeBalancedWinderRule({
    turnRad: HALF_PI, winderCount: 3, tread: 280, walklineRadius: 500,
  });

  it('is silent when the equal going meets the code minimum', () => {
    expect(winderWalklineWarnings(rule, 250)).toHaveLength(0); // g ≈ 269 ≥ 250
  });

  it('warns when the equal going drops below the code minimum', () => {
    expect(winderWalklineWarnings(rule, 300)).toContain('winder-walkline-going-below-min');
  });

  it('never warns when the minimum is disabled (profile "none" → 0)', () => {
    expect(winderWalklineWarnings(rule, 0)).toHaveLength(0);
  });
});

describe('radialEdgeIntersect', () => {
  it('lands the radial on a perpendicular edge line', () => {
    // ray from origin along +x, edge is the vertical line x = 5 (dir +y).
    const p = radialEdgeIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 3 }, { x: 0, y: 1 });
    expect(p.x).toBeCloseTo(5, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('falls back to the edge point when ray and edge are parallel', () => {
    const p = radialEdgeIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 3 }, { x: 2, y: 0 });
    expect(p).toEqual({ x: 5, y: 3 });
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

  it('reverses winding for a clockwise turn (turnSign = -1)', () => {
    const ccw = buildWinderWedge(pivot, rayA, rayB, 0, 1000, 5, 1);
    const cw = buildWinderWedge(pivot, rayA, rayB, 0, 1000, 5, -1);
    expect(cw[1]).toEqual(ccw[2]);
    expect(cw[2]).toEqual(ccw[1]);
  });
});
