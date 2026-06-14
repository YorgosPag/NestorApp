/**
 * ADR-457 Slice 3 — longitudinal bar-mark numbering SSoT tests.
 *
 * Verifies the shared #1…#N numbering: a 1-based permutation aligned to the
 * layout bar order, deterministic, ascending by the isometric screen-x key
 * (worldX + worldY), and null for unsupported kinds.
 */

import { assignColumnBarNumbers } from '../column-rebar-bar-marks';
import { columnLocalMmToWorld } from '../../../geometry/column-geometry';
import { computeColumnRebarLayout } from '../../reinforcement/column-rebar-layout';
import type { ColumnParams } from '../../../types/column-types';

const RECT: ColumnParams = {
  kind: 'rectangular',
  position: { x: 0, y: 0, z: 0 },
  anchor: 'center',
  width: 400,
  depth: 600,
  height: 3000,
  rotation: 0,
  reinforcement: {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
    coverMm: 25,
  },
};

describe('assignColumnBarNumbers (ADR-457 Slice 3)', () => {
  it('returns a 1-based permutation aligned to the layout bar order', () => {
    const numbers = assignColumnBarNumbers(RECT);
    expect(numbers).not.toBeNull();
    const layout = computeColumnRebarLayout(RECT.reinforcement!, RECT.width, RECT.depth)!;
    expect(numbers!).toHaveLength(layout.longitudinalBarsMm.length);
    expect([...numbers!].sort((a, b) => a - b))
      .toEqual(Array.from({ length: numbers!.length }, (_, i) => i + 1));
  });

  it('numbers bars ascending by the isometric screen-x key (worldX + worldY)', () => {
    const numbers = assignColumnBarNumbers(RECT)!;
    const layout = computeColumnRebarLayout(RECT.reinforcement!, RECT.width, RECT.depth)!;
    const world = columnLocalMmToWorld(RECT, layout.longitudinalBarsMm);
    const key = (i: number): number => world[i].x + world[i].y;
    // #1 must be the smallest key, #N the largest.
    const minIdx = world.map((_, i) => i).reduce((a, b) => (key(a) <= key(b) ? a : b));
    const maxIdx = world.map((_, i) => i).reduce((a, b) => (key(a) >= key(b) ? a : b));
    expect(numbers[minIdx]).toBe(1);
    expect(numbers[maxIdx]).toBe(numbers.length);
  });

  it('is deterministic', () => {
    expect(assignColumnBarNumbers(RECT)).toEqual(assignColumnBarNumbers(RECT));
  });

  it('returns null for a non-rectangular column', () => {
    expect(assignColumnBarNumbers({ ...RECT, kind: 'circular' })).toBeNull();
  });
});
