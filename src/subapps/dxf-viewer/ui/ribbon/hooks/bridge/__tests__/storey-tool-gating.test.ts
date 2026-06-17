/**
 * ADR-461 Phase C4 — storey-tool-gating SSoT unit tests.
 *
 * Locks the commandKey→category mapping and the Revit-style ADVISORY
 * recommendation (counted storeys → everything; special levels → own discipline).
 */

import {
  resolveBimToolCategory,
  isCommandRecommendedForStorey,
} from '../storey-tool-gating';
import {
  buildActiveStoreyContext,
  type StoreyFloorRef,
} from '../../../../../systems/levels/active-storey-context';

// ADR-467 — full vertical stack (foundation + basement below grade) and a
// basement-free stack so the graduated foundation gating can be exercised.
const STACK_WITH_BASEMENT: readonly StoreyFloorRef[] = [
  { id: 'fnd', number: -2, kind: 'foundation' },
  { id: 'bsm', number: -1, kind: 'basement' },
  { id: 'grd', number: 0, kind: 'ground' },
  { id: 'upr', number: 1, kind: 'standard' },
  { id: 'pnt', number: 2, kind: 'stair-penthouse' },
];
const STACK_NO_BASEMENT: readonly StoreyFloorRef[] = [
  { id: 'grd', number: 0, kind: 'ground' },
  { id: 'upr', number: 1, kind: 'standard' },
];
const ctx = (stack: readonly StoreyFloorRef[], id: string) => {
  const c = buildActiveStoreyContext(stack, id);
  if (!c) throw new Error(`no ctx for ${id}`);
  return c;
};

describe('resolveBimToolCategory', () => {
  it('maps every wall/column/beam/foundation variant by prefix', () => {
    expect(resolveBimToolCategory('wall')).toBe('wall');
    expect(resolveBimToolCategory('wall-on-entity')).toBe('wall');
    expect(resolveBimToolCategory('wall.actions.fromGridOuter')).toBe('wall');
    expect(resolveBimToolCategory('column-discrete-from-perimeter-walls')).toBe('column');
    expect(resolveBimToolCategory('beam-from-wall')).toBe('beam');
    expect(resolveBimToolCategory('beam.actions.fromGrid')).toBe('beam');
    expect(resolveBimToolCategory('foundation-pad')).toBe('foundation');
    expect(resolveBimToolCategory('foundation-tie-beam')).toBe('foundation');
    expect(resolveBimToolCategory('foundation.actions.tieBeamsFromGrid')).toBe('foundation');
  });

  it('distinguishes openings from slabs', () => {
    expect(resolveBimToolCategory('opening')).toBe('opening');
    expect(resolveBimToolCategory('slab-opening')).toBe('opening');
    expect(resolveBimToolCategory('slab')).toBe('slab');
    expect(resolveBimToolCategory('slab.actions.fromGridMat')).toBe('slab');
  });

  it('maps circulation + architecture tools', () => {
    expect(resolveBimToolCategory('stair')).toBe('stair');
    expect(resolveBimToolCategory('railing')).toBe('railing');
    expect(resolveBimToolCategory('roof')).toBe('roof');
    expect(resolveBimToolCategory('floor-finish')).toBe('finish');
  });

  it('returns null for non-BIM-creation commands', () => {
    expect(resolveBimToolCategory('zoom-extents')).toBeNull();
    expect(resolveBimToolCategory('undo')).toBeNull();
    expect(resolveBimToolCategory('grip-edit')).toBeNull();
  });
});

describe('isCommandRecommendedForStorey', () => {
  it('null storey → everything recommended (zero regression)', () => {
    expect(isCommandRecommendedForStorey('wall', null)).toBe(true);
    expect(isCommandRecommendedForStorey('foundation-pad', null)).toBe(true);
    expect(isCommandRecommendedForStorey('stair', null)).toBe(true);
  });

  it('ADR-467 — counted upper storey recommends everything EXCEPT foundation', () => {
    const upr = ctx(STACK_WITH_BASEMENT, 'upr');
    expect(isCommandRecommendedForStorey('wall', upr)).toBe(true);
    expect(isCommandRecommendedForStorey('column', upr)).toBe(true);
    expect(isCommandRecommendedForStorey('beam', upr)).toBe(true);
    expect(isCommandRecommendedForStorey('slab', upr)).toBe(true);
    expect(isCommandRecommendedForStorey('foundation-pad', upr)).toBe(false);
    expect(isCommandRecommendedForStorey('foundation.actions.tieBeamsFromGrid', upr)).toBe(false);
  });

  it('ADR-467 — foundation discipline in-context on foundation + basement levels', () => {
    expect(isCommandRecommendedForStorey('foundation-pad', ctx(STACK_WITH_BASEMENT, 'fnd'))).toBe(true);
    expect(isCommandRecommendedForStorey('foundation-pad', ctx(STACK_WITH_BASEMENT, 'bsm'))).toBe(true);
  });

  it('ADR-467 — ground: foundation in-context only when it is the lowest storey', () => {
    // basement below → ground is NOT lowest → foundation de-emphasised
    expect(isCommandRecommendedForStorey('foundation-pad', ctx(STACK_WITH_BASEMENT, 'grd'))).toBe(false);
    // no basement → ground IS lowest → foundation in-context
    expect(isCommandRecommendedForStorey('foundation-pad', ctx(STACK_NO_BASEMENT, 'grd'))).toBe(true);
  });

  it('foundation level recommends foundation/beam/slab, de-emphasises the rest', () => {
    const fnd = ctx(STACK_WITH_BASEMENT, 'fnd');
    expect(isCommandRecommendedForStorey('foundation-pad', fnd)).toBe(true);
    expect(isCommandRecommendedForStorey('beam', fnd)).toBe(true);
    expect(isCommandRecommendedForStorey('slab', fnd)).toBe(true);
    expect(isCommandRecommendedForStorey('wall', fnd)).toBe(false);
    expect(isCommandRecommendedForStorey('column', fnd)).toBe(false);
    expect(isCommandRecommendedForStorey('stair', fnd)).toBe(false);
  });

  it('stair-penthouse recommends stair/slab/wall/railing, never foundation', () => {
    const pnt = ctx(STACK_WITH_BASEMENT, 'pnt');
    expect(isCommandRecommendedForStorey('stair', pnt)).toBe(true);
    expect(isCommandRecommendedForStorey('wall', pnt)).toBe(true);
    expect(isCommandRecommendedForStorey('railing', pnt)).toBe(true);
    expect(isCommandRecommendedForStorey('foundation-pad', pnt)).toBe(false);
    expect(isCommandRecommendedForStorey('column', pnt)).toBe(false);
  });

  it('non-BIM commands stay available on every level', () => {
    expect(isCommandRecommendedForStorey('zoom-extents', ctx(STACK_WITH_BASEMENT, 'fnd'))).toBe(true);
    expect(isCommandRecommendedForStorey('zoom-extents', ctx(STACK_WITH_BASEMENT, 'upr'))).toBe(true);
  });
});
