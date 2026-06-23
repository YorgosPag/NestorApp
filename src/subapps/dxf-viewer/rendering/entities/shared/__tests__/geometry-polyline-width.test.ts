/**
 * ADR-510 Φ3d — Tests for the wide / tapered polyline width SSoT.
 * Tolerance 1e-9 vs analytical geometry.
 */
import {
  hasAnyWidth,
  resolveSegmentWidth,
  buildSegmentWidthBand,
} from '../geometry-polyline-width';
import type { Point2D } from '../../../types/Types';

const P = (x: number, y: number): Point2D => ({ x, y });

describe('resolveSegmentWidth (ADR-510 Φ3d)', () => {
  it('per-segment arrays win over constant width', () => {
    expect(resolveSegmentWidth(0, [10], [20], 5)).toEqual({ start: 10, end: 20 });
  });

  it('falls back to constant width when a side is absent / zero', () => {
    expect(resolveSegmentWidth(0, [0], undefined, 8)).toEqual({ start: 8, end: 8 });
  });

  it('returns zero when nothing is set', () => {
    expect(resolveSegmentWidth(2, undefined, undefined, undefined)).toEqual({ start: 0, end: 0 });
  });
});

describe('hasAnyWidth (ADR-510 Φ3d)', () => {
  it('true for a positive constant width', () => {
    expect(hasAnyWidth(undefined, undefined, 3)).toBe(true);
  });

  it('true when any per-segment width is positive', () => {
    expect(hasAnyWidth([0, 0, 4], [0, 0, 0], undefined)).toBe(true);
  });

  it('false for all-zero / absent widths', () => {
    expect(hasAnyWidth([0, 0], [0, 0], 0)).toBe(false);
    expect(hasAnyWidth(undefined, undefined, undefined)).toBe(false);
  });
});

describe('buildSegmentWidthBand (ADR-510 Φ3d)', () => {
  it('constant-width horizontal segment → rectangle band', () => {
    // p0(0,0) → p1(10,0), width 4 ⇒ half-width 2, band spans y ∈ [-2, 2].
    const band = buildSegmentWidthBand(P(0, 0), P(10, 0), 0, 4, 4);
    // Straight segment tessellates to 2 centre points → 4-vertex ring.
    expect(band).toHaveLength(4);
    const ys = band.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-2, 9);
    expect(ys[ys.length - 1]).toBeCloseTo(2, 9);
    const xs = band.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(0, 9);
    expect(Math.max(...xs)).toBeCloseTo(10, 9);
  });

  it('tapered segment → arrow head (end width 0 collapses to the axis)', () => {
    // start width 6 (half 3) at p0, end width 0 at p1.
    const band = buildSegmentWidthBand(P(0, 0), P(10, 0), 0, 6, 0);
    expect(band).toHaveLength(4);
    // Both endpoints at p1 collapse onto y = 0.
    const atEnd = band.filter((p) => Math.abs(p.x - 10) < 1e-9);
    expect(atEnd).toHaveLength(2);
    for (const p of atEnd) expect(p.y).toBeCloseTo(0, 9);
    // The start side keeps the full half-width.
    const atStart = band.filter((p) => Math.abs(p.x) < 1e-9);
    expect(atStart.map((p) => p.y).sort((a, b) => a - b)).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    const startYs = atStart.map((p) => Math.abs(p.y));
    for (const y of startYs) expect(y).toBeCloseTo(3, 9);
  });

  it('zero-width segment → empty band (hairline)', () => {
    expect(buildSegmentWidthBand(P(0, 0), P(10, 0), 0, 0, 0)).toEqual([]);
  });

  it('arc segment (bulge) tessellates the band beyond the chord', () => {
    // Quarter-circle bulge ≈ tan(22.5°). Band should have many ring points.
    const band = buildSegmentWidthBand(P(0, 0), P(10, 0), Math.tan(Math.PI / 8), 2, 2);
    expect(band.length).toBeGreaterThan(6);
    // Some band point must bow off the chord axis (y ≠ 0) beyond half-width.
    const maxAbsY = Math.max(...band.map((p) => Math.abs(p.y)));
    expect(maxAbsY).toBeGreaterThan(1);
  });
});
