/**
 * material-thumbnail-spec tests (ADR-687 Φ7) — the PURE def resolver behind the
 * uniform sphere swatches. Verifies each material kind maps to the right flat def,
 * with the documented precedence (appearance → catalog id → category → flat colour).
 */

// Το texture cache mock-άρεται ώστε να ελεγχθεί ΑΝ ρωτήθηκε καθόλου (ADR-693 Α2): το βασικό
// συμβόλαιο δεν είναι μόνο «τι επιστρέφει», αλλά ότι ένα ξένο id δεν αγγίζει καν τον cache.
const getTextureSet = jest.fn();
const preloadTextureSet = jest.fn();
jest.mock('../../materials/bim-texture-cache', () => ({
  getTextureSet: (...a: unknown[]) => getTextureSet(...a),
  preloadTextureSet: (...a: unknown[]) => preloadTextureSet(...a),
}));

import { resolveThumbnailDef, resolveThumbnailTextureSet, preloadThumbnailTextures } from '../material-thumbnail-spec';
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

/**
 * ADR-693 Α2 — το sibling gap. Το `resolveThumbnailDef` εξαιρούσε ΗΔΗ ρητά τα `bmat_*`, αλλά οι δύο
 * αδελφές συναρτήσεις περνούσαν κάθε ξένο id από τον `resolveMaterialKey` → σκυρόδεμα. Αποτέλεσμα:
 * η σφαίρα ενός `paint-*` / άγνωστου id έπαιρνε την ΥΦΗ ΣΚΥΡΟΔΕΜΑΤΟΣ, και το `preload` κατέβαζε
 * άσκοπα το texture set για να το κάνει.
 */
describe('texture-set resolution — ξένο id δεν παίρνει υφή σκυροδέματος (ADR-693 Α2)', () => {
  beforeEach(() => {
    getTextureSet.mockReset();
    preloadTextureSet.mockReset();
  });

  it.each(['paint-red', 'mat-marble', 'totally-unknown'])(
    'το «%s» δεν λύνει σε κανένα texture set',
    (id) => {
      expect(resolveThumbnailTextureSet(id, 0)).toBeNull();
      expect(getTextureSet).not.toHaveBeenCalled();
    },
  );

  it.each(['paint-red', 'mat-marble', 'totally-unknown'])(
    'το «%s» δεν πυροδοτεί καμία φόρτωση υφής',
    (id) => {
      preloadThumbnailTextures(id);
      expect(preloadTextureSet).not.toHaveBeenCalled();
    },
  );

  it('ένα ΓΝΩΣΤΟ catalog id συνεχίζει κανονικά — καμία παλινδρόμηση', () => {
    preloadThumbnailTextures('mat-brick-solid');
    expect(preloadTextureSet).toHaveBeenCalledWith('brick');
  });
});
