/**
 * material-thumbnail-resolver tests (ADR-413 §2D appearance).
 *
 * Covers the two slug-resolution entries (the swatch == 3D-render invariant) plus
 * the albedo-URL store in public mode (synchronous, no Firebase).
 */

import {
  slugForMaterialId,
  slugForMaterialCategory,
  materialThumbnailStore,
} from '../material-thumbnail-resolver';
import type { BimMaterialCategory } from '../../types/bim-material-types';

describe('slugForMaterialId', () => {
  it('maps DNA materialIds via the same path the 3D catalog uses', () => {
    expect(slugForMaterialId('mat-concrete-c25')).toBe('concrete');
    expect(slugForMaterialId('mat-brick-masonry')).toBe('brick');
    expect(slugForMaterialId('mat-plaster-int')).toBe('plaster');
    expect(slugForMaterialId('mat-tile')).toBe('tile');
    expect(slugForMaterialId('mat-wood')).toBe('wood');
    expect(slugForMaterialId('mat-screed')).toBe('plaster');
  });

  it('maps element keys to their slug', () => {
    expect(slugForMaterialId('elem-slab')).toBe('concrete');
  });

  it('returns null when the resolved key has no textured variant', () => {
    expect(slugForMaterialId('mat-glass')).toBeNull();
  });

  /**
   * ADR-693 Α2 — ΑΛΛΑΓΗ ΣΥΜΠΕΡΙΦΟΡΑΣ (σκόπιμη· αντικαθιστά το «unmapped → concrete»). Πριν, το
   * fallback του `resolveMaterialKey` έκανε ΚΑΘΕ άγνωστο id να ζητά την υφή του **σκυροδέματος**.
   * Μετρημένο στον browser (Giorgio 2026-07-24): τα υλικά βιβλιοθήκης `bmat_*` — που δεν έχουν
   * ΠΟΤΕ DNA prefix — ζητούσαν όλα τη φωτογραφία σκυροδέματος, και όταν το URL δεν λυνόταν,
   * **σπασμένη εικόνα**. Ένα id εκτός καταλόγου δεν έχει υφή· έχει «άγνωστο» → `null` → flat chip.
   */
  it('ADR-693: ξένο/άγνωστο id ΔΕΝ πέφτει πια σε σκυρόδεμα — επιστρέφει null', () => {
    expect(slugForMaterialId('mat-marble')).toBeNull();
    expect(slugForMaterialId('bmat_01HQ')).toBeNull();
    expect(slugForMaterialId('paint-red')).toBeNull();
    expect(slugForMaterialId('totally-unknown')).toBeNull();
  });

  it('ADR-693: το εισαγόμενο πλέγμα έχει ρητό def, χωρίς υφή', () => {
    expect(slugForMaterialId('elem-imported-mesh')).toBeNull();
  });
});

describe('slugForMaterialCategory', () => {
  const cases: ReadonlyArray<[BimMaterialCategory, string | null]> = [
    ['plaster', 'plaster'],
    ['masonry', 'brick'],
    ['concrete', 'concrete'],
    ['insulation', 'plaster'],
    ['flooring', 'tile'],
    ['window-frame', 'metal'],
    ['door-frame', 'wood'],
    ['paint', 'plaster'],
    ['roofing', 'roof-tiles'],
    ['waterproofing', 'stone'],
    ['other', null],
  ];
  it.each(cases)('maps category %s → slug %s', (category, slug) => {
    expect(slugForMaterialCategory(category)).toBe(slug);
  });
});

describe('materialThumbnailStore (public mode)', () => {
  it('resolves an albedo URL for a slug', async () => {
    materialThumbnailStore.preloadSlug('concrete');
    await new Promise((r) => setTimeout(r, 0));
    expect(materialThumbnailStore.getSlugUrl('concrete')).toBe('/textures/concrete/albedo.jpg');
  });

  it('returns undefined for a not-yet-preloaded slug', () => {
    expect(materialThumbnailStore.getSlugUrl('metal')).toBeUndefined();
  });
});
