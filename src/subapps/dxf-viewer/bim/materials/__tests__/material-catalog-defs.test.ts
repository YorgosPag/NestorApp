/**
 * material-catalog-defs — pure SSoT extraction tests (ADR-413 §2D).
 *
 * Guards the prefix resolver + flat-colour hex used by both the 3D material
 * catalog and the 2D swatch UI, so the extraction from MaterialCatalog3D stays
 * behaviour-identical.
 */

import {
  MATERIAL_DEFS,
  DEFAULT_MATERIAL_KEY,
  resolveMaterialKey,
  getMaterialFlatColorHex,
} from '../material-catalog-defs';

describe('resolveMaterialKey', () => {
  it('returns an exact key unchanged', () => {
    expect(resolveMaterialKey('mat-concrete')).toBe('mat-concrete');
    expect(resolveMaterialKey('elem-slab')).toBe('elem-slab');
  });

  it('resolves a suffixed DNA materialId by prefix (Revit type variant)', () => {
    expect(resolveMaterialKey('mat-concrete-c25')).toBe('mat-concrete');
    expect(resolveMaterialKey('mat-brick-masonry')).toBe('mat-brick');
    expect(resolveMaterialKey('mat-plaster-int')).toBe('mat-plaster');
    expect(resolveMaterialKey('mat-stone-masonry')).toBe('mat-stone');
  });

  it('falls back to the default key for an unmapped id', () => {
    expect(resolveMaterialKey('mat-marble')).toBe(DEFAULT_MATERIAL_KEY);
    expect(resolveMaterialKey('totally-unknown')).toBe(DEFAULT_MATERIAL_KEY);
  });
});

describe('getMaterialFlatColorHex', () => {
  it('formats the resolved key colour as #rrggbb', () => {
    expect(getMaterialFlatColorHex('mat-concrete')).toBe('#b0b0b0');
    expect(getMaterialFlatColorHex('mat-wood')).toBe('#8b5e3c');
  });

  it('zero-pads colours below 0x100000', () => {
    // elem-mep-manifold = 0x0891b2 → must not collapse to '#891b2'.
    expect(getMaterialFlatColorHex('elem-mep-manifold')).toBe('#0891b2');
  });

  it('uses the prefix-resolved colour for suffixed ids', () => {
    expect(getMaterialFlatColorHex('mat-concrete-c30')).toBe('#b0b0b0');
  });

  it('falls back to the default-key colour for unmapped ids', () => {
    expect(getMaterialFlatColorHex('mat-marble')).toBe(getMaterialFlatColorHex(DEFAULT_MATERIAL_KEY));
  });
});

describe('MATERIAL_DEFS', () => {
  it('contains the default key', () => {
    expect(MATERIAL_DEFS[DEFAULT_MATERIAL_KEY]).toBeDefined();
  });

  // ADR-445 — foundation kinds (pad/strip/tie-beam) carry DISTINCT sienna faces
  // (3D consistency with the 2D `FOUNDATION_KIND_STROKE` palette). Read the raw
  // defs: `getMaterialFlatColorHex`/`resolveMaterialKey` prefix-collapse a DNA
  // suffix (`-strip`) onto `elem-foundation`, but the 3D element-material path
  // (`getElementMaterial3D` → exact key) keeps them distinct — see
  // foundation-to-three.test.ts.
  it('defines distinct per-kind foundation face colours', () => {
    const pad = MATERIAL_DEFS['elem-foundation-pad']?.color;
    const strip = MATERIAL_DEFS['elem-foundation-strip']?.color;
    const tie = MATERIAL_DEFS['elem-foundation-tie-beam']?.color;
    expect([pad, strip, tie]).toEqual([0x8a5a3c, 0x2f7d6a, 0xb5651d]);
    expect(new Set([pad, strip, tie]).size).toBe(3);
  });
});
