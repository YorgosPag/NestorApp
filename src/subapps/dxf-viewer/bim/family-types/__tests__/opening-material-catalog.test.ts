/**
 * Opening Material Catalog SSoT — preset listing + id classification.
 */

import {
  OPENING_MATERIAL_PRESET_IDS,
  OPENING_MATERIAL_CUSTOM_ID,
  defaultOpeningMaterialCatalog,
  classifyOpeningMaterial,
} from '../opening-material-catalog';

describe('opening-material-catalog — preset ids', () => {
  it('exposes the base opening-surface mat-* ids (wood / metal / glass)', () => {
    expect(OPENING_MATERIAL_PRESET_IDS).toEqual(['mat-wood', 'mat-metal', 'mat-glass']);
  });
});

describe('defaultOpeningMaterialCatalog.listMaterialIds', () => {
  it('lists every preset followed by the custom sentinel, each with a label key', () => {
    const opts = defaultOpeningMaterialCatalog.listMaterialIds();
    expect(opts.map((o) => o.id)).toEqual(['mat-wood', 'mat-metal', 'mat-glass', OPENING_MATERIAL_CUSTOM_ID]);
    // Every option carries a non-empty i18n label key suffix.
    expect(opts.every((o) => o.labelKeySuffix.length > 0)).toBe(true);
    expect(opts[0].labelKeySuffix).toBe('materialPresetWood');
    expect(opts[3].labelKeySuffix).toBe('materialPresetCustom');
  });
});

describe('defaultOpeningMaterialCatalog.resolvePreset', () => {
  it('resolves a known preset id to itself', () => {
    expect(defaultOpeningMaterialCatalog.resolvePreset('mat-metal')).toBe('mat-metal');
  });

  it('returns null for a user-library / free-form id', () => {
    expect(defaultOpeningMaterialCatalog.resolvePreset('bmat_oak')).toBeNull();
    expect(defaultOpeningMaterialCatalog.resolvePreset(undefined)).toBeNull();
  });
});

describe('classifyOpeningMaterial', () => {
  it('classifies preset / custom / empty', () => {
    expect(classifyOpeningMaterial('mat-wood')).toBe('preset');
    expect(classifyOpeningMaterial('bmat_oak')).toBe('custom');
    expect(classifyOpeningMaterial(undefined)).toBe('empty');
    expect(classifyOpeningMaterial('')).toBe('empty');
  });
});
