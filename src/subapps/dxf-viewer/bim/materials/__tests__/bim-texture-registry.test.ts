/**
 * bim-texture-registry tests — ADR-417 #5 (`tileSizeMForMaterialId`).
 *
 * The roof converter reads a material's physical tile size to derive slope-aligned
 * UV scales for absolute (cm-accurate) tile dimensions. Verifies the same prefix
 * resolution path the 3D catalog uses, plus the null path for untextured keys.
 */

import {
  tileSizeMForMaterialId,
  textureSlugForKey,
  mapsForTextureSet,
  TEXTURE_SET_DEFS,
} from '../bim-texture-registry';

describe('tileSizeMForMaterialId', () => {
  it('resolves the roof-tile material to the roof-tiles set base size', () => {
    expect(tileSizeMForMaterialId('mat-roof-tile')).toBe(TEXTURE_SET_DEFS['roof-tiles'].tileSizeM);
    expect(tileSizeMForMaterialId('elem-roof')).toBe(TEXTURE_SET_DEFS['roof-tiles'].tileSizeM);
  });

  it('resolves DNA materialIds via the shared prefix path', () => {
    expect(tileSizeMForMaterialId('mat-concrete-c25')).toBe(TEXTURE_SET_DEFS.concrete.tileSizeM);
    expect(tileSizeMForMaterialId('mat-wood')).toBe(TEXTURE_SET_DEFS.wood.tileSizeM);
  });

  it('returns null for materials with no textured variant', () => {
    expect(tileSizeMForMaterialId('mat-glass')).toBeNull();
  });
});

describe('ADR-447 — default concrete texture for structural/foundation elements', () => {
  it('foundation elements map to the concrete texture (no user material needed)', () => {
    expect(textureSlugForKey('elem-foundation')).toBe('concrete');
    expect(textureSlugForKey('elem-foundation-pad')).toBe('concrete');
    expect(textureSlugForKey('elem-foundation-strip')).toBe('concrete');
    expect(textureSlugForKey('elem-foundation-tie-beam')).toBe('concrete');
  });

  it('beam is concrete (RC δοκάρι — corrected from the wrong wood mapping)', () => {
    expect(textureSlugForKey('elem-beam')).toBe('concrete');
  });

  it('columns + slabs stay concrete (unchanged reference behaviour)', () => {
    expect(textureSlugForKey('elem-column')).toBe('concrete');
    expect(textureSlugForKey('elem-slab')).toBe('concrete');
  });
});
