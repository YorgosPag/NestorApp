/**
 * ADR-366 §C.1.Q4 — cubicBezier pure math tests.
 */

import { describe, expect, it } from 'vitest';
import { bezierValueAt, cubicBezier } from '../bezier-easing';

const EPSILON = 1e-4;

describe('cubicBezier — boundaries', () => {
  it('t=0 → 0 για κάθε control points', () => {
    expect(cubicBezier(0.42, 0, 0.58, 1)(0)).toBe(0);
    expect(cubicBezier(0.68, -0.55, 0.265, 1.55)(0)).toBe(0);
    expect(cubicBezier(0.1, 0.9, 0.9, 0.1)(0)).toBe(0);
  });

  it('t=1 → 1 για κάθε control points', () => {
    expect(cubicBezier(0.42, 0, 0.58, 1)(1)).toBe(1);
    expect(cubicBezier(0.68, -0.55, 0.265, 1.55)(1)).toBe(1);
    expect(cubicBezier(0.1, 0.9, 0.9, 0.1)(1)).toBe(1);
  });

  it('t<0 και t>1 clamp σε boundaries', () => {
    const fn = cubicBezier(0.42, 0, 0.58, 1);
    expect(fn(-0.5)).toBe(0);
    expect(fn(2)).toBe(1);
  });
});

describe('cubicBezier — linear identity shortcut', () => {
  it('p1=(0.25,0.25) p2=(0.75,0.75) → identity y=t', () => {
    const fn = cubicBezier(0.25, 0.25, 0.75, 0.75);
    expect(fn(0.25)).toBeCloseTo(0.25, 6);
    expect(fn(0.5)).toBeCloseTo(0.5, 6);
    expect(fn(0.75)).toBeCloseTo(0.75, 6);
  });

  it('arbitrary diagonal (p1=p1, p2=p2) → identity y=t', () => {
    const fn = cubicBezier(0.3, 0.3, 0.9, 0.9);
    expect(fn(0.4)).toBeCloseTo(0.4, 6);
    expect(fn(0.7)).toBeCloseTo(0.7, 6);
  });
});

describe('cubicBezier — CSS standard curves (known reference values)', () => {
  // Reference values cross-verified με Chrome DevTools cubic-bezier picker
  // + cubic-bezier.com calculator.
  it('CSS ease-in [0.42, 0, 1, 1] @ t=0.5 ≈ 0.3149', () => {
    const fn = cubicBezier(0.42, 0, 1, 1);
    expect(fn(0.5)).toBeCloseTo(0.3149, 3);
  });

  it('CSS ease-out [0, 0, 0.58, 1] @ t=0.5 ≈ 0.685', () => {
    const fn = cubicBezier(0, 0, 0.58, 1);
    expect(fn(0.5)).toBeCloseTo(0.685, 3);
  });

  it('CSS ease-in-out [0.42, 0, 0.58, 1] @ t=0.5 ≈ 0.5 (symmetric)', () => {
    const fn = cubicBezier(0.42, 0, 0.58, 1);
    expect(fn(0.5)).toBeCloseTo(0.5, 3);
  });

  it('CSS ease [0.25, 0.1, 0.25, 1] @ t=0.5 ≈ 0.802', () => {
    const fn = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(fn(0.5)).toBeCloseTo(0.802, 2);
  });
});

describe('cubicBezier — monotonicity', () => {
  it('ease-in-out increases monotonically', () => {
    const fn = cubicBezier(0.42, 0, 0.58, 1);
    let prev = fn(0);
    for (let t = 0.01; t <= 1; t += 0.01) {
      const current = fn(t);
      expect(current).toBeGreaterThanOrEqual(prev - EPSILON);
      prev = current;
    }
  });

  it('linear curve increases monotonically', () => {
    const fn = cubicBezier(0.25, 0.25, 0.75, 0.75);
    let prev = fn(0);
    for (let t = 0.05; t <= 1; t += 0.05) {
      const current = fn(t);
      expect(current).toBeGreaterThan(prev - EPSILON);
      prev = current;
    }
  });
});

describe('cubicBezier — overshoot support', () => {
  it('back-out [0.68, -0.55, 0.265, 1.55] παράγει values εκτός [0,1] στο μέσο', () => {
    const fn = cubicBezier(0.68, -0.55, 0.265, 1.55);
    // Στο ~0.85 παρόλα αυτά Y θα είναι >1 (overshoot)
    const peak = fn(0.85);
    expect(peak).toBeGreaterThan(1);
  });

  it('back-in [0.6, -0.28, 0.735, 0.045] παράγει negative Y νωρίς', () => {
    const fn = cubicBezier(0.6, -0.28, 0.735, 0.045);
    const early = fn(0.15);
    expect(early).toBeLessThan(0);
  });
});

describe('bezierValueAt — convenience wrapper', () => {
  it('matches cubicBezier(...) result για ίδιες παραμέτρους', () => {
    const fn = cubicBezier(0.42, 0, 0.58, 1);
    expect(bezierValueAt(0.3, 0.42, 0, 0.58, 1)).toBeCloseTo(fn(0.3), 6);
    expect(bezierValueAt(0.7, 0.42, 0, 0.58, 1)).toBeCloseTo(fn(0.7), 6);
  });
});

describe('cubicBezier — Newton convergence stress', () => {
  it('extreme curves (p1x near 0, p2x near 1) επιστρέφουν finite values', () => {
    const fn = cubicBezier(0.001, 0.999, 0.999, 0.001);
    for (let t = 0.1; t <= 0.9; t += 0.1) {
      const v = fn(t);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('all-zero p1 και p2 (ease-in-extreme) δεν διαιρεί δια του μηδενός', () => {
    const fn = cubicBezier(1, 0, 1, 0);
    const v = fn(0.5);
    expect(Number.isFinite(v)).toBe(true);
  });
});
