/**
 * ADR-401 — wall-attach-detach SSoT: reset a wall's top/base attach binding.
 *
 * Pure, no mocks. Verifies the unconditional reset (manual «Detach» button) and
 * the `isWallSideAttached` guard the 3D grip uses for Revit "edit breaks attach".
 */

import { detachWallSide, isWallSideAttached } from '../wall-attach-detach';
import {
  DEFAULT_WALL_TOP_BINDING,
  DEFAULT_WALL_BASE_BINDING,
} from '../../types/bim-binding';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import type { WallParams } from '../../types/wall-types';

function wall(overrides: Partial<WallParams> = {}): WallParams {
  return { ...buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 }), ...overrides };
}

describe('detachWallSide', () => {
  it('top → resets topBinding to default + clears attachTopToIds', () => {
    const p = wall({ topBinding: 'attached', attachTopToIds: ['beam-1', 'beam-2'] });
    const out = detachWallSide(p, 'top');
    expect(out.topBinding).toBe(DEFAULT_WALL_TOP_BINDING);
    expect(out.attachTopToIds).toBeUndefined();
    // base untouched
    expect(out.baseBinding).toBe(p.baseBinding);
  });

  it('base → resets baseBinding to default + clears attachBaseToIds', () => {
    const p = wall({ baseBinding: 'attached', attachBaseToIds: ['slab-1'] });
    const out = detachWallSide(p, 'base');
    expect(out.baseBinding).toBe(DEFAULT_WALL_BASE_BINDING);
    expect(out.attachBaseToIds).toBeUndefined();
    expect(out.topBinding).toBe(p.topBinding);
  });

  it('is unconditional — resets even a non-attached side (manual Detach button parity)', () => {
    const p = wall({ topBinding: 'unconnected', unconnectedHeight: 2400 });
    const out = detachWallSide(p, 'top');
    expect(out.topBinding).toBe(DEFAULT_WALL_TOP_BINDING);
  });
});

describe('isWallSideAttached', () => {
  it('reports the top side attached state', () => {
    expect(isWallSideAttached(wall({ topBinding: 'attached' }), 'top')).toBe(true);
    expect(isWallSideAttached(wall(), 'top')).toBe(false);
  });

  it('reports the base side attached state', () => {
    expect(isWallSideAttached(wall({ baseBinding: 'attached' }), 'base')).toBe(true);
    expect(isWallSideAttached(wall(), 'base')).toBe(false);
  });
});
