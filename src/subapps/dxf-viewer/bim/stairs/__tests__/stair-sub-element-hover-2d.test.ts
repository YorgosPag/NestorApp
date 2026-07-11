/**
 * ADR-358 Q19 Φ3c — 2D per-tread hover resolution + gate tests.
 *
 * The gate mirrors Φ3b click-into: pre-highlight a tread ONLY when the hovered
 * entity is the sole-selected stair. Reuses the Φ3a/Φ3b straight-flight fixture.
 *
 * @see ../stair-sub-element-hover-2d.ts
 */

// Controllable sole-selection gate (mirror the SelectedEntitiesStore surface used).
let mockCount = 0;
let mockSelectedId: string | null = null;
jest.mock('../../../systems/selection/SelectedEntitiesStore', () => ({
  SelectedEntitiesStore: {
    count: () => mockCount,
    isSelected: (id: string) => id === mockSelectedId,
  },
}));

import {
  resolveStairSubElementHover2D,
  updateStairSubElementHover2D,
} from '../stair-sub-element-hover-2d';
import { getStairSubElementHover, resetStairSubElementHover } from '../stair-sub-element-selection-store';
import type { Entity } from '../../../types/entities';
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

function stairEntity(id = 'stair_1'): Entity {
  return {
    id,
    type: 'stair',
    geometry: {
      treadsBelowCut: [tread(0, 0), tread(1, 175), tread(2, 350)],
      treadsAboveCut: [tread(3, 1225)],
    },
  } as unknown as Entity;
}

const wallEntity = { id: 'wall_1', type: 'wall' } as unknown as Entity;
const OVER_TREAD_1 = { x: 280 + 100, y: 0 };
const OUTSIDE = { x: 5000, y: 5000 };

function soleSelect(id: string): void {
  mockCount = 1;
  mockSelectedId = id;
}

describe('resolveStairSubElementHover2D', () => {
  beforeEach(() => {
    mockCount = 0;
    mockSelectedId = null;
  });

  it('resolves the tread under the cursor when the stair is sole-selected', () => {
    soleSelect('stair_1');
    expect(resolveStairSubElementHover2D('stair_1', OVER_TREAD_1, [stairEntity()])).toEqual({
      stairId: 'stair_1',
      part: 'tread',
      index: 1,
    });
  });

  it('null when nothing is hovered', () => {
    soleSelect('stair_1');
    expect(resolveStairSubElementHover2D(null, OVER_TREAD_1, [stairEntity()])).toBeNull();
  });

  it('null when the stair is not the sole selection (count ≠ 1)', () => {
    mockCount = 2;
    mockSelectedId = 'stair_1';
    expect(resolveStairSubElementHover2D('stair_1', OVER_TREAD_1, [stairEntity()])).toBeNull();
  });

  it('null when the hovered entity is not the selected one', () => {
    soleSelect('other');
    expect(resolveStairSubElementHover2D('stair_1', OVER_TREAD_1, [stairEntity()])).toBeNull();
  });

  it('null when the hovered entity is not a stair', () => {
    soleSelect('wall_1');
    expect(resolveStairSubElementHover2D('wall_1', OVER_TREAD_1, [wallEntity])).toBeNull();
  });

  it('null when the cursor is over the stair but misses every tread', () => {
    soleSelect('stair_1');
    expect(resolveStairSubElementHover2D('stair_1', OUTSIDE, [stairEntity()])).toBeNull();
  });
});

describe('updateStairSubElementHover2D (store write)', () => {
  beforeEach(() => {
    mockCount = 0;
    mockSelectedId = null;
    resetStairSubElementHover();
  });

  it('publishes the hovered tread to the singleton', () => {
    soleSelect('stair_1');
    updateStairSubElementHover2D('stair_1', OVER_TREAD_1, [stairEntity()]);
    expect(getStairSubElementHover()).toEqual({ stairId: 'stair_1', part: 'tread', index: 1 });
  });

  it('clears the singleton when the gate fails', () => {
    soleSelect('stair_1');
    updateStairSubElementHover2D('stair_1', OVER_TREAD_1, [stairEntity()]);
    mockCount = 0; // selection dropped
    updateStairSubElementHover2D('stair_1', OVER_TREAD_1, [stairEntity()]);
    expect(getStairSubElementHover()).toBeNull();
  });
});
