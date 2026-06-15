/**
 * ADR-460 Slice 1 — column section outline + reinforcement-mode classifier.
 */

import {
  resolveColumnReinforcementSection,
  WALL_ELONGATION_THRESHOLD,
} from '../column-section-outline';
import type { ColumnParams } from '../../../types/column-types';

function baseParams(over: Partial<ColumnParams> = {}): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width: 400,
    depth: 400,
    height: 3000,
    rotation: 0,
    sceneUnits: 'mm',
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    ...over,
  };
}

describe('resolveColumnReinforcementSection — mode classification', () => {
  it('rectangular → perimeter', () => {
    expect(resolveColumnReinforcementSection(baseParams()).mode).toBe('perimeter');
  });

  it('circular → circular (diameter = width, exact area π(d/2)²)', () => {
    const s = resolveColumnReinforcementSection(baseParams({ kind: 'circular', width: 500 }));
    expect(s.mode).toBe('circular');
    expect(s.isCircular).toBe(true);
    expect(s.diameterMm).toBe(500);
    expect(s.grossAreaMm2).toBeCloseTo(Math.PI * 250 ** 2, 0);
    expect(s.perimeterMm).toBeCloseTo(Math.PI * 500, 3);
  });

  it('shear-wall → wall (always, regardless of ratio)', () => {
    const s = resolveColumnReinforcementSection(baseParams({ kind: 'shear-wall', width: 2000, depth: 250 }));
    expect(s.mode).toBe('wall');
    expect(s.wallAxis).toEqual({ x: 1, y: 0 });
  });

  it('L-shape compact → perimeter; elongated → wall', () => {
    const compact = resolveColumnReinforcementSection(baseParams({ kind: 'L-shape', width: 500, depth: 500 }));
    expect(compact.mode).toBe('perimeter');
    const long = resolveColumnReinforcementSection(
      baseParams({ kind: 'L-shape', width: 2500, depth: 250, lshape: { armWidth: 250, armLength: 250 } }),
    );
    // bbox 2500×250 → elongation 10 ≥ threshold → wall
    expect(long.maxDimensionMm / long.minThicknessMm).toBeGreaterThanOrEqual(WALL_ELONGATION_THRESHOLD);
    expect(long.mode).toBe('wall');
  });
});

describe('resolveColumnReinforcementSection — geometry', () => {
  it('rectangular outline area = width×depth, perimeter = 2(w+d)', () => {
    const s = resolveColumnReinforcementSection(baseParams({ width: 300, depth: 600 }));
    expect(s.grossAreaMm2).toBeCloseTo(300 * 600, 0);
    expect(s.perimeterMm).toBeCloseTo(2 * (300 + 600), 0);
    expect(s.bboxWidthMm).toBeCloseTo(300, 0);
    expect(s.bboxDepthMm).toBeCloseTo(600, 0);
    expect(s.minThicknessMm).toBeCloseTo(300, 0);
  });

  it('outline is centroid-centered (bbox centre ≈ origin)', () => {
    const s = resolveColumnReinforcementSection(baseParams({ width: 400, depth: 400 }));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of s.outlineMm) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    expect((minX + maxX) / 2).toBeCloseTo(0, 6);
    expect((minY + maxY) / 2).toBeCloseTo(0, 6);
  });
});
