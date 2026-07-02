/**
 * ADR-458 (wall↔wall cross extension) — priority-based cross-junction cutback tests.
 *
 * A horizontal wall H (axis y=500, thickness 200 ⇒ footprint y∈[400,600]) and a vertical wall V
 * (axis x=500, thickness 200 ⇒ footprint x∈[400,600]) cross at (500,500), interior to BOTH.
 */

import {
  resolveWallJoinPriority,
  resolveWallCrossWinnerId,
  isWallCrossPair,
  computeWallCrossCutters,
  type WallCrossInput,
} from '../wall-cross-cutback';
import type { WallCategory } from '../../types/wall-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

function wall(
  id: string,
  start: Pt2,
  end: Pt2,
  footprint: Pt2[],
  category: WallCategory = 'interior',
  joinPriority?: number,
): WallCrossInput {
  return {
    id,
    params: {
      start: { x: start.x, y: start.y, z: 0 },
      end: { x: end.x, y: end.y, z: 0 },
      sceneUnits: 'mm',
      category,
      joinPriority,
    },
    footprint,
  };
}

const H_FP: Pt2[] = [{ x: 0, y: 400 }, { x: 1000, y: 400 }, { x: 1000, y: 600 }, { x: 0, y: 600 }];
const V_FP: Pt2[] = [{ x: 400, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 1000 }, { x: 400, y: 1000 }];

const makeH = (id = 'H', cat: WallCategory = 'exterior', p?: number) =>
  wall(id, { x: 0, y: 500 }, { x: 1000, y: 500 }, H_FP, cat, p);
const makeV = (id = 'V', cat: WallCategory = 'partition', p?: number) =>
  wall(id, { x: 500, y: 0 }, { x: 500, y: 1000 }, V_FP, cat, p);

describe('resolveWallJoinPriority', () => {
  it('explicit joinPriority overrides the category default', () => {
    expect(resolveWallJoinPriority({ category: 'partition', joinPriority: 999 })).toBe(999);
  });
  it('falls back to the category default when absent', () => {
    expect(resolveWallJoinPriority({ category: 'exterior' })).toBe(100);
    expect(resolveWallJoinPriority({ category: 'partition' })).toBe(40);
  });
});

describe('resolveWallCrossWinnerId', () => {
  it('higher priority wins (exterior beats partition)', () => {
    expect(resolveWallCrossWinnerId(makeH('H'), makeV('V'))).toBe('H');
    expect(resolveWallCrossWinnerId(makeV('V'), makeH('H'))).toBe('H');
  });
  it('explicit override flips the winner', () => {
    // Partition V with a huge explicit priority beats exterior H.
    expect(resolveWallCrossWinnerId(makeH('H'), makeV('V', 'partition', 500))).toBe('V');
  });
  it('tie → smaller id wins (deterministic, stable)', () => {
    const a = wall('w_a', { x: 0, y: 0 }, { x: 1, y: 1 }, H_FP, 'interior');
    const b = wall('w_b', { x: 0, y: 0 }, { x: 1, y: 1 }, V_FP, 'interior');
    expect(resolveWallCrossWinnerId(a, b)).toBe('w_a');
    expect(resolveWallCrossWinnerId(b, a)).toBe('w_a');
  });
});

describe('isWallCrossPair', () => {
  it('true for a genuine X-crossing (interior-interior)', () => {
    expect(isWallCrossPair(makeH(), makeV())).toBe(true);
  });

  it('false for a corner junction (endpoints meet)', () => {
    // Wall C meets H exactly at H's END (1000,500) → t=1 (endpoint), not interior.
    const c = wall('C', { x: 1000, y: 500 }, { x: 1000, y: 1500 }, V_FP);
    expect(isWallCrossPair(makeH(), c)).toBe(false);
  });

  it('false for a T-junction (one endpoint lands on the other interior)', () => {
    // H2 STARTS on V's interior at (500,500) → u=0 for H2 (endpoint), not interior.
    const h2 = wall('H2', { x: 500, y: 500 }, { x: 1500, y: 500 }, H_FP);
    expect(isWallCrossPair(makeV(), h2)).toBe(false);
  });

  it('false for parallel walls (no axis intersection)', () => {
    const h3 = wall('H3', { x: 0, y: 900 }, { x: 1000, y: 900 }, H_FP);
    expect(isWallCrossPair(makeH(), h3)).toBe(false);
  });

  it('false for a degenerate (sub-1mm) wall', () => {
    const tiny = wall('T', { x: 500, y: 500 }, { x: 500.5, y: 500 }, H_FP);
    expect(isWallCrossPair(tiny, makeV())).toBe(false);
  });
});

describe('computeWallCrossCutters', () => {
  it('loser gets the winner footprint as a cutter; winner gets none', () => {
    const cutters = computeWallCrossCutters([makeH('H'), makeV('V')]);
    expect(cutters.has('H')).toBe(false);         // exterior H wins → whole
    expect(cutters.get('V')).toHaveLength(1);       // partition V loses → cut by H
    expect(cutters.get('V')![0]).toEqual(H_FP);
  });

  it('accumulates multiple winners crossing one loser', () => {
    // V (partition) crossed by two exterior walls at y=300 and y=700.
    const h1 = wall('H1', { x: 0, y: 300 }, { x: 1000, y: 300 },
      [{ x: 0, y: 200 }, { x: 1000, y: 200 }, { x: 1000, y: 400 }, { x: 0, y: 400 }], 'exterior');
    const h2 = wall('H2', { x: 0, y: 700 }, { x: 1000, y: 700 },
      [{ x: 0, y: 600 }, { x: 1000, y: 600 }, { x: 1000, y: 800 }, { x: 0, y: 800 }], 'exterior');
    const cutters = computeWallCrossCutters([makeV('V'), h1, h2]);
    expect(cutters.get('V')).toHaveLength(2);
    expect(cutters.has('H1')).toBe(false);
    expect(cutters.has('H2')).toBe(false);
  });

  it('empty for <2 walls', () => {
    expect(computeWallCrossCutters([makeH()]).size).toBe(0);
  });

  it('empty when no pair crosses (corner/T/parallel only)', () => {
    const h3 = wall('H3', { x: 0, y: 900 }, { x: 1000, y: 900 }, H_FP);
    expect(computeWallCrossCutters([makeH('H'), h3]).size).toBe(0);
  });
});
