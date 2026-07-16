/**
 * ADR-608 Φ-import-svg (export) — `flattenSvgPathData` SSoT unit tests.
 *
 * Καλύπτει absolute/relative commands, implicit-repeat, smooth-curve reflection,
 * ελλειπτικά τόξα, subpaths, close (`Z`) και chord-tolerance — το parsing στο οποίο
 * στηρίζεται το explode των SVG glyphs σε flat γεωμετρία (DXF/PDF-vector).
 */

import { flattenSvgPathData } from '../svg-path-flatten';

const last = <T>(a: readonly T[]): T => a[a.length - 1];
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps;

describe('flattenSvgPathData', () => {
  it('parses an absolute polyline (M/L), open by default', () => {
    const [sub] = flattenSvgPathData('M0 0 L10 0 L10 10');
    expect(sub.closed).toBe(false);
    expect(sub.points).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 },
    ]);
  });

  it('accumulates relative commands (l/h/v) from the current point', () => {
    const [sub] = flattenSvgPathData('M0 0 l10 0 v10 h-10');
    expect(sub.points).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]);
  });

  it('treats absolute H/V correctly (not deltas)', () => {
    const [sub] = flattenSvgPathData('M2 3 H10 V20');
    expect(sub.points).toEqual([
      { x: 2, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 20 },
    ]);
  });

  it('marks the subpath closed on Z', () => {
    const [sub] = flattenSvgPathData('M0 0 L10 0 L10 10 Z');
    expect(sub.closed).toBe(true);
  });

  it('splits multiple subpaths (repeated M)', () => {
    const subs = flattenSvgPathData('M0 0 L1 0 M5 5 L6 5');
    expect(subs).toHaveLength(2);
    expect(subs[0].points).toHaveLength(2);
    expect(subs[1].points[0]).toEqual({ x: 5, y: 5 });
  });

  it('reads implicit-repeat coordinate sets after one command letter', () => {
    const [sub] = flattenSvgPathData('M0 0 L1 0 2 0 3 0');
    expect(sub.points).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
    ]);
  });

  it('treats implicit sets after M as lineTo (SVG spec)', () => {
    const [sub] = flattenSvgPathData('M0 0 1 1 2 2');
    expect(sub.points).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 },
    ]);
  });

  it('flattens a cubic Bézier ending at its endpoint', () => {
    const [sub] = flattenSvgPathData('M0 0 C3 0 7 0 10 0');
    expect(last(sub.points)).toEqual({ x: 10, y: 0 });
    // Colinear control points → all samples on the x-axis.
    expect(sub.points.every((p) => near(p.y, 0))).toBe(true);
  });

  it('flattens a quadratic Bézier and bulges off the chord', () => {
    const [sub] = flattenSvgPathData('M0 0 Q5 5 10 0');
    expect(last(sub.points)).toEqual({ x: 10, y: 0 });
    expect(sub.points.some((p) => p.y > 0.5)).toBe(true); // curve rises above the chord
  });

  it('reflects the previous control point for smooth S', () => {
    const [sub] = flattenSvgPathData('M0 0 C0 5 5 5 5 0 S10 -5 10 0');
    expect(last(sub.points)).toEqual({ x: 10, y: 0 });
    expect(sub.points.some((p) => p.y < -0.1)).toBe(true); // reflected control dips below
  });

  it('samples an elliptical arc (A) between endpoints', () => {
    const [sub] = flattenSvgPathData('M0 0 A5 5 0 0 1 10 0');
    expect(near(last(sub.points).x, 10)).toBe(true);
    expect(near(last(sub.points).y, 0, 1e-3)).toBe(true);
    expect(sub.points.some((p) => Math.abs(p.y) > 1)).toBe(true); // arc leaves the chord
  });

  it('produces more samples on a curve when tolerance shrinks', () => {
    const coarse = flattenSvgPathData('M0 0 C0 10 10 10 10 0', { tolerance: 2 });
    const fine = flattenSvgPathData('M0 0 C0 10 10 10 10 0', { tolerance: 0.05 });
    expect(fine[0].points.length).toBeGreaterThan(coarse[0].points.length);
  });

  it('returns [] for empty / degenerate input', () => {
    expect(flattenSvgPathData('')).toEqual([]);
    expect(flattenSvgPathData('   ')).toEqual([]);
    expect(flattenSvgPathData('M5 5')).toEqual([]); // single point → not a subpath
  });
});
