/**
 * ADR-401 Phase F.3 — entity-attach-detach generic SSoT (wall + column).
 *
 * Pure, no mocks. Verifies the unconditional binding reset, the attached-side
 * guard, and the full-params «edit breaks attach» helper over the minimal
 * `VerticalAttachParams` shape (both `WallParams` and `ColumnParams` satisfy it).
 */

import {
  detachEntitySide,
  isEntitySideAttached,
  detachSidesAffectedByVerticalEdit,
  type VerticalAttachParams,
} from '../entity-attach-detach';
import {
  DEFAULT_WALL_TOP_BINDING,
  DEFAULT_WALL_BASE_BINDING,
} from '../../types/bim-binding';

function params(overrides: Partial<VerticalAttachParams> = {}): VerticalAttachParams {
  return {
    topBinding: 'storey-ceiling',
    baseBinding: 'storey-floor',
    height: 3000,
    baseOffset: 0,
    ...overrides,
  };
}

describe('detachEntitySide', () => {
  it('top → resets topBinding to default + clears attachTopToIds', () => {
    const p = params({ topBinding: 'attached', attachTopToIds: ['beam-1', 'beam-2'] });
    const out = detachEntitySide(p, 'top');
    expect(out.topBinding).toBe(DEFAULT_WALL_TOP_BINDING);
    expect(out.attachTopToIds).toBeUndefined();
    expect(out.baseBinding).toBe(p.baseBinding);
  });

  it('base → resets baseBinding to default + clears attachBaseToIds', () => {
    const p = params({ baseBinding: 'attached', attachBaseToIds: ['slab-1'] });
    const out = detachEntitySide(p, 'base');
    expect(out.baseBinding).toBe(DEFAULT_WALL_BASE_BINDING);
    expect(out.attachBaseToIds).toBeUndefined();
    expect(out.topBinding).toBe(p.topBinding);
  });

  it('is unconditional — resets even a non-attached side', () => {
    const p = params({ topBinding: 'unconnected' });
    expect(detachEntitySide(p, 'top').topBinding).toBe(DEFAULT_WALL_TOP_BINDING);
  });

  it('preserves extra fields of the concrete params type (generic <T>)', () => {
    const p = { ...params({ topBinding: 'attached', attachTopToIds: ['b'] }), kind: 'rectangular', width: 400 };
    const out = detachEntitySide(p, 'top');
    expect(out.kind).toBe('rectangular');
    expect(out.width).toBe(400);
  });
});

describe('isEntitySideAttached', () => {
  it('reports the top / base attached state', () => {
    expect(isEntitySideAttached(params({ topBinding: 'attached' }), 'top')).toBe(true);
    expect(isEntitySideAttached(params(), 'top')).toBe(false);
    expect(isEntitySideAttached(params({ baseBinding: 'attached' }), 'base')).toBe(true);
    expect(isEntitySideAttached(params(), 'base')).toBe(false);
  });
});

describe('detachSidesAffectedByVerticalEdit (full-params)', () => {
  const attached = params({
    topBinding: 'attached',
    attachTopToIds: ['beam-1'],
    baseBinding: 'attached',
    attachBaseToIds: ['slab-1'],
  });

  it('height change while top-attached → breaks top only', () => {
    const out = detachSidesAffectedByVerticalEdit(attached, { ...attached, height: 2800 });
    expect(out.topBinding).toBe(DEFAULT_WALL_TOP_BINDING);
    expect(out.attachTopToIds).toBeUndefined();
    expect(out.baseBinding).toBe('attached');
    expect(out.attachBaseToIds).toEqual(['slab-1']);
  });

  it('baseOffset change while base-attached → breaks base only', () => {
    const out = detachSidesAffectedByVerticalEdit(attached, { ...attached, baseOffset: 150 });
    expect(out.baseBinding).toBe(DEFAULT_WALL_BASE_BINDING);
    expect(out.attachBaseToIds).toBeUndefined();
    expect(out.topBinding).toBe('attached');
  });

  it('both drivers change → breaks both sides', () => {
    const out = detachSidesAffectedByVerticalEdit(attached, { ...attached, height: 2800, baseOffset: 150 });
    expect(out.topBinding).toBe(DEFAULT_WALL_TOP_BINDING);
    expect(out.baseBinding).toBe(DEFAULT_WALL_BASE_BINDING);
  });

  it('returns next unchanged when no driver changed', () => {
    const next = { ...attached };
    const out = detachSidesAffectedByVerticalEdit(attached, next);
    expect(out).toBe(next);
  });

  it('no-op when the changed driver belongs to a non-attached side', () => {
    const p = params({ baseBinding: 'attached', attachBaseToIds: ['slab-1'] });
    const next = { ...p, height: 4000 }; // top not attached
    const out = detachSidesAffectedByVerticalEdit(p, next);
    expect(out).toBe(next);
    expect(out.baseBinding).toBe('attached');
  });
});
