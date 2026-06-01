/**
 * ADR-401 Phase G.3 — stair-attach-detach SSoT tests.
 *
 * Stair-typed wrappers over the generic `entity-attach-detach`:
 *   - detachStairSide resets to the STAIR defaults (top='unconnected', base='storey-floor')
 *   - isStairSideAttached reads the binding
 *   - detachStairSidesAffectedByVerticalEdit breaks the side whose stair driver changed
 *     (top ← totalRise/rise/stepCount, base ← basePoint.z/offsetFromStorey)
 */

import {
  detachStairSide,
  isStairSideAttached,
  detachStairSidesAffectedByVerticalEdit,
} from '../stair-attach-detach';
import type { StairParams } from '../../types/stair-types';
import { buildDefaultStairParams } from '../../../hooks/drawing/stair-completion';
import {
  DEFAULT_STAIR_TOP_BINDING,
  DEFAULT_STAIR_BASE_BINDING,
} from '../../types/bim-binding';

function params(overrides: Partial<StairParams> = {}): StairParams {
  return { ...buildDefaultStairParams({ x: 0, y: 0 }, 0), ...overrides };
}

describe('detachStairSide', () => {
  it('top → resets binding to "unconnected" + clears attachTopToIds', () => {
    const p = detachStairSide(params({ topBinding: 'attached', attachTopToIds: ['b1'] }), 'top');
    expect(p.topBinding).toBe(DEFAULT_STAIR_TOP_BINDING);
    expect(p.topBinding).toBe('unconnected');
    expect(p.attachTopToIds).toBeUndefined();
  });

  it('base → resets binding to "storey-floor" + clears attachBaseToIds', () => {
    const p = detachStairSide(params({ baseBinding: 'attached', attachBaseToIds: ['s1'] }), 'base');
    expect(p.baseBinding).toBe(DEFAULT_STAIR_BASE_BINDING);
    expect(p.attachBaseToIds).toBeUndefined();
  });
});

describe('isStairSideAttached', () => {
  it('reads the per-side binding', () => {
    expect(isStairSideAttached(params({ topBinding: 'attached' }), 'top')).toBe(true);
    expect(isStairSideAttached(params({ topBinding: 'unconnected' }), 'top')).toBe(false);
    expect(isStairSideAttached(params({ baseBinding: 'attached' }), 'base')).toBe(true);
    expect(isStairSideAttached(params({ baseBinding: 'storey-floor' }), 'base')).toBe(false);
  });
});

describe('detachStairSidesAffectedByVerticalEdit', () => {
  it('detaches top when totalRise/rise/stepCount changed while top attached', () => {
    const prev = params({ topBinding: 'attached', attachTopToIds: ['b1'], totalRise: 2880 });
    const next = { ...prev, totalRise: 3000 };
    const out = detachStairSidesAffectedByVerticalEdit(prev, next);
    expect(out.topBinding).toBe('unconnected');
    expect(out.attachTopToIds).toBeUndefined();
  });

  it('detaches base when basePoint.z changed while base attached', () => {
    const prev = params({ baseBinding: 'attached', attachBaseToIds: ['s1'] });
    const next = { ...prev, basePoint: { ...prev.basePoint, z: prev.basePoint.z + 500 } };
    const out = detachStairSidesAffectedByVerticalEdit(prev, next);
    expect(out.baseBinding).toBe('storey-floor');
    expect(out.attachBaseToIds).toBeUndefined();
  });

  it('detaches base when offsetFromStorey changed while base attached', () => {
    const prev = params({ baseBinding: 'attached', attachBaseToIds: ['s1'], offsetFromStorey: 0 });
    const next = { ...prev, offsetFromStorey: 100 };
    const out = detachStairSidesAffectedByVerticalEdit(prev, next);
    expect(out.baseBinding).toBe('storey-floor');
  });

  it('leaves an attached side untouched when its driver did not change', () => {
    const prev = params({ topBinding: 'attached', attachTopToIds: ['b1'] });
    const next = { ...prev, width: prev.width + 100 }; // plan edit, not a vertical driver
    const out = detachStairSidesAffectedByVerticalEdit(prev, next);
    expect(out.topBinding).toBe('attached');
    expect(out.attachTopToIds).toEqual(['b1']);
  });

  it('is a no-op when the side is not attached even if the driver changed', () => {
    const prev = params({ topBinding: 'unconnected', totalRise: 2880 });
    const next = { ...prev, totalRise: 3000 };
    const out = detachStairSidesAffectedByVerticalEdit(prev, next);
    expect(out).toBe(next);
  });
});
