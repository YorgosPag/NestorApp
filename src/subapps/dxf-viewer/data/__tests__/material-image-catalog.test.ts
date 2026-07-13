/**
 * ADR-643 Φ2 — Material image catalog unit tests.
 * Validates catalog integrity, façade-over-ADR-413 slug references, tile-size
 * derivation from TEXTURE_SET_DEFS, and accessor correctness.
 */

import {
  listMaterialImages,
  getMaterialImage,
  getMaterialImageDefaultTileMm,
  materialImageLabelKey,
} from '../material-image-catalog';
import { TEXTURE_SET_DEFS } from '../../bim/materials/bim-texture-registry';

describe('Material image catalog (ADR-643 Φ2)', () => {
  describe('listMaterialImages()', () => {
    it('returns the 18 curated materials (8 starter + 10 ADR-653 Φ7 photographic)', () => {
      expect(listMaterialImages()).toHaveLength(18);
    });

    it('every id uses the curated `matimg-` prefix (distinct from bmat_/mat_img_ generated)', () => {
      for (const m of listMaterialImages()) {
        expect(m.id.startsWith('matimg-')).toBe(true);
      }
    });

    it('ids are unique', () => {
      const ids = listMaterialImages().map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every entry references an existing ADR-413 texture slug (no fabricated asset)', () => {
      for (const m of listMaterialImages()) {
        expect(TEXTURE_SET_DEFS[m.textureSlug]).toBeDefined();
      }
    });
  });

  describe('getMaterialImage()', () => {
    it('resolves a known id', () => {
      expect(getMaterialImage('matimg-ceramic-tile')?.textureSlug).toBe('tile');
    });

    it('returns undefined for unknown / user ids and empty input', () => {
      expect(getMaterialImage('mat_img_userupload_xyz')).toBeUndefined();
      expect(getMaterialImage(undefined)).toBeUndefined();
      expect(getMaterialImage('')).toBeUndefined();
    });
  });

  describe('getMaterialImageDefaultTileMm() — derived from TEXTURE_SET_DEFS (SSoT, no duplicate dims)', () => {
    it('derives mm = tileSizeM * 1000 for a known material', () => {
      const marble = getMaterialImage('matimg-marble')!;
      const expectedMm = TEXTURE_SET_DEFS[marble.textureSlug].tileSizeM * 1000;
      expect(getMaterialImageDefaultTileMm('matimg-marble')).toEqual({
        width: expectedMm,
        height: expectedMm,
      });
    });

    it('ceramic tile derives 600×600 mm (tile slug = 0.6 m)', () => {
      expect(getMaterialImageDefaultTileMm('matimg-ceramic-tile')).toEqual({ width: 600, height: 600 });
    });

    it('ADR-653 Φ7 granite resolves its own slug and derives 600×600 mm (0.6 m)', () => {
      expect(getMaterialImage('matimg-granite')?.textureSlug).toBe('granite');
      expect(getMaterialImageDefaultTileMm('matimg-granite')).toEqual({ width: 600, height: 600 });
    });

    it('falls back to 1000×1000 mm for unknown ids', () => {
      expect(getMaterialImageDefaultTileMm('nope')).toEqual({ width: 1000, height: 1000 });
    });
  });

  describe('materialImageLabelKey()', () => {
    it('builds the hatchImageFill.materials.<suffix> i18n key', () => {
      const def = getMaterialImage('matimg-wood')!;
      expect(materialImageLabelKey(def)).toBe('hatchImageFill.materials.wood');
    });
  });
});
