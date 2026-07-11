/**
 * ADR-358 Q19 Φ3b — 2D «click-into» gesture decision tests.
 *
 * Reuses the Φ3a fixture geometry (straight +X flight, mm): tread i spans
 * x ∈ [280·i, 280·i + 305], y ∈ [−500, 500]. The resolver enters a tread only on a
 * PLAIN click over the ALREADY-sole-selected stair; every other case is a whole-select.
 *
 * @see ../stair-click-into-2d.ts
 */

import { resolveStairClickInto } from '../stair-click-into-2d';
import type { StairHitInput } from '../stair-sub-element-hit';
import type { Polygon3D } from '../../types/stair-types';

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

/** A point over tread 0 and a point outside every tread. */
const OVER_TREAD_0 = { x: 100, y: 0 };
const OUTSIDE = { x: 5000, y: 5000 };

describe('resolveStairClickInto', () => {
  it('enters the tread sub-element on a plain click over the sole-selected stair', () => {
    expect(
      resolveStairClickInto({
        additive: false,
        worldPoint: OVER_TREAD_0,
        stair: stair(),
        isAlreadySole: true,
      }),
    ).toEqual({ kind: 'sub', ref: { stairId: 'stair_1', part: 'tread', index: 0 } });
  });

  it('whole-selects when the stair is NOT already the sole selection (1st click)', () => {
    expect(
      resolveStairClickInto({
        additive: false,
        worldPoint: OVER_TREAD_0,
        stair: stair(),
        isAlreadySole: false,
      }),
    ).toEqual({ kind: 'whole' });
  });

  it('whole-selects (never enters a sub-element) on an additive Shift/Ctrl click', () => {
    expect(
      resolveStairClickInto({
        additive: true,
        worldPoint: OVER_TREAD_0,
        stair: stair(),
        isAlreadySole: true,
      }),
    ).toEqual({ kind: 'whole' });
  });

  it('whole-selects when the hit entity is not a stair', () => {
    expect(
      resolveStairClickInto({
        additive: false,
        worldPoint: OVER_TREAD_0,
        stair: null,
        isAlreadySole: true,
      }),
    ).toEqual({ kind: 'whole' });
  });

  it('whole-selects when the click misses every tread (over the stair bbox but off a step)', () => {
    expect(
      resolveStairClickInto({
        additive: false,
        worldPoint: OUTSIDE,
        stair: stair(),
        isAlreadySole: true,
      }),
    ).toEqual({ kind: 'whole' });
  });

  it('resolves the correct 0-based global index for an above-cut tread', () => {
    // tread 3 spans x ∈ [840, 1145].
    expect(
      resolveStairClickInto({
        additive: false,
        worldPoint: { x: 900, y: 0 },
        stair: stair(),
        isAlreadySole: true,
      }),
    ).toEqual({ kind: 'sub', ref: { stairId: 'stair_1', part: 'tread', index: 3 } });
  });
});
