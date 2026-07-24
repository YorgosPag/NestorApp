/**
 * material-thumbnail-spec tests (ADR-687 Φ7) — the PURE def resolver behind the
 * uniform sphere swatches. Verifies each material kind maps to the right flat def,
 * with the documented precedence (appearance → catalog id → category → flat colour).
 */

import { resolveThumbnailDef } from '../material-thumbnail-spec';
import { hexToTrueColor } from '../../../utils/dxf-true-color';

describe('resolveThumbnailDef', () => {
  it('uses the per-material appearance when present (wins over id/category)', () => {
    const def = resolveThumbnailDef({
      appearance: { baseColorHex: '#4ade80', metalness: 0, roughness: 0.1, transmission: 0.7 },
      materialId: 'mat-brick',
      category: 'masonry',
    });
    expect(def?.color).toBe(hexToTrueColor('#4ade80'));
    expect(def?.transmission).toBeCloseTo(0.7);
  });

  it('resolves a catalog `mat-*` id to its catalog def', () => {
    const def = resolveThumbnailDef({ materialId: 'mat-brick-solid' });
    expect(def?.color).toBe(0xb05030); // MATERIAL_DEFS['mat-brick']
  });

  it('does NOT treat a `bmat_*` library id as a catalog def (falls to category)', () => {
    const def = resolveThumbnailDef({ materialId: 'bmat_abc', category: 'concrete' });
    expect(def?.color).toBe(0xb0b0b0); // concrete category def, not a catalog prefix match
  });

  it('resolves a library category when no id', () => {
    expect(resolveThumbnailDef({ category: 'door-frame' })?.color).toBe(0x8b5e3c); // wood
  });

  it('resolves a flat wall-covering paint colour', () => {
    const def = resolveThumbnailDef({ color: '#123456' });
    expect(def?.color).toBe(hexToTrueColor('#123456'));
    expect(def?.metalness).toBe(0);
    expect(def?.roughness).toBeCloseTo(0.7);
  });

  it('returns null when nothing resolves', () => {
    expect(resolveThumbnailDef({})).toBeNull();
  });
});
