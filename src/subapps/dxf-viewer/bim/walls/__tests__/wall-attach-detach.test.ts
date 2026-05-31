/**
 * ADR-401 — wall-attach-detach SSoT: reset a wall's top/base attach binding.
 *
 * Pure, no mocks. Verifies the unconditional reset (manual «Detach» button) and
 * the `isWallSideAttached` guard the 3D grip uses for Revit "edit breaks attach".
 */

import {
  detachWallSide,
  isWallSideAttached,
  detachSidesAffectedByVerticalEdit,
} from '../wall-attach-detach';
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

describe('detachSidesAffectedByVerticalEdit (Phase E.4 — full-params)', () => {
  it('height edit while top-attached → breaks top binding only', () => {
    const p = wall({
      topBinding: 'attached',
      attachTopToIds: ['beam-1'],
      baseBinding: 'attached',
      attachBaseToIds: ['slab-1'],
    });
    const out = detachSidesAffectedByVerticalEdit(p, { ...p, height: 2800 });
    expect(out.topBinding).toBe(DEFAULT_WALL_TOP_BINDING);
    expect(out.attachTopToIds).toBeUndefined();
    // base side untouched — the edit did not change baseOffset
    expect(out.baseBinding).toBe('attached');
    expect(out.attachBaseToIds).toEqual(['slab-1']);
  });

  it('baseOffset edit while base-attached → breaks base binding only', () => {
    const p = wall({
      topBinding: 'attached',
      attachTopToIds: ['beam-1'],
      baseBinding: 'attached',
      attachBaseToIds: ['slab-1'],
    });
    const out = detachSidesAffectedByVerticalEdit(p, { ...p, baseOffset: 150 });
    expect(out.baseBinding).toBe(DEFAULT_WALL_BASE_BINDING);
    expect(out.attachBaseToIds).toBeUndefined();
    expect(out.topBinding).toBe('attached');
    expect(out.attachTopToIds).toEqual(['beam-1']);
  });

  it('editing both drivers at once breaks both attached sides', () => {
    const p = wall({
      topBinding: 'attached',
      attachTopToIds: ['beam-1'],
      baseBinding: 'attached',
      attachBaseToIds: ['slab-1'],
    });
    const out = detachSidesAffectedByVerticalEdit(p, { ...p, height: 2800, baseOffset: 150 });
    expect(out.topBinding).toBe(DEFAULT_WALL_TOP_BINDING);
    expect(out.baseBinding).toBe(DEFAULT_WALL_BASE_BINDING);
    expect(out.attachTopToIds).toBeUndefined();
    expect(out.attachBaseToIds).toBeUndefined();
  });

  it('no-op (returns next unchanged) when the driver value is unchanged', () => {
    const p = wall({ topBinding: 'attached', attachTopToIds: ['beam-1'], height: 3000 });
    const next = { ...p, height: 3000 };
    const out = detachSidesAffectedByVerticalEdit(p, next);
    expect(out).toBe(next); // next returned untouched — nothing detached
    expect(out.topBinding).toBe('attached');
  });

  it('no-op when the side is not attached (e.g. plain thickness edit)', () => {
    const p = wall({ topBinding: 'attached', attachTopToIds: ['beam-1'] });
    const next = { ...p, thickness: 250 };
    const out = detachSidesAffectedByVerticalEdit(p, next);
    expect(out).toBe(next);
    expect(out.topBinding).toBe('attached');
  });

  it('height edit while NOT top-attached leaves the binding intact', () => {
    const p = wall({ topBinding: 'unconnected', unconnectedHeight: 2400, height: 2400 });
    const next = { ...p, height: 2800 };
    const out = detachSidesAffectedByVerticalEdit(p, next);
    expect(out).toBe(next);
    expect(out.topBinding).toBe('unconnected');
  });
});
