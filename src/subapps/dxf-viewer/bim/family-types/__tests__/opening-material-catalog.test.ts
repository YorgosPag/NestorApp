/**
 * Opening Material Catalog SSoT — preset listing + library-backed provider +
 * id classification (ADR-672 §5 architecture + §8 Β user-library dropdown).
 */

import {
  OPENING_MATERIAL_PRESET_IDS,
  OPENING_MATERIAL_CUSTOM_ID,
  defaultOpeningMaterialCatalog,
  createOpeningMaterialCatalog,
  classifyOpeningMaterial,
  findOpeningMaterialOption,
  type OpeningMaterialLibraryEntry,
} from '../opening-material-catalog';

const LIBRARY: readonly OpeningMaterialLibraryEntry[] = [
  { id: 'bmat_oak', label: 'Δρυς', category: 'door-frame', thumbnailUrl: 'https://x/oak.png' },
  { id: 'bmat_alu', label: 'Αλουμίνιο', category: 'window-frame', albedoUrl: 'https://x/alu.png' },
];

describe('opening-material-catalog — preset ids', () => {
  it('exposes the base opening-surface mat-* ids (wood / metal / glass)', () => {
    expect(OPENING_MATERIAL_PRESET_IDS).toEqual(['mat-wood', 'mat-metal', 'mat-glass']);
  });
});

describe('defaultOpeningMaterialCatalog.listMaterialIds', () => {
  it('lists every preset followed by the custom sentinel, each with a label key', () => {
    const opts = defaultOpeningMaterialCatalog.listMaterialIds();
    expect(opts.map((o) => o.id)).toEqual([
      'mat-wood',
      'mat-metal',
      'mat-glass',
      OPENING_MATERIAL_CUSTOM_ID,
    ]);
    // Presets + custom render an i18n label key (no raw library labels here).
    expect(opts.every((o) => (o.labelKeySuffix?.length ?? 0) > 0)).toBe(true);
    expect(opts[0]).toMatchObject({ group: 'preset', labelKeySuffix: 'materialPresetWood' });
    expect(opts[3]).toMatchObject({ group: 'custom', labelKeySuffix: 'materialPresetCustom' });
  });
});

describe('createOpeningMaterialCatalog — library-backed provider', () => {
  const catalog = createOpeningMaterialCatalog(LIBRARY);

  it('lists presets → library → custom, in that order', () => {
    const opts = catalog.listMaterialIds();
    expect(opts.map((o) => o.id)).toEqual([
      'mat-wood',
      'mat-metal',
      'mat-glass',
      'bmat_oak',
      'bmat_alu',
      OPENING_MATERIAL_CUSTOM_ID,
    ]);
    expect(opts.map((o) => o.group)).toEqual([
      'preset',
      'preset',
      'preset',
      'library',
      'library',
      'custom',
    ]);
  });

  it('carries the raw name + swatch appearance on library options', () => {
    const oak = catalog.listMaterialIds().find((o) => o.id === 'bmat_oak');
    expect(oak).toMatchObject({
      group: 'library',
      label: 'Δρυς',
      swatch: { category: 'door-frame', thumbnailUrl: 'https://x/oak.png' },
    });
  });

  it('skips a library id that collides with a preset (preset DNA wins)', () => {
    const collide = createOpeningMaterialCatalog([
      { id: 'mat-wood', label: 'shadow wood' },
    ]);
    const woodOpts = collide.listMaterialIds().filter((o) => o.id === 'mat-wood');
    expect(woodOpts).toHaveLength(1);
    expect(woodOpts[0].group).toBe('preset');
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
  it('classifies preset ids as listed, unknown ids as custom (presets-only catalog)', () => {
    expect(classifyOpeningMaterial('mat-wood')).toBe('listed');
    expect(classifyOpeningMaterial('bmat_oak')).toBe('custom');
    expect(classifyOpeningMaterial(undefined)).toBe('empty');
    expect(classifyOpeningMaterial('')).toBe('empty');
  });

  it('classifies a library id as listed once the library-backed catalog knows it', () => {
    const catalog = createOpeningMaterialCatalog(LIBRARY);
    expect(classifyOpeningMaterial('bmat_oak', catalog)).toBe('listed');
    expect(classifyOpeningMaterial('mat-glass', catalog)).toBe('listed');
    // An id absent from BOTH presets and this library is still free-form custom.
    expect(classifyOpeningMaterial('bmat_unknown', catalog)).toBe('custom');
  });
});

describe('findOpeningMaterialOption', () => {
  it('returns the listed option (preset or library), never the custom sentinel', () => {
    const catalog = createOpeningMaterialCatalog(LIBRARY);
    expect(findOpeningMaterialOption('bmat_alu', catalog)?.label).toBe('Αλουμίνιο');
    expect(findOpeningMaterialOption('mat-wood', catalog)?.group).toBe('preset');
    expect(findOpeningMaterialOption(OPENING_MATERIAL_CUSTOM_ID, catalog)).toBeUndefined();
    expect(findOpeningMaterialOption(undefined, catalog)).toBeUndefined();
  });
});
