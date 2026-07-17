/**
 * ADR — Editable per-opening surface materials (LAST-wins fold, per part).
 */

import {
  resolveOpeningMaterial,
  DEFAULT_OPENING_FRAME_MATERIAL_ID,
  DEFAULT_OPENING_LEAF_MATERIAL_ID,
  DEFAULT_OPENING_GLASS_MATERIAL_ID,
  DEFAULT_OPENING_HARDWARE_MATERIAL_ID,
} from '../resolve-opening-material';
import type { OpeningParams } from '../../types/opening-types';
import type { OpeningTypeParams } from '../../types/bim-family-type';

/** Minimal valid OpeningParams builder — material fields opt-in per test. */
function makeParams(overrides: Partial<OpeningParams> = {}): OpeningParams {
  return {
    kind: 'door',
    wallId: 'wall-1',
    offsetFromStart: 0,
    width: 900,
    height: 2100,
    sillHeight: 0,
    ...overrides,
  };
}

function makeType(overrides: Partial<OpeningTypeParams> = {}): OpeningTypeParams {
  return { kind: 'door', width: 900, height: 2100, ...overrides };
}

describe('resolveOpeningMaterial — default (no signal) = zero regression', () => {
  it('falls back to the hardcoded-pipeline defaults (wood / wood / glass / metal)', () => {
    const r = resolveOpeningMaterial(makeParams());
    expect(r.frame).toBe(DEFAULT_OPENING_FRAME_MATERIAL_ID);
    expect(r.leaf).toBe(DEFAULT_OPENING_LEAF_MATERIAL_ID);
    expect(r.glass).toBe(DEFAULT_OPENING_GLASS_MATERIAL_ID);
    expect(r.hardware).toBe(DEFAULT_OPENING_HARDWARE_MATERIAL_ID);
    // The exact pre-ADR 3D output.
    expect(r.frame).toBe('mat-wood');
    expect(r.glass).toBe('mat-glass');
  });
});

describe('resolveOpeningMaterial — legacy single material (frame + leaf only)', () => {
  it('applies the instance legacy `material` to frame + leaf, glass stays default', () => {
    const r = resolveOpeningMaterial(makeParams({ material: 'mat-metal' }));
    expect(r.frame).toBe('mat-metal');
    expect(r.leaf).toBe('mat-metal');
    expect(r.glass).toBe('mat-glass'); // glazing never captured by the legacy single field
  });

  it('applies the type legacy `material`, superseded by the instance legacy `material`', () => {
    const r = resolveOpeningMaterial(
      makeParams({ material: 'mat-metal' }),
      makeType({ material: 'mat-brick' }),
    );
    expect(r.frame).toBe('mat-metal');
    expect(r.leaf).toBe('mat-metal');
  });
});

describe('resolveOpeningMaterial — per-part layers (LAST wins)', () => {
  it('uses the family type per-part materials when the instance has none', () => {
    const r = resolveOpeningMaterial(
      makeParams(),
      makeType({ materials: { frame: 'mat-metal', leaf: 'mat-wood', glass: 'mat-glass' } }),
    );
    expect(r.frame).toBe('mat-metal');
    expect(r.leaf).toBe('mat-wood');
  });

  it('instance per-part material wins over the type per-part material, part by part', () => {
    const r = resolveOpeningMaterial(
      makeParams({ materials: { frame: 'bmat_oak' } }),
      makeType({ materials: { frame: 'mat-metal', leaf: 'mat-metal' } }),
    );
    expect(r.frame).toBe('bmat_oak'); // instance wins for frame
    expect(r.leaf).toBe('mat-metal'); // type still owns leaf (instance left it undefined)
  });

  it('per-part layer wins over the legacy single layer at the same level', () => {
    const r = resolveOpeningMaterial(
      makeParams({ material: 'mat-brick', materials: { frame: 'bmat_oak' } }),
    );
    expect(r.frame).toBe('bmat_oak'); // per-part beats legacy single
    expect(r.leaf).toBe('mat-brick'); // legacy single still fills the part with no per-part override
  });

  it('resolves a full Revit-style per-part assignment including hardware', () => {
    const r = resolveOpeningMaterial(
      makeParams({
        materials: { frame: 'mat-metal', leaf: 'bmat_oak', glass: 'bmat_triple', hardware: 'mat-stone' },
      }),
    );
    expect(r).toEqual({
      frame: 'mat-metal',
      leaf: 'bmat_oak',
      glass: 'bmat_triple',
      hardware: 'mat-stone',
    });
  });
});
