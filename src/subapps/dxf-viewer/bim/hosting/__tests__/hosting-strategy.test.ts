/**
 * ADR-441 Slice GEN — hosting strategy registry tests.
 *
 * Καλύπτει: registry lookup (foundation registered, non-hosted kind undefined), foundation
 * strategy reconcile (re-derive params/geometry/validation) + outline (footprint vertices).
 */

import { getHostingStrategy } from '../hosting-strategy';
import type { GuideOffsetLookup } from '../derive-slots';
import { createFoundation } from '@/services/factories/foundation.factory';
import { computeFoundationGeometry } from '../../geometry/foundation-geometry';
import type { FoundationEntity, StripFootingParams } from '../../types/foundation-types';
import type { GuideBinding } from '../guide-binding-types';
import type { AnySceneEntity } from '../../../types/scene';

const lookup = (offsets: Record<string, number>): GuideOffsetLookup => (id) => offsets[id];

const stripParams: StripFootingParams = {
  kind: 'strip',
  topElevationMm: -1000,
  thicknessMm: 400,
  start: { x: 0, y: 0, z: 0 },
  end: { x: 0, y: 4000, z: 0 },
  width: 600,
};

const bindings: GuideBinding[] = [
  { guideId: 'xId', slot: 'start-x' },
  { guideId: 'xId', slot: 'end-x' },
];

const hostedStrip = (): FoundationEntity => ({
  ...createFoundation({ id: 's1', params: stripParams, geometry: computeFoundationGeometry(stripParams), layerId: '0' }),
  guideBindings: bindings,
});

describe('getHostingStrategy', () => {
  it('επιστρέφει strategy για foundation', () => {
    expect(getHostingStrategy('foundation')).toBeDefined();
  });

  it('επιστρέφει undefined για μη grid-hosted kind', () => {
    expect(getHostingStrategy('line' as AnySceneEntity['type'])).toBeUndefined();
  });
});

describe('foundationHostingStrategy', () => {
  it('reconcile → re-derived params/geometry/validation όταν κουνηθεί ο άξονας', () => {
    const strategy = getHostingStrategy('foundation')!;
    const update = strategy.reconcile(hostedStrip(), lookup({ xId: 1500 }));
    expect(update).not.toBeNull();
    const nextParams = update!.nextParams as StripFootingParams;
    expect(nextParams.start.x).toBe(1500);
    expect(nextParams.end.x).toBe(1500);
    expect(update!.nextGeometry).toEqual(computeFoundationGeometry(nextParams));
    expect(update!.type).toBe('foundation');
  });

  it('reconcile → null (only-changed) όταν ο άξονας είναι ήδη στη θέση', () => {
    const strategy = getHostingStrategy('foundation')!;
    expect(strategy.reconcile(hostedStrip(), lookup({ xId: 0 }))).toBeNull();
  });

  it('outline → footprint vertices (world coords)', () => {
    const strategy = getHostingStrategy('foundation')!;
    const update = strategy.reconcile(hostedStrip(), lookup({ xId: 1500 }))!;
    const outline = strategy.outline(update.nextGeometry);
    expect(outline.length).toBeGreaterThan(0);
    expect(outline.every((v) => typeof v.x === 'number' && typeof v.y === 'number')).toBe(true);
  });
});
