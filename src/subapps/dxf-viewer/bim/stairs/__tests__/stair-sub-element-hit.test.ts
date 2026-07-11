/**
 * ADR-358 Q19 Φ3a — 2D per-tread pick tests.
 *
 * Straight +X flight (mm): 3 treads below cut (z 0/175/350) + 1 above (z 1225),
 * each a 305mm-deep × 1000mm-wide quad with a 25mm nosing overlap onto the next.
 *
 * @see ../stair-sub-element-hit.ts
 */

import {
  hitTestStairSubElement,
  stairTreadsInBuildOrder,
  type StairHitInput,
} from '../stair-sub-element-hit';
import type { Polygon3D } from '../../types/stair-types';

/** Tread i (mm): x ∈ [280·i, 280·i + 305], y ∈ [−500, 500], at elevation z. */
function tread(i: number, z: number): Polygon3D {
  const x0 = 280 * i;
  return [
    { x: x0, y: -500, z },
    { x: x0 + 305, y: -500, z },
    { x: x0 + 305, y: 500, z },
    { x: x0, y: 500, z },
  ];
}

function stair(): StairHitInput {
  return {
    id: 'stair_1',
    geometry: {
      treadsBelowCut: [tread(0, 0), tread(1, 175), tread(2, 350)],
      treadsAboveCut: [tread(3, 1225)],
    },
  };
}

describe('stairTreadsInBuildOrder', () => {
  it('concatenates below-cut then above-cut', () => {
    expect(stairTreadsInBuildOrder(stair())).toHaveLength(4);
  });

  it('returns [] when geometry is missing', () => {
    expect(stairTreadsInBuildOrder({ id: 's', geometry: null })).toEqual([]);
  });
});

describe('hitTestStairSubElement', () => {
  it('resolves the tread under the point (0-based global index)', () => {
    expect(hitTestStairSubElement(stair(), { x: 100, y: 0 })).toEqual({
      stairId: 'stair_1',
      part: 'tread',
      index: 0,
    });
    expect(hitTestStairSubElement(stair(), { x: 620, y: 0 })).toEqual({
      stairId: 'stair_1',
      part: 'tread',
      index: 2,
    });
  });

  it('resolves an above-cut tread by its global index', () => {
    // tread 3 spans x ∈ [840, 1145].
    expect(hitTestStairSubElement(stair(), { x: 900, y: 0 })?.index).toBe(3);
  });

  it('returns null when the point is outside every tread', () => {
    expect(hitTestStairSubElement(stair(), { x: 5000, y: 5000 })).toBeNull();
  });

  it('picks the HIGHER-elevation tread in a nosing overlap band', () => {
    // Overlap of tread 0 (front edge x=305) and tread 1 (back edge x=280):
    // x ∈ [280, 305] is inside both → the higher step (tread 1) wins.
    expect(hitTestStairSubElement(stair(), { x: 292, y: 0 })?.index).toBe(1);
  });

  it('returns null for a stair without geometry', () => {
    expect(hitTestStairSubElement({ id: 's', geometry: null }, { x: 0, y: 0 })).toBeNull();
  });
});
