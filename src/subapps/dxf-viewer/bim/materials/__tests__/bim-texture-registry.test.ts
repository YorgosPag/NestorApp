/**
 * bim-texture-registry tests — ADR-417 #5 (`tileSizeMForMaterialId`).
 *
 * The roof converter reads a material's physical tile size to derive slope-aligned
 * UV scales for absolute (cm-accurate) tile dimensions. Verifies the same prefix
 * resolution path the 3D catalog uses, plus the null path for untextured keys.
 */

import { tileSizeMForMaterialId, TEXTURE_SET_DEFS } from '../bim-texture-registry';

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
