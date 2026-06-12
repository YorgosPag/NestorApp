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
import { completeBeamFromTwoClicks } from '../../../hooks/drawing/beam-completion';
import { computeBeamGeometry } from '../../geometry/beam-geometry';
import type { BeamEntity, BeamParams } from '../../types/beam-types';

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

// Κατακόρυφη δοκός (άξονας Y), start/end x δεμένα στον X-άξονα 'xId'.
const beamBindings: GuideBinding[] = [
  { guideId: 'xId', slot: 'start-x' },
  { guideId: 'xId', slot: 'end-x' },
];

const hostedBeam = (): BeamEntity => {
  const result = completeBeamFromTwoClicks({ x: 0, y: 0 }, { x: 0, y: 4000 }, '0', 'straight', {}, 'mm');
  if (!result.ok) throw new Error('beam build failed');
  return { ...result.entity, guideBindings: beamBindings };
};

describe('getHostingStrategy', () => {
  it('επιστρέφει strategy για foundation', () => {
    expect(getHostingStrategy('foundation')).toBeDefined();
  });

  it('επιστρέφει strategy για beam', () => {
    expect(getHostingStrategy('beam')).toBeDefined();
  });

  it('επιστρέφει undefined για μη grid-hosted kind', () => {
    expect(getHostingStrategy('line' as AnySceneEntity['type'])).toBeUndefined();
  });
});

describe('beamHostingStrategy', () => {
  it('reconcile → re-derived startPoint/endPoint/geometry όταν κουνηθεί ο άξονας (z διατηρείται)', () => {
    const strategy = getHostingStrategy('beam')!;
    const update = strategy.reconcile(hostedBeam(), lookup({ xId: 1500 }));
    expect(update).not.toBeNull();
    const nextParams = update!.nextParams as BeamParams;
    expect(nextParams.startPoint.x).toBe(1500);
    expect(nextParams.endPoint.x).toBe(1500);
    // z παραμένει (Point3D — δεν χάνεται από το re-derive x/y).
    expect(nextParams.startPoint.z).toBe(0);
    expect(update!.nextGeometry).toEqual(computeBeamGeometry(nextParams));
    expect(update!.type).toBe('beam');
  });

  it('reconcile → null (only-changed) όταν ο άξονας είναι ήδη στη θέση', () => {
    const strategy = getHostingStrategy('beam')!;
    expect(strategy.reconcile(hostedBeam(), lookup({ xId: 0 }))).toBeNull();
  });

  it('outline → plan-view vertices (world coords)', () => {
    const strategy = getHostingStrategy('beam')!;
    const update = strategy.reconcile(hostedBeam(), lookup({ xId: 1500 }))!;
    const outline = strategy.outline(update.nextGeometry);
    expect(outline.length).toBeGreaterThan(0);
    expect(outline.every((v) => typeof v.x === 'number' && typeof v.y === 'number')).toBe(true);
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
