/**
 * ADR-378 Step 2 — Dimension snap-geometry SSoT tests.
 *
 * Verifies `computeDimLineSnapPoints` exposes the *rendered* dim-line geometry
 * (feet, midpoint, text anchor, arc/leader endpoints) so dimensions actually
 * attract — the fix for handoff `2026-07-06_dimension-snap-not-attracting` Step 2.
 */

import type {
  AlignedDimensionEntity,
  BaselineDimensionEntity,
  DimensionEntity,
  LinearDimensionEntity,
  RadiusDimensionEntity,
  Angular3PDimensionEntity,
} from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import { computeDimLineSnapPoints } from '../dim-snap-geometry';

const COMMON = { type: 'dimension' as const, styleId: 'iso-129', layerId: 'layer_test' };

function dim<T extends DimensionEntity>(patch: Partial<T> & Pick<T, 'dimensionType'>): T {
  return { id: 'dim_test', ...COMMON, ...patch } as T;
}

function hasPoint(points: readonly Point2D[], target: Point2D, tol = 1e-6): boolean {
  return points.some((p) => Math.abs(p.x - target.x) < tol && Math.abs(p.y - target.y) < tol);
}

describe('computeDimLineSnapPoints — rendered dim-line snap geometry', () => {
  it('aligned dim exposes both feet + midpoint (dim line offset from the feature)', () => {
    // Feature (0,0)→(100,0), dim line offset +50 in Y → feet at y=50.
    const entity = dim<AlignedDimensionEntity>({
      dimensionType: 'aligned',
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }],
    });
    const points = computeDimLineSnapPoints(entity);

    expect(hasPoint(points, { x: 0, y: 50 })).toBe(true); // foot1
    expect(hasPoint(points, { x: 100, y: 50 })).toBe(true); // foot2
    expect(hasPoint(points, { x: 50, y: 50 })).toBe(true); // dim-line midpoint
  });

  it('collapses the text anchor onto the midpoint when no textMidpoint is set (deduped)', () => {
    const entity = dim<AlignedDimensionEntity>({
      dimensionType: 'aligned',
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }],
    });
    const points = computeDimLineSnapPoints(entity);
    // foot1, foot2, midpoint(==default text anchor) → exactly 3 unique points.
    expect(points).toHaveLength(3);
  });

  it('adds the text anchor as a distinct point when textMidpoint overrides it', () => {
    const entity = dim<AlignedDimensionEntity>({
      dimensionType: 'aligned',
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }],
      textMidpoint: { x: 50, y: 80 },
    });
    const points = computeDimLineSnapPoints(entity);

    expect(hasPoint(points, { x: 50, y: 80 })).toBe(true); // text anchor
    expect(points).toHaveLength(4); // feet ×2 + midpoint + text
  });

  it('handles a horizontal linear dim (rotation 0) like an aligned one', () => {
    const entity = dim<LinearDimensionEntity>({
      dimensionType: 'linear',
      rotation: 0,
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }],
    });
    const points = computeDimLineSnapPoints(entity);

    expect(hasPoint(points, { x: 0, y: 50 })).toBe(true);
    expect(hasPoint(points, { x: 100, y: 50 })).toBe(true);
    expect(hasPoint(points, { x: 50, y: 50 })).toBe(true);
  });

  it('reads linear rotation as DEGREES (rotation 90 → vertical dim line)', () => {
    // Regression: dim-hit-geometry previously treated rotation as radians → wrong axis
    // (and no attraction) for every rotated linear dim. ADR-378 Boy-Scout fix.
    const entity = dim<LinearDimensionEntity>({
      dimensionType: 'linear',
      rotation: 90,
      defPoints: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 50, y: 0 }],
    });
    const points = computeDimLineSnapPoints(entity);

    expect(hasPoint(points, { x: 50, y: 0 })).toBe(true); // foot1
    expect(hasPoint(points, { x: 50, y: 100 })).toBe(true); // foot2
    expect(hasPoint(points, { x: 50, y: 50 })).toBe(true); // midpoint
  });

  it('produces finite, deduped points for a radius dim (variant geometry path)', () => {
    const entity = dim<RadiusDimensionEntity>({
      dimensionType: 'radius',
      defPoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    });
    const points = computeDimLineSnapPoints(entity);

    expect(points.length).toBeGreaterThan(0);
    expect(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(isDeduped(points)).toBe(true);
  });

  it('produces finite, deduped points for an angular 3-point dim', () => {
    const entity = dim<Angular3PDimensionEntity>({
      dimensionType: 'angular3P',
      // vertex, ray1End, ray2End, arcPoint
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 40, y: 40 }],
    });
    const points = computeDimLineSnapPoints(entity);

    expect(points.length).toBeGreaterThan(0);
    expect(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(isDeduped(points)).toBe(true);
  });

  it('falls back to text anchor + dim-line ref for a baseline dim (no parent lookup)', () => {
    const entity = dim<BaselineDimensionEntity>({
      dimensionType: 'baseline',
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }],
      textMidpoint: { x: 50, y: 60 },
    });
    const points = computeDimLineSnapPoints(entity);

    expect(hasPoint(points, { x: 50, y: 60 })).toBe(true); // persisted text anchor
    expect(hasPoint(points, { x: 0, y: 50 })).toBe(true); // defPoints[2] dim-line ref
  });
});

function isDeduped(points: readonly Point2D[]): boolean {
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.abs(points[i].x - points[j].x) < 1e-6 && Math.abs(points[i].y - points[j].y) < 1e-6) {
        return false;
      }
    }
  }
  return true;
}
