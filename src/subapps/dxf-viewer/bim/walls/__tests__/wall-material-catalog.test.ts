/**
 * ADR-363 Phase 1D — `wall-material-catalog` tests.
 *
 * Verifies the preset list, the `resolvePreset` lookup contract, and the
 * `classifyWallMaterial` partition (preset / custom / empty).
 */

import {
  WALL_MATERIAL_PRESET_IDS,
  WALL_MATERIAL_CUSTOM_ID,
  classifyWallMaterial,
  defaultWallMaterialCatalog,
  isInsulationMaterial,
} from '../wall-material-catalog';

describe('ADR-447 — isInsulationMaterial', () => {
  it('true for ETICS-class insulation (prefix-tolerant)', () => {
    expect(isInsulationMaterial('mat-eps')).toBe(true);
    expect(isInsulationMaterial('mat-eps-graphite')).toBe(true);
    expect(isInsulationMaterial('mat-xps')).toBe(true);
    expect(isInsulationMaterial('mat-mineral-wool')).toBe(true);
    expect(isInsulationMaterial('mat-plaster-thermal')).toBe(true);
  });

  it('false for structural / finish / plaster materials', () => {
    expect(isInsulationMaterial('mat-brick-masonry')).toBe(false);
    expect(isInsulationMaterial('mat-concrete-c25')).toBe(false);
    expect(isInsulationMaterial('mat-plaster-int')).toBe(false);
    expect(isInsulationMaterial('mat-plaster-ext')).toBe(false);
    expect(isInsulationMaterial(undefined)).toBe(false);
  });
});

describe('wall-material-catalog (ADR-363 Phase 1D)', () => {
  it('1. exposes all preset IDs in the options list', () => {
    const ids = defaultWallMaterialCatalog.listMaterialIds().map((o) => o.id);
    for (const preset of WALL_MATERIAL_PRESET_IDS) {
      expect(ids).toContain(preset);
    }
    expect(ids).toContain(WALL_MATERIAL_CUSTOM_ID);
  });

  it('2. resolvePreset returns the preset ID for known values', () => {
    expect(defaultWallMaterialCatalog.resolvePreset('mat-concrete-c25')).toBe(
      'mat-concrete-c25',
    );
  });

  it('3. resolvePreset returns null for unknown / free-form values', () => {
    expect(defaultWallMaterialCatalog.resolvePreset('not-a-preset')).toBeNull();
    expect(defaultWallMaterialCatalog.resolvePreset(undefined)).toBeNull();
    expect(defaultWallMaterialCatalog.resolvePreset('')).toBeNull();
  });

  it('4. classifyWallMaterial returns preset for known IDs', () => {
    expect(classifyWallMaterial('mat-brick-masonry')).toBe('preset');
  });

  it('5. classifyWallMaterial returns custom for free-form strings', () => {
    expect(classifyWallMaterial('my-custom-material')).toBe('custom');
  });

  it('6. classifyWallMaterial returns empty for undefined / empty', () => {
    expect(classifyWallMaterial(undefined)).toBe('empty');
    expect(classifyWallMaterial('')).toBe('empty');
  });
});
