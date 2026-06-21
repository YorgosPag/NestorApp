/**
 * ADR-507 Φ7 — material → hatch mapping tests.
 */

import {
  normalizeMaterial,
  resolveAutoHatch,
  MATERIAL_HATCH_MAP,
} from '../material-hatch-map';

describe('normalizeMaterial', () => {
  it('αναγνωρίζει aliases των παλιών ταξινομιών', () => {
    expect(normalizeMaterial('rc')).toBe('concrete');
    expect(normalizeMaterial('RC')).toBe('concrete');
    expect(normalizeMaterial('reinforced-concrete')).toBe('concrete');
    expect(normalizeMaterial('brick')).toBe('masonry');
    expect(normalizeMaterial('glulam')).toBe('wood');
    expect(normalizeMaterial('timber')).toBe('wood');
    expect(normalizeMaterial('aircrete')).toBe('aerated-concrete');
    expect(normalizeMaterial('plasterboard')).toBe('gypsum');
  });

  it('fallback σε concrete για άγνωστο/κενό (ίδιο με παλιό rc default)', () => {
    expect(normalizeMaterial(undefined)).toBe('concrete');
    expect(normalizeMaterial('')).toBe('concrete');
    expect(normalizeMaterial('unobtainium')).toBe('concrete');
  });
});

describe('resolveAutoHatch', () => {
  it('cut → cut pattern (τομή)', () => {
    expect(resolveAutoHatch('rc', 'cut')).toBe('AR-CONC');
    expect(resolveAutoHatch('steel', 'cut')).toBe('STEEL');
    expect(resolveAutoHatch('masonry', 'cut')).toBe('BRICK');
    expect(resolveAutoHatch('wood', 'cut')).toBe('WOOD');
  });

  it('projection/beyond → surface pattern', () => {
    expect(resolveAutoHatch('steel', 'projection')).toBe('ANSI31');
    expect(resolveAutoHatch('masonry', 'projection')).toBe('AR-BRSTD');
    // concrete surface = null (solid/none)
    expect(resolveAutoHatch('rc', 'projection')).toBeNull();
  });

  it('glass → null και στις δύο όψεις (solid, χωρίς poché γραμμές)', () => {
    expect(resolveAutoHatch('glass', 'cut')).toBeNull();
    expect(resolveAutoHatch('glass', 'projection')).toBeNull();
  });

  it('κάθε canonical υλικό υπάρχει στο map', () => {
    for (const key of Object.keys(MATERIAL_HATCH_MAP)) {
      const def = MATERIAL_HATCH_MAP[key as keyof typeof MATERIAL_HATCH_MAP];
      expect(def).toHaveProperty('cut');
      expect(def).toHaveProperty('surface');
    }
  });
});
