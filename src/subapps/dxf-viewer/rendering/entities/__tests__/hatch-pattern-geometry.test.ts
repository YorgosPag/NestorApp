/**
 * buildHatchLines geometry — ADR-507 Φ1a.
 *
 * Επαληθεύει το SSoT που τρέφει ΚΑΙ τον HatchRenderer (canvas) ΚΑΙ το exploded DXF
 * (lines-mode): παράλληλες γραμμές κομμένες στα όρια, even-odd νησίδες, double cross.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildHatchLines,
  type HatchLineSegment,
} from '../../../bim/geometry/shared/hatch-pattern-geometry';

const SQUARE = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

/** Βρες τμήμα ~οριζόντιο σε δεδομένο y (tolerance). */
function atY(segs: HatchLineSegment[], y: number): HatchLineSegment[] {
  return segs.filter((s) => Math.abs(s.start.y - y) < 1e-6 && Math.abs(s.end.y - y) < 1e-6);
}

describe('buildHatchLines', () => {
  it('spacing ≤ 0 → κενό', () => {
    expect(buildHatchLines([SQUARE], { spacingMm: 0 })).toEqual([]);
    expect(buildHatchLines([SQUARE], { spacingMm: -5 })).toEqual([]);
  });

  it('κενά / εκφυλισμένα όρια → κενό', () => {
    expect(buildHatchLines([], { spacingMm: 5 })).toEqual([]);
    expect(buildHatchLines([[{ x: 0, y: 0 }, { x: 1, y: 0 }]], { spacingMm: 5 })).toEqual([]);
  });

  it('τετράγωνο 10×10, spacing 5, οριζόντιες → γραμμή y=5 κομμένη x∈[0,10]', () => {
    const segs = buildHatchLines([SQUARE], { spacingMm: 5, angleDeg: 0 });
    const mid = atY(segs, 5);
    expect(mid.length).toBe(1);
    const xs = [mid[0].start.x, mid[0].end.x].sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0, 6);
    expect(xs[1]).toBeCloseTo(10, 6);
  });

  it('double cross-hatch → προσθέτει κάθετο set (κατακόρυφη γραμμή x=5)', () => {
    const segs = buildHatchLines([SQUARE], { spacingMm: 5, angleDeg: 0, double: true });
    const vertical = segs.filter(
      (s) => Math.abs(s.start.x - 5) < 1e-6 && Math.abs(s.end.x - 5) < 1e-6,
    );
    expect(vertical.length).toBe(1);
  });

  it('νησίδα (even-odd) → η γραμμή y=5 σπάει σε 2 τμήματα (παρακάμπτει την τρύπα)', () => {
    const hole = [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }];
    const segs = buildHatchLines([SQUARE, hole], { spacingMm: 5, angleDeg: 0, islandStyle: 'normal' });
    const mid = atY(segs, 5);
    expect(mid.length).toBe(2);
    const spans = mid
      .map((s) => [s.start.x, s.end.x].sort((a, b) => a - b))
      .sort((a, b) => a[0] - b[0]);
    expect(spans[0][0]).toBeCloseTo(0, 6);
    expect(spans[0][1]).toBeCloseTo(3, 6);
    expect(spans[1][0]).toBeCloseTo(7, 6);
    expect(spans[1][1]).toBeCloseTo(10, 6);
  });

  it('islandStyle ignore → αγνοεί την τρύπα, μία ενιαία γραμμή x∈[0,10]', () => {
    const hole = [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }];
    const segs = buildHatchLines([SQUARE, hole], { spacingMm: 5, angleDeg: 0, islandStyle: 'ignore' });
    const mid = atY(segs, 5);
    expect(mid.length).toBe(1);
    const xs = [mid[0].start.x, mid[0].end.x].sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0, 6);
    expect(xs[1]).toBeCloseTo(10, 6);
  });

  it('origin phase shift → γραμμές μετατοπισμένες (y=2.5 αντί y=5 με origin y=2.5)', () => {
    const segs = buildHatchLines([SQUARE], { spacingMm: 5, angleDeg: 0, origin: { x: 0, y: 2.5 } });
    // origin y=2.5 → γραμμές σε 2.5, 7.5 (k μετρ. από origin).
    expect(atY(segs, 2.5).length).toBe(1);
    expect(atY(segs, 7.5).length).toBe(1);
    expect(atY(segs, 5).length).toBe(0);
  });
});
