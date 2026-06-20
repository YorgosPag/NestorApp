/**
 * ADR-505 §C — `dxf-category-layers` SSoT (per-category layers).
 *
 * Επαληθεύει: outline ανά κατηγορία (δομικά + αρχιτεκτονικά + Η-Μ → MEP)· fill layer
 * ΜΟΝΟ στα δομικά που γεμίζουμε· άγνωστος τύπος → null (κράτα αρχικό)· usedCategoryLayerDefs
 * κρατά ΜΟΝΟ ό,τι χρησιμοποιείται· ASCII-only ονόματα.
 */

import {
  resolveDxfBodyLayer,
  resolveDxfFillLayer,
  usedCategoryLayerDefs,
  CATEGORY_LAYER_DEFS,
} from '../dxf-category-layers';

describe('resolveDxfBodyLayer', () => {
  it('δομικά + αρχιτεκτονικά → per-category outline', () => {
    expect(resolveDxfBodyLayer('column')).toBe('COLUMNS');
    expect(resolveDxfBodyLayer('beam')).toBe('BEAMS');
    expect(resolveDxfBodyLayer('slab')).toBe('SLABS');
    expect(resolveDxfBodyLayer('foundation')).toBe('FOOTINGS');
    expect(resolveDxfBodyLayer('wall')).toBe('WALLS');
    expect(resolveDxfBodyLayer('opening')).toBe('OPENINGS');
  });

  it('όλοι οι Η-Μ τύποι → ΕΝΑ MEP layer', () => {
    expect(resolveDxfBodyLayer('mep-fixture')).toBe('MEP');
    expect(resolveDxfBodyLayer('mep-segment')).toBe('MEP');
    expect(resolveDxfBodyLayer('electrical-panel')).toBe('MEP');
  });

  it('άγνωστος/native τύπος → null (κράτα το αρχικό layer)', () => {
    expect(resolveDxfBodyLayer('line')).toBeNull();
    expect(resolveDxfBodyLayer('text')).toBeNull();
  });
});

describe('resolveDxfFillLayer', () => {
  it('γεμίζονται ΜΟΝΟ κολώνες/δοκάρια/πλάκες/πέδιλα', () => {
    expect(resolveDxfFillLayer('column')).toBe('COLUMNS_FILL');
    expect(resolveDxfFillLayer('beam')).toBe('BEAMS_FILL');
    expect(resolveDxfFillLayer('slab')).toBe('SLABS_FILL');
    expect(resolveDxfFillLayer('foundation')).toBe('FOOTINGS_FILL');
  });

  it('τοίχοι/ανοίγματα/Η-Μ = outline-only → fill null', () => {
    expect(resolveDxfFillLayer('wall')).toBeNull();
    expect(resolveDxfFillLayer('opening')).toBeNull();
    expect(resolveDxfFillLayer('mep-fixture')).toBeNull();
    expect(resolveDxfFillLayer('line')).toBeNull();
  });
});

describe('CATEGORY_LAYER_DEFS + usedCategoryLayerDefs', () => {
  it('περιέχει outline + fill defs με ASCII ονόματα', () => {
    expect(CATEGORY_LAYER_DEFS['COLUMNS']).toBeDefined();
    expect(CATEGORY_LAYER_DEFS['COLUMNS_FILL']).toBeDefined();
    expect(CATEGORY_LAYER_DEFS['WALLS']).toBeDefined();
    expect(CATEGORY_LAYER_DEFS['WALLS_FILL']).toBeUndefined(); // τοίχοι δεν γεμίζουν
    for (const id of Object.keys(CATEGORY_LAYER_DEFS)) {
      expect(id).toMatch(/^[\x20-\x7e]+$/); // μόνο ASCII (bare-DXF AutoCAD safe)
    }
  });

  it('usedCategoryLayerDefs κρατά ΜΟΝΟ τα χρησιμοποιημένα', () => {
    const used = usedCategoryLayerDefs([
      { layerId: 'COLUMNS' }, { layerId: 'COLUMNS_FILL' }, { layerId: 'lyr_random_dxf' },
    ]);
    expect(Object.keys(used).sort()).toEqual(['COLUMNS', 'COLUMNS_FILL']);
  });

  it('κενό input → κενό', () => {
    expect(usedCategoryLayerDefs([])).toEqual({});
  });
});
