/**
 * ADR-441 Slice 3 — `guide-hosting-reconciler` tests.
 *
 * Pure reconciler. Καλύπτει: inverted index build (1 guide → N entities), reconcile
 * returns only-changed, geometry+validation re-derived, entities χωρίς bindings
 * αγνοούνται.
 */

import {
  buildHostingIndex,
  reconcileHostedFoundations,
} from '../guide-hosting-reconciler';
import type { GuideOffsetLookup } from '../derive-params-from-guides';
import type { GuideBinding } from '../guide-binding-types';
import { createFoundation } from '@/services/factories/foundation.factory';
import { computeFoundationGeometry } from '../../geometry/foundation-geometry';
import type { FoundationEntity, StripFootingParams } from '../../types/foundation-types';

const stripParams = (over: Partial<StripFootingParams> = {}): StripFootingParams => ({
  kind: 'strip',
  topElevationMm: -1000,
  thicknessMm: 400,
  start: { x: 0, y: 0, z: 0 },
  end: { x: 0, y: 4000, z: 0 },
  width: 600,
  ...over,
});

const strip = (
  id: string,
  params: StripFootingParams,
  guideBindings: readonly GuideBinding[],
): FoundationEntity => ({
  ...createFoundation({ id, params, geometry: computeFoundationGeometry(params), layerId: '0' }),
  guideBindings,
});

const lookup = (offsets: Record<string, number>): GuideOffsetLookup => (id) => offsets[id];

describe('buildHostingIndex', () => {
  it('χτίζει inverted index guideId → set εν entity ids (1 guide → N entities)', () => {
    const e1 = strip('s1', stripParams(), [{ guideId: 'xId', slot: 'start-x' }, { guideId: 'xId', slot: 'end-x' }]);
    const e2 = strip('s2', stripParams(), [{ guideId: 'xId', slot: 'start-x' }, { guideId: 'yB', slot: 'end-y' }]);
    const index = buildHostingIndex([e1, e2]);
    expect(index.get('xId')).toEqual(new Set(['s1', 's2']));
    expect(index.get('yB')).toEqual(new Set(['s2']));
  });

  it('αγνοεί entities χωρίς bindings', () => {
    const plain = createFoundation({
      id: 'p1', params: stripParams(), geometry: computeFoundationGeometry(stripParams()), layerId: '0',
    });
    const index = buildHostingIndex([plain]);
    expect(index.size).toBe(0);
  });
});

describe('reconcileHostedFoundations', () => {
  const bindings: GuideBinding[] = [
    { guideId: 'xId', slot: 'start-x' },
    { guideId: 'xId', slot: 'end-x' },
    { guideId: 'yA', slot: 'start-y' },
    { guideId: 'yB', slot: 'end-y' },
  ];

  it('επιστρέφει update μόνο για όσες entities άλλαξαν', () => {
    const moving = strip('s1', stripParams(), bindings);
    const stable = strip('s2', stripParams(), bindings);
    // xId 0→2500 → s1 & s2 και τα δύο δένονται στο xId → και τα δύο αλλάζουν.
    const updates = reconcileHostedFoundations([moving, stable], lookup({ xId: 2500, yA: 0, yB: 4000 }));
    expect(updates).toHaveLength(2);
  });

  it('no-op όταν τα offsets ταυτίζονται με τις τρέχουσες params', () => {
    const e = strip('s1', stripParams(), bindings);
    const updates = reconcileHostedFoundations([e], lookup({ xId: 0, yA: 0, yB: 4000 }));
    expect(updates).toHaveLength(0);
  });

  it('re-derives geometry + validation από τις νέες params', () => {
    const e = strip('s1', stripParams(), bindings);
    const [update] = reconcileHostedFoundations([e], lookup({ xId: 1000, yA: 0, yB: 4000 }));
    expect(update.nextParams.kind).toBe('strip');
    expect(update.nextGeometry).toEqual(computeFoundationGeometry(update.nextParams));
    expect(update.nextValidation).toHaveProperty('lastValidatedAt');
  });

  it('αγνοεί entities χωρίς bindings (no update)', () => {
    const plain = createFoundation({
      id: 'p1', params: stripParams(), geometry: computeFoundationGeometry(stripParams()), layerId: '0',
    });
    const updates = reconcileHostedFoundations([plain], lookup({ xId: 9999 }));
    expect(updates).toHaveLength(0);
  });
});
