/**
 * ADR-510 Φ5 Bug 2 — spatial-index NaN-poisoning guard.
 *
 * A single NON-FINITE entity (e.g. a legacy broken explode) must NOT poison the
 * AGGREGATE bounds: `Math.min/max` with NaN → NaN bounds → the hit-test QuadTree
 * is built at {0,0,0,0} → EVERY entity is rejected as "outside index bounds" →
 * hover/pick dead. The aggregate MUST skip the bad entity and reflect the good ones.
 */

import { calculateBoundsFromEntities } from '../hit-tester-utils';
import { isFiniteBounds, isFinitePoint } from '../../../config/geometry-constants';
import type { Entity } from '../../../types/entities';

const line = (id: string, x1: number, y1: number, x2: number, y2: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr_a', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as unknown as Entity);

describe('ADR-510 Φ5 Bug 2 — isFiniteBounds / isFinitePoint (SSoT)', () => {
  it('isFiniteBounds: finite → true, any NaN/Infinity → false', () => {
    expect(isFiniteBounds({ minX: 0, minY: 0, maxX: 10, maxY: 10 })).toBe(true);
    expect(isFiniteBounds({ minX: NaN, minY: 0, maxX: 10, maxY: 10 })).toBe(false);
    expect(isFiniteBounds({ minX: 0, minY: 0, maxX: Infinity, maxY: 10 })).toBe(false);
  });
  it('isFinitePoint: finite → true, NaN → false', () => {
    expect(isFinitePoint({ x: 1, y: 2 })).toBe(true);
    expect(isFinitePoint({ x: NaN, y: 2 })).toBe(false);
  });
});

describe('ADR-510 Φ5 Bug 2 — calculateBoundsFromEntities ignores non-finite entities', () => {
  it('a NaN entity does NOT corrupt the aggregate of the good entities', () => {
    const bounds = calculateBoundsFromEntities([
      line('good1', 0, 0, 10, 10),
      line('bad', NaN, 0, 5, 5),   // ← poison; must be skipped
      line('good2', -4, -4, 2, 2),
    ]);
    expect(bounds).not.toBeNull();
    expect(isFiniteBounds(bounds!)).toBe(true);            // ← was NaN before the fix
    expect(bounds!.minX).toBe(-4);
    expect(bounds!.minY).toBe(-4);
    expect(bounds!.maxX).toBe(10);
    expect(bounds!.maxY).toBe(10);
  });

  it('all-good entities still aggregate normally (no regression)', () => {
    const bounds = calculateBoundsFromEntities([line('a', 0, 0, 4, 6)]);
    expect(bounds).not.toBeNull();
    expect(bounds!.maxX).toBe(4);
    expect(bounds!.maxY).toBe(6);
  });
});
