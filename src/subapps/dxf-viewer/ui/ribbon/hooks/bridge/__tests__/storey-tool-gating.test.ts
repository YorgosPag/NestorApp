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
  it('counted / null kind → everything recommended (zero regression)', () => {
    for (const kind of ['ground', 'standard', null] as const) {
      expect(isCommandRecommendedForStorey('wall', kind)).toBe(true);
      expect(isCommandRecommendedForStorey('foundation-pad', kind)).toBe(true);
      expect(isCommandRecommendedForStorey('stair', kind)).toBe(true);
    }
  });

  it('foundation level recommends foundation/beam/slab, de-emphasises the rest', () => {
    expect(isCommandRecommendedForStorey('foundation-pad', 'foundation')).toBe(true);
    expect(isCommandRecommendedForStorey('beam', 'foundation')).toBe(true);
    expect(isCommandRecommendedForStorey('slab', 'foundation')).toBe(true);
    expect(isCommandRecommendedForStorey('wall', 'foundation')).toBe(false);
    expect(isCommandRecommendedForStorey('column', 'foundation')).toBe(false);
    expect(isCommandRecommendedForStorey('stair', 'foundation')).toBe(false);
  });

  it('stair-penthouse recommends stair/slab/wall/railing', () => {
    expect(isCommandRecommendedForStorey('stair', 'stair-penthouse')).toBe(true);
    expect(isCommandRecommendedForStorey('wall', 'stair-penthouse')).toBe(true);
    expect(isCommandRecommendedForStorey('railing', 'stair-penthouse')).toBe(true);
    expect(isCommandRecommendedForStorey('foundation-pad', 'stair-penthouse')).toBe(false);
    expect(isCommandRecommendedForStorey('column', 'stair-penthouse')).toBe(false);
  });

  it('non-BIM commands stay available on every special level', () => {
    expect(isCommandRecommendedForStorey('zoom-extents', 'foundation')).toBe(true);
  });
});
